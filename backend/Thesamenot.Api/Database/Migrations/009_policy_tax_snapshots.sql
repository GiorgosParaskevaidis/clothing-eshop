ALTER TABLE orders ADD tax_policy_version VARCHAR(60) NOT NULL DEFAULT 'demo-unconfigured',
 ADD tax_snapshot JSON NULL, ADD net_cents INT NULL, ADD tax_cents INT NULL,
 ADD shipping_policy_version VARCHAR(60) NOT NULL DEFAULT 'demo-shipping-v1',
 ADD privacy_version VARCHAR(60) NOT NULL DEFAULT 'demo-privacy-v1',
 ADD returns_policy_version VARCHAR(60) NOT NULL DEFAULT 'demo-returns-v1';
ALTER TABLE checkout_quotes ADD tax_hash CHAR(64) NOT NULL DEFAULT '';
ALTER TABLE disputes ADD currency CHAR(3) NOT NULL DEFAULT 'EUR';
