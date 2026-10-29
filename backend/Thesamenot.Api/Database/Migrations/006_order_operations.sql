ALTER TABLE orders ADD payment_status VARCHAR(24) NOT NULL DEFAULT 'pending',
 ADD reservation_status VARCHAR(24) NOT NULL DEFAULT 'active',
 ADD fulfillment_status VARCHAR(24) NOT NULL DEFAULT 'unfulfilled',
 ADD stripe_payment_intent VARCHAR(200) NULL UNIQUE;
UPDATE orders SET payment_status=IF(status IN ('paid','fulfilled'),'succeeded',IF(status='expired','unpaid','pending')),
 reservation_status=IF(status IN ('paid','fulfilled'),'consumed',IF(status='expired','released','active')),
 fulfillment_status=IF(status='fulfilled','shipped','unfulfilled');
CREATE TABLE order_reservations (
 order_id VARCHAR(32) NOT NULL, variant_id VARCHAR(60) NOT NULL, quantity INT NOT NULL,
 state VARCHAR(24) NOT NULL, expires_utc DATETIME(6) NOT NULL,
 PRIMARY KEY(order_id,variant_id),FOREIGN KEY(order_id) REFERENCES orders(id),FOREIGN KEY(variant_id) REFERENCES variants(id)
) ENGINE=InnoDB;
INSERT INTO order_reservations SELECT i.order_id,i.variant_id,i.quantity,o.reservation_status,o.expires_utc FROM order_items i JOIN orders o ON o.id=i.order_id;
CREATE TABLE payment_attempts (
 order_id VARCHAR(32) PRIMARY KEY, provider_session VARCHAR(200) NULL UNIQUE,
 payment_intent VARCHAR(200) NULL UNIQUE, expected_cents INT NOT NULL, received_cents INT NOT NULL DEFAULT 0,
 currency CHAR(3) NOT NULL, state VARCHAR(24) NOT NULL, updated_utc DATETIME(6) NOT NULL DEFAULT UTC_TIMESTAMP(6),
 FOREIGN KEY(order_id) REFERENCES orders(id)
) ENGINE=InnoDB;
INSERT INTO payment_attempts(order_id,provider_session,expected_cents,received_cents,currency,state)
 SELECT id,stripe_session_id,total_cents,IF(payment_status='succeeded',total_cents,0),currency,payment_status FROM orders;
CREATE TABLE background_jobs (
 id CHAR(32) PRIMARY KEY, dedup_key VARCHAR(220) NOT NULL UNIQUE, kind VARCHAR(30) NOT NULL,
 protected_payload MEDIUMTEXT NOT NULL, state VARCHAR(16) NOT NULL DEFAULT 'pending',
 attempts INT NOT NULL DEFAULT 0, next_utc DATETIME(6) NOT NULL DEFAULT UTC_TIMESTAMP(6),
 lease_id CHAR(32) NULL, lease_until_utc DATETIME(6) NULL, last_code VARCHAR(100) NULL,
 created_utc DATETIME(6) NOT NULL DEFAULT UTC_TIMESTAMP(6), updated_utc DATETIME(6) NOT NULL DEFAULT UTC_TIMESTAMP(6),
 INDEX jobs_due(state,next_utc,lease_until_utc,id)
) ENGINE=InnoDB;
CREATE TABLE order_history (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, order_id VARCHAR(32) NOT NULL, event_type VARCHAR(60) NOT NULL,
 detail VARCHAR(1000) NOT NULL, actor VARCHAR(100) NOT NULL, created_utc DATETIME(6) NOT NULL DEFAULT UTC_TIMESTAMP(6),
 FOREIGN KEY(order_id) REFERENCES orders(id),INDEX history_order(order_id,id)
) ENGINE=InnoDB;
CREATE TABLE payment_incidents (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, order_id VARCHAR(32) NULL, event_id VARCHAR(200) NOT NULL UNIQUE,
 reason VARCHAR(100) NOT NULL, amount_cents INT NULL, currency VARCHAR(10) NULL,
 resolved BOOLEAN NOT NULL DEFAULT FALSE, created_utc DATETIME(6) NOT NULL DEFAULT UTC_TIMESTAMP(6),
 FOREIGN KEY(order_id) REFERENCES orders(id)
) ENGINE=InnoDB;
CREATE TABLE refunds (
 id CHAR(32) PRIMARY KEY, order_id VARCHAR(32) NOT NULL, request_key VARCHAR(36) NOT NULL,
 amount_cents INT NOT NULL CHECK(amount_cents>0), reason VARCHAR(300) NOT NULL,
 state VARCHAR(24) NOT NULL DEFAULT 'pending', provider_id VARCHAR(200) NULL UNIQUE, seen_event BIGINT NOT NULL DEFAULT 0,
 created_utc DATETIME(6) NOT NULL DEFAULT UTC_TIMESTAMP(6), updated_utc DATETIME(6) NOT NULL DEFAULT UTC_TIMESTAMP(6),
 FOREIGN KEY(order_id) REFERENCES orders(id),UNIQUE KEY refund_request(order_id,request_key)
) ENGINE=InnoDB;
CREATE TABLE disputes (
 provider_id VARCHAR(200) PRIMARY KEY, order_id VARCHAR(32) NOT NULL, amount_cents INT NOT NULL,
 state VARCHAR(60) NOT NULL, seen_event BIGINT NOT NULL DEFAULT 0, created_utc DATETIME(6) NOT NULL DEFAULT UTC_TIMESTAMP(6),
 updated_utc DATETIME(6) NOT NULL DEFAULT UTC_TIMESTAMP(6), FOREIGN KEY(order_id) REFERENCES orders(id)
) ENGINE=InnoDB;
CREATE TABLE shipments (
 id CHAR(32) PRIMARY KEY, order_id VARCHAR(32) NOT NULL UNIQUE, courier VARCHAR(120) NOT NULL,
 tracking_number VARCHAR(120) NOT NULL, tracking_url VARCHAR(1000) NOT NULL DEFAULT '',
 created_utc DATETIME(6) NOT NULL DEFAULT UTC_TIMESTAMP(6),FOREIGN KEY(order_id) REFERENCES orders(id)
) ENGINE=InnoDB;
CREATE TABLE return_requests (
 id CHAR(32) PRIMARY KEY, order_id VARCHAR(32) NOT NULL, request_key VARCHAR(36) NOT NULL,
 kind VARCHAR(24) NOT NULL, reason VARCHAR(1000) NOT NULL, state VARCHAR(24) NOT NULL DEFAULT 'requested',
 version INT NOT NULL DEFAULT 0, created_utc DATETIME(6) NOT NULL DEFAULT UTC_TIMESTAMP(6),
 updated_utc DATETIME(6) NOT NULL DEFAULT UTC_TIMESTAMP(6),FOREIGN KEY(order_id) REFERENCES orders(id),
 UNIQUE KEY return_request_key(order_id,request_key)
) ENGINE=InnoDB;
CREATE TABLE return_items (
 return_id CHAR(32) NOT NULL, order_item_id BIGINT NOT NULL, quantity INT NOT NULL,
 received_quantity INT NOT NULL DEFAULT 0, restocked_quantity INT NOT NULL DEFAULT 0,
 PRIMARY KEY(return_id,order_item_id),FOREIGN KEY(return_id) REFERENCES return_requests(id),
 FOREIGN KEY(order_item_id) REFERENCES order_items(id),
 CHECK(quantity>0 AND received_quantity>=0 AND received_quantity<=quantity AND restocked_quantity>=0 AND restocked_quantity<=received_quantity)
) ENGINE=InnoDB;
