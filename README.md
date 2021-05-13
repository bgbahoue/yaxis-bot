# YAXIS DISCORD WEBHOOK

## Objective
Create a Discord webhook to poll Etherscan ERC-20 internal transactions associated with MetaVault v2 contract and display buybacks executed by its active strategies.

## Installation instructions
Runs on node.js and a Postgres SQL database. Tested with node.js v16.1.0 and Postgres SQL v13.2.

node.js code is really 2 files: 
* `lib/app.js` containing most of the code, and 
* `lib/db.js` encapsulating the DB initialization routines and exposing a `query()` method to run all SQL queries. It's worth noticing that the `db.js::init()` function creates all needed tables in the PSQL database that you chose via the `DATABASE_URL` environment variable (see below).

PSQL database uses 2 tables:
1. `transactions` saving the data relative to all past buyback transactions
2. `tokenHistoricalPrices` saving YAXIS v2 token price at the time of each transactions

### Pre-requisites

1. Install latest version of node.js and PSQL
2. Create a PSQL database of your choosing and set the URI accordingly (e.g. `yaxis_discord`)
3. (Optional) Run the SQL [install script](https://github.com/bgbahoue/yaxis-discord/blob/main/misc/prices_init.sql) to load historical token prices. It's optional to run it, if no data exists the script will use the current token price (same behavior as Etherscan but not accurate for past transactions)
4. Edit [package.json](https://github.com/bgbahoue/yaxis-discord/blob/main/package.json) file and update the environment variables in `script.local` (see environment variables below)

### Environment variables
Several environment variables were created to override the content of [config.json](https://github.com/bgbahoue/yaxis-discord/blob/main/config.json) 
* `WEBHOOK_ID`: the ID of Discord's webhook to post messages to
* `WEBHOOK_TOKEN`: associated Discord's webhook token
* `YAXIS_EMOJI_NAME` & `YAXIS_EMOJI_ID`: Discord emoji code used to display the Yaxis emjoi. As it's a custom emoji, you'll have to install it on your server and use the following command to get the ID `\:[your token name]`
* `ETHERSCAN_API_KEY`: Etherscan API (should work without any API key as a default rate limit of 1 txn per 5s will be applied)

### config.json file
* `discord.webhook` > same as `WEBHOOK_ID` & `WEBHOOK_TOKEN` environment variables
* `discord.emoji` > same `YAXIS_EMOJI_NAME` & `YAXIS_EMOJI_ID` environment variables
* `etherscan.api_key` > same as `ETHERSCAN_API_KEY` environment variable
* `yaxis` > various constants relative to the YAXIS project. `yaxis.metavault.startblock` is the startblock used in case none can be found in the DB
* `refresh` > default sleep time before fetch new transactions from Etherscan API (5min by default)

## To launch the script
Use `npm run local`. `npm start` is used by Heroku or equivalent solutions.