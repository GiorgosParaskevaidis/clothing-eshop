CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(40) PRIMARY KEY, name VARCHAR(120) NOT NULL, description VARCHAR(1000) NOT NULL,
  price_cents INT NOT NULL CHECK (price_cents > 0), edition INT NOT NULL,
  front_image VARCHAR(200) NOT NULL, back_image VARCHAR(200) NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS variants (
  id VARCHAR(60) PRIMARY KEY, product_id VARCHAR(40) NOT NULL, size VARCHAR(8) NOT NULL,
  available INT NOT NULL CHECK (available >= 0), version INT NOT NULL DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES products(id), UNIQUE KEY product_size(product_id,size)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(32) PRIMARY KEY, public_token VARCHAR(64) NOT NULL UNIQUE,
  request_key VARCHAR(64) NOT NULL UNIQUE, payload_hash VARCHAR(64) NOT NULL,
  email VARCHAR(254) NOT NULL, name VARCHAR(120) NOT NULL, address VARCHAR(250) NOT NULL,
  city VARCHAR(120) NOT NULL, postal_code VARCHAR(24) NOT NULL, country VARCHAR(2) NOT NULL,
  status VARCHAR(30) NOT NULL, payment_mode VARCHAR(20) NOT NULL,
  stripe_session_id VARCHAR(200) NULL UNIQUE, checkout_url TEXT NULL,
  subtotal_cents INT NOT NULL, shipping_cents INT NOT NULL, total_cents INT NOT NULL,
  created_utc DATETIME(6) NOT NULL, expires_utc DATETIME(6) NOT NULL,
  INDEX expiration(status,expires_utc)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, order_id VARCHAR(32) NOT NULL,
  variant_id VARCHAR(60) NOT NULL, product_name VARCHAR(120) NOT NULL, size VARCHAR(8) NOT NULL,
  quantity INT NOT NULL CHECK (quantity BETWEEN 1 AND 10), unit_price_cents INT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id), FOREIGN KEY (variant_id) REFERENCES variants(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS subscribers (
  email VARCHAR(254) PRIMARY KEY, consent_utc DATETIME(6) NOT NULL, consent_version VARCHAR(30) NOT NULL,
  unsubscribe_token VARCHAR(64) NOT NULL UNIQUE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS payment_events (
  id VARCHAR(200) PRIMARY KEY, received_utc DATETIME(6) NOT NULL
) ENGINE=InnoDB;
INSERT IGNORE INTO products VALUES
 ('hood','Ghost Hoodie','Black hoodie. The S over the heart, the whole back is his.',4200,50,'/images/hood_front.jpg','/images/hood_back.jpg',TRUE),
 ('crew','Tag Crewneck','White crewneck. The goblin over the heart, the tag running down the spine.',3800,50,'/images/crew_front.jpg','/images/crew_back.jpg',TRUE);
INSERT IGNORE INTO variants (id,product_id,size,available) VALUES
 ('hood-S','hood','S',10),('hood-M','hood','M',15),('hood-L','hood','L',15),('hood-XL','hood','XL',10),
 ('crew-S','crew','S',10),('crew-M','crew','M',15),('crew-L','crew','L',15),('crew-XL','crew','XL',10);
