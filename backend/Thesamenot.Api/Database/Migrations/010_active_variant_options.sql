ALTER TABLE variants DROP INDEX product_size_color,
 ADD active_size VARCHAR(8) GENERATED ALWAYS AS (IF(active,size,NULL)) PERSISTENT,
 ADD active_color VARCHAR(60) GENERATED ALWAYS AS (IF(active,color,NULL)) PERSISTENT,
 ADD UNIQUE KEY active_product_option(product_id,active_size,active_color);
