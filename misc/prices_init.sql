CREATE TABLE IF NOT EXISTS tokenHistoricalPrices (
  timestamp INTEGER PRIMARY KEY,
  price NUMERIC(9, 2) NOT NULL
);

INSERT INTO tokenHistoricalPrices(timestamp, price) VALUES(1619871513, 42.29);
INSERT INTO tokenHistoricalPrices(timestamp, price) VALUES(1619903596, 43.29);
INSERT INTO tokenHistoricalPrices(timestamp, price) VALUES(1619995201, 45.27);
INSERT INTO tokenHistoricalPrices(timestamp, price) VALUES(1620085326, 43.34);
INSERT INTO tokenHistoricalPrices(timestamp, price) VALUES(1620175314, 38.43);
INSERT INTO tokenHistoricalPrices(timestamp, price) VALUES(1620263795, 37.8);
INSERT INTO tokenHistoricalPrices(timestamp, price) VALUES(1620417324, 26.17);
INSERT INTO tokenHistoricalPrices(timestamp, price) VALUES(1620584678, 29.95);
INSERT INTO tokenHistoricalPrices(timestamp, price) VALUES(1620815858, 29.62);
INSERT INTO tokenHistoricalPrices(timestamp, price) VALUES(1620938997, 24.87);