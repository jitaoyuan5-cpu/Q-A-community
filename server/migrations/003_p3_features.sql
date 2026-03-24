ALTER TABLE users
  ADD COLUMN preferred_locale ENUM('zh-CN','en-US') NOT NULL DEFAULT 'zh-CN' AFTER role;

ALTER TABLE favorites
  MODIFY COLUMN target_type ENUM('question','article','tutorial') NOT NULL;

ALTER TABLE reports
  MODIFY COLUMN target_type ENUM('question','answer','article','comment','chat_message') NOT NULL;

CREATE TABLE IF NOT EXISTS assistant_threads (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  title VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_assistant_threads_user_updated (user_id, updated_at)
);

CREATE TABLE IF NOT EXISTS assistant_messages (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  thread_id BIGINT NOT NULL,
  role ENUM('system','user','assistant') NOT NULL,
  content LONGTEXT NOT NULL,
  citations_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (thread_id) REFERENCES assistant_threads(id) ON DELETE CASCADE,
  INDEX idx_assistant_messages_thread_created (thread_id, created_at)
);

CREATE TABLE IF NOT EXISTS assistant_feedback (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  thread_id BIGINT NOT NULL,
  message_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  value TINYINT NOT NULL,
  comment TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (thread_id) REFERENCES assistant_threads(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES assistant_messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_assistant_feedback (message_id, user_id)
);

CREATE TABLE IF NOT EXISTS question_chat_messages (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  question_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  content TEXT NOT NULL,
  is_hidden TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_question_chat_question_created (question_id, created_at),
  INDEX idx_question_chat_hidden (question_id, is_hidden, created_at)
);

CREATE TABLE IF NOT EXISTS tutorials (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL,
  description LONGTEXT NOT NULL,
  cover VARCHAR(500) NOT NULL DEFAULT '',
  author_id BIGINT NOT NULL,
  difficulty ENUM('beginner','intermediate','advanced') NOT NULL DEFAULT 'beginner',
  is_published TINYINT(1) NOT NULL DEFAULT 1,
  is_hidden TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_tutorials_published_created (is_published, is_hidden, created_at)
);

CREATE TABLE IF NOT EXISTS tutorial_lessons (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tutorial_id BIGINT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  video_provider ENUM('youtube','bilibili','vimeo') NOT NULL,
  video_url VARCHAR(500) NOT NULL,
  embed_url VARCHAR(500) NOT NULL,
  duration_seconds INT NOT NULL DEFAULT 0,
  starter_template VARCHAR(32) NULL,
  starter_files JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tutorial_id) REFERENCES tutorials(id) ON DELETE CASCADE,
  INDEX idx_tutorial_lessons_tutorial_sort (tutorial_id, sort_order)
);

CREATE TABLE IF NOT EXISTS tutorial_progress (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  tutorial_id BIGINT NOT NULL,
  lesson_id BIGINT NULL,
  progress_percent INT NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_tutorial_progress (user_id, tutorial_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (tutorial_id) REFERENCES tutorials(id) ON DELETE CASCADE,
  FOREIGN KEY (lesson_id) REFERENCES tutorial_lessons(id) ON DELETE SET NULL,
  INDEX idx_tutorial_progress_user_updated (user_id, updated_at)
);

CREATE TABLE IF NOT EXISTS tutorial_tags (
  tutorial_id BIGINT NOT NULL,
  tag_id BIGINT NOT NULL,
  PRIMARY KEY (tutorial_id, tag_id),
  FOREIGN KEY (tutorial_id) REFERENCES tutorials(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS playground_shares (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NULL,
  title VARCHAR(255) NOT NULL,
  template_key VARCHAR(32) NOT NULL,
  files_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_playground_shares_created (created_at)
);

CREATE TABLE IF NOT EXISTS developer_api_keys (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  name VARCHAR(120) NOT NULL,
  key_prefix VARCHAR(24) NOT NULL,
  key_hash CHAR(64) NOT NULL UNIQUE,
  last_used_at DATETIME NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_developer_keys_user_created (user_id, created_at)
);

CREATE TABLE IF NOT EXISTS api_usage_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  api_key_id BIGINT NOT NULL,
  path VARCHAR(255) NOT NULL,
  method VARCHAR(16) NOT NULL,
  status_code INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (api_key_id) REFERENCES developer_api_keys(id) ON DELETE CASCADE,
  INDEX idx_api_usage_key_created (api_key_id, created_at)
);
