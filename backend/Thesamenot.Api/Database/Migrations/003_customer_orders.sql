ALTER TABLE users ADD COLUMN profile_version INT NOT NULL DEFAULT 0;
CREATE TABLE user_addresses (
  id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  user_id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  label VARCHAR(60) NOT NULL, name VARCHAR(120) NOT NULL,
  address VARCHAR(250) NOT NULL, city VARCHAR(120) NOT NULL,
  postal_code VARCHAR(24) NOT NULL, country VARCHAR(2) NOT NULL,
  phone VARCHAR(32) NOT NULL DEFAULT '', is_default BOOLEAN NOT NULL DEFAULT FALSE,
  version INT NOT NULL DEFAULT 0, created_utc DATETIME(6) NOT NULL, updated_utc DATETIME(6) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id), INDEX address_owner(user_id,id)
) ENGINE=InnoDB;
ALTER TABLE orders
  ADD COLUMN user_id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NULL,
  ADD COLUMN checkout_owner VARCHAR(96) NOT NULL DEFAULT 'legacy',
  ADD COLUMN order_number VARCHAR(40) NULL,
  ADD COLUMN phone VARCHAR(32) NOT NULL DEFAULT '',
  ADD COLUMN version INT NOT NULL DEFAULT 0,
  ADD CONSTRAINT order_customer FOREIGN KEY (user_id) REFERENCES users(id),
  ADD INDEX customer_history(user_id,created_utc,id);
UPDATE orders SET order_number=CONCAT('TSN-',UPPER(LEFT(id,12)));
ALTER TABLE orders MODIFY order_number VARCHAR(40) NOT NULL, ADD UNIQUE KEY unique_order_number(order_number);
CREATE TABLE order_access_tokens (
  id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  order_id VARCHAR(32) NOT NULL, purpose VARCHAR(16) NOT NULL,
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
  expires_utc DATETIME(6) NOT NULL, used_utc DATETIME(6) NULL, revoked_utc DATETIME(6) NULL,
  created_utc DATETIME(6) NOT NULL,
  FOREIGN KEY(order_id) REFERENCES orders(id), INDEX order_token(order_id,purpose)
) ENGINE=InnoDB;
