'use strict';

const STATE_INITIALIZING    = 0;
const STATE_INITIALIZED     = 1;
const STATE_WORKING         = 2;
const STATE_AVAILABLE       = 3;

const WORKER_STATUS_ERROR = 1;
const WORKER_STATUS_DID_NOTHING = 1;
const WORKER_STATUS_DID_SOMETHING = 2;

// Config files
var config = require('../config.json');

// =======================================================================
// BASE SETUP
// =======================================================================
// Main packages
const Discord               = require('discord.js');
var Etherscan               = require('etherscan-api');
const request               = require('axios');
const Promise               = require('bluebird');
const debug                 = require('debug');
const log                   = debug('main');
const error                 = debug('main:error');


// Import modules
const db                    = require('./db');
const DateTimeUtils         = require("./date/dateTime");
const { default: axios }    = require('axios');

// =======================================================================
// STARTUP
// =======================================================================
var hook;
var state = STATE_INITIALIZING;

// -----------------------------------------------------------------------
// INITIALIZATION LOOP
log("Initiating DB link...");
db.init()
.then(() => {
    log("DB link successfully created");

    // Update config data with optional env variables
    config.discord.webhook.id = process.env.WEBHOOK_ID || config.discord.webhook.id;
    config.discord.webhook.token = process.env.WEBHOOK_TOKEN || config.discord.webhook.token;
    config.discord.emoji.yaxis.name = process.env.YAXIS_EMOJI_NAME || config.discord.emoji.yaxis.name;
    config.discord.emoji.yaxis.id = process.env.YAXIS_EMOJI_ID || config.discord.emoji.yaxis.id;
    config.etherscan.api_key = process.env.ETHERSCAN_API_KEY || config.etherscan.api_key;

    Etherscan = Etherscan.init(config.etherscan.api_key);
    hook = new Discord.WebhookClient(config.discord.webhook.id, config.discord.webhook.token);

    log("=== Worker configuration: setting key parameters... ===");
    log("--- ETHERSCAN ---");
    log("\t- API key %s", config.etherscan.api_key);
    log("--- DISCORD ---");
    log("\t- Connected to webhook id %d", config.discord.webhook.id);
    log("\t- Using YAXIS emoji %s", config.discord.emoji.yaxis);
    log("=== Worker configuration: done ===");
    log("\n");

    return doWork();
}).catch((err) => {
    error("Error caught %s", err);
});

// -----------------------------------------------------------------------
// LAUNCH THE INFINITE REFRESH LOOP
setInterval(() => {
    log("Worker waking up > state = %d", state);

    // Wait until the DB link is successfully created
    if (state == STATE_INITIALIZING) {
        log("Still pending DB link creation ...");
        return;
    } else if (state == STATE_WORKING) {
        log("Waiting for current worker to complete ...");
        return;
    }

    state = STATE_WORKING;
    doWork();
}, config.refresh);


// =======================================================================
// PRIVATE FUNCTIONS
// =======================================================================
function doWork() {
    return getLatestKnownBlock()
    .then((block) => {
        // Fetch from Etherscan all the new transactions since 'latestTimestamp' and display them
        log("Latest known block = %d", block);
        return getInternalTransactionsList(config.yaxis.metavault.contract, block+1); // add 1 to the latest known block to look for new txns
    }).then((txnList) => {
        const nbTransactions = txnList.length;

        if (nbTransactions > 0) {
            log("%d new transactions found (%s) => saving then to DB ...", nbTransactions, txnList.map((e) => { return "@"+e.timeStamp+" #"+e.hash }));

            // Save new transactions & push them to discord
            return Promise.map(txnList, saveTxnDetails)
            .then((savedTxnList) => {
                log("%d new transactions saved to DB => publishing them to discord ...", nbTransactions);
                return Promise.map(savedTxnList, publishTxnDetails)
                .then((res) => {
                    log("%d transactions published to discord", nbTransactions);
                    return WORKER_STATUS_DID_SOMETHING;
                }).catch((err) => {
                    error("Unable to publish new transactions to Discord");
                    return err;
                });
            }).catch((err) => {
                error("Unable to save new transactions to db");
                error(err);
                return err;
            })
        } else {
            log("No new transactions found => going back to sleep for %s", formatTime(config.refresh));

            return WORKER_STATUS_DID_NOTHING;
        }
    }).catch((err) => {
        error("Final catch");
        error(err);

        return WORKER_STATUS_ERROR;
    }).finally(() => {
        state = STATE_AVAILABLE;
    })
}
/**
 * Returns the latest block # saved in the DB. Returns 0 if none found
 * 
 * @returns {Promise} of a block number
 */
function getLatestKnownBlock() {
    return db.getClient()
    .then((client) => {
        return client.query({
            text: "SELECT data->'blockNumber' FROM transactions",
            rowMode: 'array'
        }).then((res) => {
            return res.rows.reduce((max, row) => {
                return (row[0] > max) ? row[0] : max;
            }, 0); // returns 0 if 'res.rows' is empty
        }).catch((err) => {
            error("Error fetching highest block from DB");
            error(err);

            return err;
        }).finally(() => {
            client.release();
        })
    });
}

function saveTxnDetails(txn) {
    log("Saving txn #%s", txn.hash);

    return db.getClient()
    .then((client) => {
        return client.query(
            "INSERT INTO transactions(hash, timestamp, data) VALUES($1, $2, $3)",
            [txn.hash, txn.timeStamp, txn]
        ).then((res) => {
            return txn;
        }).finally(() => {
            client.release();
        })
    }).catch((err) => {
        error("Unable to get a new client from the pool");
        error(err);
        return err;
    })
}

function getInternalTransactionsList(contract, startBlock=0, endBlock='latest') {
    return Etherscan.account.tokentx(contract, null, startBlock, endBlock, config.etherscan.page, config.etherscan.offset, 'asc')
        .then((response) => {
            if ((response.status == 1) && (response.message == 'OK') && Array.isArray(response.result)) {
                return response.result;
            } else {
                log(response);
                throw new Error("Invalid response received");
            }
        }).catch((err) => {
            if  (((err.status == 0) && (err.message == 'No transactions found')) ||
                (err ='No transactions found'))
            {
                return [];
            } else {
                throw err;
            }
        }).then((txnList) => {
            return Promise.map(txnList, getTokenUSDValue)
        })
}

/**
 * Finds USD price of the token at the time of the transaction
 * 
 * @param {Transaction} txn 
 */
function getTokenUSDValue(txn) {
    return db.getClient()
    .then((client) => {
        return client.query(
            'SELECT * FROM tokenHistoricalPrices WHERE timestamp = $1', 
            [ Number.parseInt(txn.timeStamp) ]
        ).catch((err) => {
            error("Error fetching price data from DB");
            return null; // try something else
        }).then((res) => {
            const price = ((res == null) || !Array.isArray(res.rows) || !res.rows[0]) ? null : res.rows[0].price; // timestamp is a PK so only 1 result possible
            if (price == null) {
                // Nothing in database => get the current price
                return scrapTokenUSDValue()
                .then((price) => {
                    // Save price in DB and return it
                    log("Saving price data (%d, %d)", txn.timeStamp, price);
                    return client.query(
                        'INSERT INTO tokenHistoricalPrices(timestamp, price) VALUES ($1, $2)',
                        [txn.timeStamp, price]
                    ).then((res) => {
                        return price;
                    })
                })
            } else {
                log("Price found for txn #%s > %d", txn.hash, price);
                return price;
            }
        }).then((price) => {
            txn.price = price;
            return txn;
        }).catch((err) => {
            error("Unable to get token USD price");
            error(err);
            return err;
        }).finally(() => {
            client.release();
        })
    })
}

function scrapTokenUSDValue() {
    const url = config.etherscan.base_url + '/token/' + config.yaxis.token.contract;

    return axios.get(url)
    .then((response) => {
        if (response.status == 200) {
            var data = response.data.replace(/\r?\n|\r/g, " "); // remove CR characters
            var re = /<title>\s*\$(.*)\s\| yAxis V2 \(YAXIS\) Token Tracker/i;
            const match = re.exec(data);

            if (match && !Number.isNaN(Number.parseFloat(match[1]))) {
                return Number.parseFloat(match[1]);
            } else {
                throw new Error("Unable to scrap price data from "+url);
            }
        } else {
            throw new Error("Invalid response received from "+url);
        }
    }).catch((err) => {
        error("Error when trying to scrap token price from %s", url);
        return err;
    })
}

function publishTxnDetails(txn) {
    log("Posting transaction #%s", txn.hash);
    const locale = "en-US";
    const usdOpt = {
        currency: "USD",
        currencyDisplay: "symbol",
        useGrouping: true,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        minimumIntegerDigits: 2
    };

    const nbTokens = txn.value / Math.pow(10, txn.tokenDecimal); 
    const tokenUSDValue = txn.price;
    const usdValue = (nbTokens * tokenUSDValue).toLocaleString(locale, usdOpt);
    const yaxis_emoji = "<:" + config.discord.emoji.yaxis.name + ":" + config.discord.emoji.yaxis.id + ">";
    txn.url = config.etherscan.base_url + '/tx/'+txn.hash;

    const embed = new Discord.MessageEmbed()
	.setColor('#0099ff')
	.setTitle('Transaction details')
    .setURL(txn.url)
    .setAuthor('MetaVault v2', '', config.yaxis.metavault.contract_url)
    .setThumbnail(config.yaxis.logo_url)
    .addFields(
        { name: "Contract", value: link(config.yaxis.metavault.contract, config.yaxis.metavault.contract_url) },
        { name: "Transaction hash", value: link(txn.hash, txn.url) },
        { name: "Timestamp", value: formatTimestamp(txn.timeStamp), inline: true },
        { name: "Block", value: txn.blockNumber, inline: true },
        { name: "YAXIS token value", value: '$'+tokenUSDValue.toLocaleString(locale, usdOpt), inline: true },
        { name: "Nb " + txn.tokenSymbol + " bought back", value: yaxis_emoji + " " + nbTokens.toLocaleString('en', { maximumFractionDigits: 2 }), inline: true},
        { name: "USD value", value: "$ " + usdValue, inline: true }
    );

    return hook.send('Buyback successfully executed', {
        username: 'MetaVault',
        embeds: [embed],
    });
}

function formatTimestamp(timestamp) {
    const d = DateTimeUtils.parseTimestamp(timestamp);

    return d.year + "/" + d.month + "/" + d.day.toLocaleString('en', {minimumIntegerDigits:2}) + " " + d.hour.toLocaleString('en', {minimumIntegerDigits:2}) + ":" + d.minute.toLocaleString('en', {minimumIntegerDigits:2}) + ":" + d.second.toLocaleString('en', {minimumIntegerDigits:2});
}

function formatTime(time) {
    const ms = time % 1000;
    const s = parseInt((time / 1000) % 60);
    const m = parseInt((time / 1000 / 60) % 60);
    const h = parseInt((time / 1000 / 60 / 60) % 24);

    var time = "";
    if (h > 0) { time += h+"h "; }
    if (m > 0) { time += m+"m "; }
    if (s > 0) { time += s+"s "; }
    if (ms > 0) { time += ms+"ms"; }

    return time;
}

function link(text, url) {
    if (!url) {
        url = text;
    };
    return '['+text+']('+url+')';
}