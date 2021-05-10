const { Pool }  = require('pg');
const config    = require('../config.json');
const debug     = require('debug');
const log       = debug('db');
const error     = debug('db:error');

const TIMEOUT = 5000;

// // Heroku config
const pool = new Pool({
    connectionString: process.env.DATABASE_URL + '/' + config.db.database,
    ssl: {
        rejectUnauthorized: false
    }
});

// Local config
// const pool = new Pool({
//     connectionString: process.env.DATABASE_URL + '/' + config.db.database
// });

const createTableText = `
CREATE TABLE IF NOT EXISTS transactions (
  hash VARCHAR PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS tokenHistoricalPrices (
  timestamp INTEGER PRIMARY KEY,
  price NUMERIC(9, 2) NOT NULL
);
`;

function init() {
    return getClient()
    .then((client) => {
        return client.query(createTableText)
        .catch((err) => {
            error("Unable to initialize database connexion");
            return err;
        }).finally(() => {
            client.release();
        })
    })
}

function query(text, params) {
    return pool.query(text, params)
};

function getClient() {
    return pool.connect()
        .then((client) => {
            const query = client.query;
            const release = client.release;
            // set a timeout of 5 seconds, after which we will log this client's last query
            const timeout = setTimeout(() => {
                log('A client has been checked out for more than 5 seconds!');
                log(`The last executed query on this client was: ${client.lastQuery}`);
            }, TIMEOUT);

            // monkey patch the query method to keep track of the last query executed
            client.query = (...args) => {
                client.lastQuery = args
                return query.apply(client, args)
            };

            client.release = () => {
                // clear our timeout
                clearTimeout(timeout);

                // set the methods back to their old un-monkey-patched version
                client.query = query;
                client.release = release;
                return release.apply(client);
            };

            return client;
        })
  }

module.exports = { init, query, getClient };