ALTER TABLE subscribers ADD status VARCHAR(20) NOT NULL DEFAULT 'pending',
 ADD confirmed_utc DATETIME(6) NULL, ADD unsubscribed_utc DATETIME(6) NULL;
UPDATE subscribers SET status='pending',unsubscribe_token=UPPER(SHA2(unsubscribe_token,256));
ALTER TABLE subscribers CHANGE unsubscribe_token unsubscribe_token_hash CHAR(64) NOT NULL;
CREATE TABLE newsletter_tokens (
 id CHAR(32) PRIMARY KEY, email VARCHAR(254) NOT NULL, purpose VARCHAR(20) NOT NULL,
 token_hash CHAR(64) NOT NULL UNIQUE, expires_utc DATETIME(6) NOT NULL,
 used_utc DATETIME(6) NULL, created_utc DATETIME(6) NOT NULL DEFAULT UTC_TIMESTAMP(6),
 FOREIGN KEY(email) REFERENCES subscribers(email),INDEX newsletter_token(email,purpose)
) ENGINE=InnoDB;
