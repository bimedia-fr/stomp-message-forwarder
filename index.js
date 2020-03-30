

const stompit = require('stompit');
const os = require('os');


class MessageForwarder {
    constructor(host, port, options) {
        this.host = host;
        this.port = +port;
        this.timeout = +options.timeout;
        this.maxDelivery = +options.max;
        this.client = null;
    }
    connect() {
        return new Promise((resolve, reject ) => {
            const connectOptions = {
                'host': this.host,
                'port': this.port,
                'connectHeaders':{
                  'host': '/',
                  'client-id': 'forwarder-' + os.hostname(),
                  'heart-beat': '5000,5000'
                }
              };
            stompit.connect(connectOptions, (error, client) => {
                if (error) {
                    return reject(error);
                }
                console.log('connected to', this.host, 'on', this.port);
                this.client = client;
                return resolve(client);
            });
        });
    }
    forward(from, to) {
        if (!this.client) {
            return Promise.reject(new Error('not connected'));
        }
        let timeout;
        this.client.subscribe({
            'destination': from,
            'ack': 'client-individual'
        }, (error, message) => {
            if (error) {
                console.log('subscribe error ' + error.message);
                return;
            }
            if (timeout) {
                clearTimeout(timeout);
            }
            console.log('received message', message.headers['message-id'], message.headers);
            message.readString('utf-8', (error, body) => {
                if (error) {
                    return this.client.nack(message);
                }
                const headers = Object.assign({}, message.headers, {
                    'destination': to || message.headers['original-destination'],
                    'content-type': 'text/plain',
                    'redelivery-count':  (+message.headers['redelivery-count'] || 0) + 1
                 });
                if(+message.headers['redelivery-count'] >= this.maxDelivery) {
                    return console.log('not forwarding message',  message.headers['message-id'], 'max redelivery reached', message.headers['redelivery-count']);
                }
                console.log('forwarding message with id:', message.headers['message-id'], 'to', to || message.headers['original-destination']);
                const frame = this.client.send(headers);
                frame.write(body);
                frame.end();
                this.client.ack(message);
                timeout = setTimeout(() => {
                    this.client.disconnect();
                }, this.timeout);
            });
        });
    }
}
module.exports = MessageForwarder;