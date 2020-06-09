

const stompit = require('stompit');
const os = require('os');


class MessageForwarder {
    constructor(host, port, options) {
        this.host = host;
        this.port = +port;
        this.timeout = +options.timeout;
        this.maxDelivery = +options.maxDelivery;
        this.delay = +options.delay;
        this.num = options.num;
        this.count = 0;
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
                console.info('connected to', this.host, 'on', this.port);
                this.client = client;
                return resolve(client);
            });
        });
    }

    close() {
        this.client.disconnect(() => {
            console.info('disconnected');
        });
    }

    _readMessage(message) {
        return new Promise((resolve, reject) => {
            message.readString('utf-8', (error, body) => {
                if (error) {
                    return reject(error);
                }
                
                resolve(body);
            });
        });
    }
    _sendAndAck(message, to, body) {
        const headers = Object.assign({}, message.headers, {
            'destination': to,
            'content-type': 'text/plain',
            'redelivery-count':  (+message.headers['redelivery-count'] || 0) + 1
        });
        /*if(Number(message.headers['redelivery-count']) >= this.maxDelivery) {
            return console.log('not forwarding message',  message.headers['message-id'], 'max redelivery reached', message.headers['redelivery-count']);
        }*/
        console.log('forwarding message with id:', message.headers['message-id'], 'to', to);
        if(this.count++ < this.num) {
            const frame = this.client.send(headers);
            frame.write(body);
            frame.end();
            this.client.ack(message);
        }
        return message;
    }
    forward(from, to) {
        if (!this.client) {
            return Promise.reject(new Error('not connected'));
        }
        let timedout;
        this.client.subscribe({
            'destination': from,
            'ack': 'client-individual'
        }, (error, message) => {
            if (error) {
                console.log('subscribe error ' + error.message);
                return;
            }
            if (timedout) {
                clearTimeout(timedout);
            }
            console.log('received message', message.headers['message-id'], message.headers);
            this._readMessage(message)
                .then(this._sendAndAck.bind(this, message, (to || message.headers['original-destination'])))
                .then(() => {

                    if(this.count >= this.num) {
                        console.log('done', this.count, 'messages');
                        this.close();
                    } else {
                        timedout = setTimeout(this.close.bind(this), this.timeout);
                    }
                }).catch(console.log);
        });
    }
}
module.exports = MessageForwarder;