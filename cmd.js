#!/usr/bin/env node
const argv = require('yargs')
    .usage('Forward messages from source destination to a target destination.\nUsage: $0 source [dest]')
    .option('h', {
        alias: 'host',
        description: 'stomp server hostname'
    })    
    .option('p', {
        alias: 'port',
        description: 'stomp server port'
    })
    .option('t', {
        alias: 'timeout',
        description: 'inactivity timeout',
        default: 1000
    }).option('m', {
        alias: 'max',
        description: 'max redelivery',
        default: 1
    }).argv;

if(!argv._[0]) {
    console.log('please provide source destination');
    require('yargs').showHelp();
    return ;
}

const MessageForwarder = require('./index');
let forwarder = new MessageForwarder(argv.h, argv.p, {timeout: argv.t, maxDelivery: 1});
forwarder.connect().then(() => {
    forwarder.forward(argv._[0], argv._[1]);
});