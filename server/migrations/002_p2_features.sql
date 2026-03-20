ALTER TABLE users
  ADD COLUMN role ENUM('user','admin') NOT NULL DEFAULT 'user' AFTER website;

ALTER TABLE questions
  ADD COLUMN is_hidden TINYINT(1) NOT NULL DEFAULT 0 AFTER answers_count;

ALTER TABLE answers
  ADD COLUMN is_hidden TINYINT(1) NOT NULL DEFAULT 0 AFTER is_accepted;

ALTER TABLE articles
  ADD COLUMN is_hidden TINYINT(1) NOT NULL DEFAULT 0 AFTER comments_count;

ALTER TABLE comments
  ADD COLUMN is_hidden TINYINT(1) NOT NULL DEFAULT 0 AFTER content;

CREATE TABLE IF NOT EXISTS uploads (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL UNIQUE,
  mime_type VARCHAR(120) NOT NULL,
  size_bytes INT NOT NULL,
  url VARCHAR(500) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_uploads_user_created (user_id, created_at)
);

CREATE TABLE IF NOT EXISTS favorites (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  target_type ENUM('question','article') NOT NULL,
  target_id BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_favorite (user_id, target_type, target_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_favorites_user_created (user_id, created_at),
  INDEX idx_favorites_target (target_type, target_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  actor_id BIGINT NULL,
  type ENUM('new_answer','new_comment','answer_accepted','follow_update') NOT NULL,
  target_type ENUM('question','answer','comment') NOT NULL,
  target_id BIGINT NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  link VARCHAR(500) NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_notifications_user_read_created (user_id, is_read, created_at),
  INDEX idx_notifications_target (target_type, target_id)
);

CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id BIGINT PRIMARY KEY,
  email_enabled TINYINT(1) NOT NULL DEFAULT 1,
  notify_new_answer TINYINT(1) NOT NULL DEFAULT 1,
  notify_new_comment TINYINT(1) NOT NULL DEFAULT 1,
  notify_answer_accepted TINYINT(1) NOT NULL DEFAULT 1,
  notify_follow_update TINYINT(1) NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reports (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  reporter_id BIGINT NOT NULL,
  target_type ENUM('question','answer','article','comment') NOT NULL,
  target_id BIGINT NOT NULL,
  reason VARCHAR(80) NOT NULL,
  detail TEXT,
  status ENUM('pending','reviewed','rejected') NOT NULL DEFAULT 'pending',
  action_taken ENUM('ignore','hide','delete') NULL,
  review_note TEXT NULL,
  reviewed_by BIGINT NULL,
  reviewed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_reports_status_created (status, created_at),
  INDEX idx_reports_target (target_type, target_id),
  INDEX idx_reports_reporter_created (reporter_id, created_at)
);
