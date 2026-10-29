CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  user_name VARCHAR(254) NOT NULL,
  normalized_user_name VARCHAR(254) COLLATE utf8mb4_bin NOT NULL UNIQUE,
  email VARCHAR(254) NOT NULL,
  normalized_email VARCHAR(254) COLLATE utf8mb4_bin NOT NULL UNIQUE,
  email_confirmed BOOLEAN NOT NULL DEFAULT FALSE, email_confirmed_at DATETIME(6) NULL,
  password_hash VARCHAR(512) NULL, display_name VARCHAR(120) NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  security_stamp VARCHAR(64) NOT NULL, concurrency_stamp VARCHAR(64) NOT NULL,
  lockout_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  access_failed_count INT NOT NULL DEFAULT 0,
  lockout_end_utc DATETIME(6) NULL, two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_utc DATETIME(6) NOT NULL, updated_utc DATETIME(6) NOT NULL
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  name VARCHAR(40) NOT NULL,
  normalized_name VARCHAR(40) COLLATE utf8mb4_bin NOT NULL UNIQUE,
  concurrency_stamp VARCHAR(64) NOT NULL
) ENGINE=InnoDB;
INSERT IGNORE INTO roles(id,name,normalized_name,concurrency_stamp) VALUES
 ('customer','Customer','CUSTOMER','initial-customer'),('admin','Admin','ADMIN','initial-admin');
CREATE TABLE IF NOT EXISTS user_roles (
  user_id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  role_id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY(user_id,role_id),
  FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(role_id) REFERENCES roles(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS user_sessions (
  id_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  user_id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  scheme VARCHAR(30) NOT NULL, security_stamp VARCHAR(64) NOT NULL,
  amr VARCHAR(12) NOT NULL, created_utc DATETIME(6) NOT NULL,
  expires_utc DATETIME(6) NOT NULL, revoked_utc DATETIME(6) NULL,
  FOREIGN KEY(user_id) REFERENCES users(id),
  INDEX session_user(user_id), INDEX session_expiration(expires_utc)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS user_action_tokens (
  id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  user_id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  purpose VARCHAR(40) NOT NULL, token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
  security_stamp VARCHAR(64) NOT NULL, target_email VARCHAR(254) NULL,
  attempts INT NOT NULL DEFAULT 0, created_utc DATETIME(6) NOT NULL,
  expires_utc DATETIME(6) NOT NULL, used_utc DATETIME(6) NULL,
  FOREIGN KEY(user_id) REFERENCES users(id),
  INDEX token_user(user_id,purpose), INDEX token_expiration(expires_utc)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS user_mfa (
  user_id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  protected_key TEXT NOT NULL, last_step BIGINT NOT NULL DEFAULT -1,
  FOREIGN KEY(user_id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS user_recovery_codes (
  user_id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  code_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  used_utc DATETIME(6) NULL,
  PRIMARY KEY(user_id,code_hash), FOREIGN KEY(user_id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS auth_rate_windows (
  key_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  window_utc DATETIME(6) NOT NULL, count INT NOT NULL,
  INDEX rate_expiration(window_utc)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  actor_id VARCHAR(32) NULL, action VARCHAR(60) NOT NULL, entity_id VARCHAR(64) NULL,
  created_utc DATETIME(6) NOT NULL,
  INDEX audit_entity(entity_id,created_utc)
) ENGINE=InnoDB;
