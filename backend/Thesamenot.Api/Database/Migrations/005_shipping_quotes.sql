CREATE TABLE shipping_settings (
 id INT PRIMARY KEY CHECK(id=1), country CHAR(2) NOT NULL DEFAULT 'GR', currency CHAR(3) NOT NULL DEFAULT 'EUR',
 method_name VARCHAR(120) NOT NULL, cost_cents INT NOT NULL CHECK(cost_cents>=0),
 free_from_cents INT NOT NULL CHECK(free_from_cents>=0), enabled BOOLEAN NOT NULL, version INT NOT NULL DEFAULT 0,
 updated_utc DATETIME(6) NOT NULL DEFAULT UTC_TIMESTAMP(6)
) ENGINE=InnoDB;
INSERT INTO shipping_settings(id,method_name,cost_cents,free_from_cents,enabled) VALUES(1,'Delivery in Greece',400,8000,TRUE);
CREATE TABLE checkout_quotes (
 id CHAR(32) PRIMARY KEY, owner_key VARCHAR(96) NOT NULL, cart_hash CHAR(64) NOT NULL,
 price_hash CHAR(64) NOT NULL, shipping_version INT NOT NULL,
 subtotal_cents INT NOT NULL, shipping_cents INT NOT NULL, total_cents INT NOT NULL,
 created_utc DATETIME(6) NOT NULL, expires_utc DATETIME(6) NOT NULL, INDEX quote_expiry(expires_utc)
) ENGINE=InnoDB;
ALTER TABLE orders ADD currency CHAR(3) NOT NULL DEFAULT 'EUR',
 ADD shipping_method VARCHAR(120) NOT NULL DEFAULT 'Delivery in Greece',
 ADD shipping_version INT NOT NULL DEFAULT 0, ADD quote_id CHAR(32) NULL,
 ADD terms_version VARCHAR(60) NOT NULL DEFAULT 'demo-terms-v1',
 ADD terms_accepted_utc DATETIME(6) NULL;
