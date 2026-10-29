ALTER TABLE shipping_settings MODIFY free_from_cents INT NULL;
ALTER TABLE checkout_quotes CHANGE tax_hash commercial_hash CHAR(64) NOT NULL DEFAULT '';
ALTER TABLE orders ADD policy_snapshot JSON NULL;
ALTER TABLE subscribers MODIFY consent_version VARCHAR(60) NOT NULL;
CREATE INDEX catalog_newest ON products(status,created_utc,id);
CREATE INDEX catalog_name ON products(status,name,id);
CREATE INDEX order_created ON orders(created_utc,id);
CREATE INDEX customer_created ON users(created_utc,id);
CREATE INDEX refund_state ON refunds(state,updated_utc,id);
