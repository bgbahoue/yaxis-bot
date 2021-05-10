"use strict";

// =======================================================================
// MODULES
// =======================================================================
const axios         = require('axios');
const querystring   = require('querystring');

const Account       = require("./account");

// =======================================================================
// CONSTANTS
// =======================================================================
const BASE_URL = 'https://api.etherscan.io';

// =======================================================================
// CONSTRUCTOR
// =======================================================================
var client = {};

function Etherscan(apiKey = 'YourApiKeyToken', timeout = 10000) {
    client = axios.create({
        baseURL: BASE_URL,
        timeout: timeout
    });

    this.account = Account(this);
}

Etherscan.prototype.getRequest = function(query) {
    const querystr = querystring.stringify(query);
    return new Promise(function(resolve, reject) {
        return client.get('/api?'+querystr)
            .then((response) => {

            }).catch((error) => {
                return reject(new Error(error));
            });
}

module.exports = Etherscan;