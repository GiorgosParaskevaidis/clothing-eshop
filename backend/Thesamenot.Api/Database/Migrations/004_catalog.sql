ALTER TABLE products
 ADD slug VARCHAR(120) NOT NULL DEFAULT '',
 ADD status VARCHAR(16) NOT NULL DEFAULT 'draft',
 ADD currency CHAR(3) NOT NULL DEFAULT 'EUR',
 ADD material VARCHAR(1000) NOT NULL DEFAULT '',
 ADD care VARCHAR(1000) NOT NULL DEFAULT '',
 ADD size_guide VARCHAR(2000) NOT NULL DEFAULT '',
 ADD inventory_mode VARCHAR(16) NOT NULL DEFAULT 'limited',
 ADD version INT NOT NULL DEFAULT 0,
 ADD created_utc DATETIME(6) NOT NULL DEFAULT UTC_TIMESTAMP(6),
 ADD updated_utc DATETIME(6) NOT NULL DEFAULT UTC_TIMESTAMP(6);
UPDATE products SET slug=CASE id WHEN 'hood' THEN 'ghost-hoodie' WHEN 'crew' THEN 'tag-crewneck' ELSE CONCAT('piece-',id) END,
 status=IF(active,'published','archived');
ALTER TABLE products ADD UNIQUE KEY product_slug(slug), ADD INDEX catalog(status,price_cents,id),
 ADD CONSTRAINT product_status CHECK(status IN ('draft','published','archived')),
 ADD CONSTRAINT inventory_mode CHECK(inventory_mode IN ('limited','replenishable'));
ALTER TABLE variants ADD sku VARCHAR(80) NOT NULL DEFAULT '', ADD color VARCHAR(60) NOT NULL DEFAULT 'Default',
 ADD active BOOLEAN NOT NULL DEFAULT TRUE;
UPDATE variants SET sku=CONCAT('LEGACY-',UPPER(id));
ALTER TABLE variants DROP INDEX product_size, ADD UNIQUE KEY product_size_color(product_id,size,color), ADD UNIQUE KEY variant_sku(sku);
CREATE TABLE categories (
 id VARCHAR(32) PRIMARY KEY, slug VARCHAR(120) NOT NULL UNIQUE, name VARCHAR(120) NOT NULL,
 version INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;
CREATE TABLE product_categories (
 product_id VARCHAR(40) NOT NULL, category_id VARCHAR(32) NOT NULL,
 PRIMARY KEY(product_id,category_id), FOREIGN KEY(product_id) REFERENCES products(id), FOREIGN KEY(category_id) REFERENCES categories(id)
) ENGINE=InnoDB;
CREATE TABLE product_images (
 id CHAR(32) PRIMARY KEY, product_id VARCHAR(40) NOT NULL, storage_key VARCHAR(100) NOT NULL UNIQUE,
 alt_text VARCHAR(200) NOT NULL, position INT NOT NULL, width INT NOT NULL, height INT NOT NULL,
 created_utc DATETIME(6) NOT NULL DEFAULT UTC_TIMESTAMP(6), FOREIGN KEY(product_id) REFERENCES products(id),
 INDEX product_images_order(product_id,position,id)
) ENGINE=InnoDB;
CREATE TABLE inventory_movements (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, variant_id VARCHAR(60) NOT NULL, order_id VARCHAR(32) NULL,
 delta INT NOT NULL, reason VARCHAR(300) NOT NULL, actor VARCHAR(100) NOT NULL, created_utc DATETIME(6) NOT NULL DEFAULT UTC_TIMESTAMP(6),
 FOREIGN KEY(variant_id) REFERENCES variants(id), FOREIGN KEY(order_id) REFERENCES orders(id), INDEX stock_history(variant_id,id)
) ENGINE=InnoDB;
INSERT INTO inventory_movements(variant_id,delta,reason,actor) SELECT id,available,'Opening stock at catalog migration','migration' FROM variants;
