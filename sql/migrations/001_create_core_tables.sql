CREATE DATABASE IF NOT EXISTS psych_scheduler
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

SET NAMES utf8mb4;

USE psych_scheduler;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(64) PRIMARY KEY,
  description VARCHAR(255) NOT NULL,
  executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  user_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  openid VARCHAR(128) NULL,
  test_identity_key VARCHAR(64) NULL,
  student_id VARCHAR(32) NOT NULL,
  name VARCHAR(64) NOT NULL,
  avatar_url VARCHAR(512) NULL,
  gender ENUM('male', 'female') NOT NULL,
  college VARCHAR(128) NOT NULL,
  grade VARCHAR(32) NOT NULL,
  member_type ENUM('new_assistant', 'senior_assistant', 'intern_assistant', 'manager_assistant') NOT NULL DEFAULT 'new_assistant',
  role ENUM('assistant', 'admin', 'super_admin') NOT NULL DEFAULT 'assistant',
  account_status ENUM('pending', 'active', 'rejected', 'disabled') NOT NULL DEFAULT 'active',
  can_solo_shift TINYINT(1) NOT NULL DEFAULT 0,
  reliability_tag TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uk_users_student_id (student_id),
  UNIQUE KEY uk_users_openid (openid),
  UNIQUE KEY uk_users_test_identity_key (test_identity_key),
  KEY idx_users_role_status (role, account_status),
  KEY idx_users_college_grade (college, grade)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS semesters (
  semester_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(128) NOT NULL,
  first_week_start_date DATE NOT NULL,
  total_weeks INT UNSIGNED NOT NULL,
  grade_update_status ENUM('pending', 'confirmed', 'skipped') NOT NULL DEFAULT 'pending',
  is_current TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (semester_id),
  UNIQUE KEY uk_semesters_name (name),
  KEY idx_semesters_current (is_current)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS system_settings (
  setting_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  setting_key VARCHAR(128) NOT NULL,
  setting_value TEXT NOT NULL,
  description VARCHAR(255) NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_id),
  UNIQUE KEY uk_system_settings_key (setting_key),
  CONSTRAINT fk_system_settings_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(user_id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shift_templates (
  shift_template_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(64) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  default_required_count INT UNSIGNED NOT NULL DEFAULT 2,
  min_count INT UNSIGNED NOT NULL DEFAULT 1,
  allow_solo TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (shift_template_id),
  UNIQUE KEY uk_shift_templates_name_time (name, start_time, end_time),
  KEY idx_shift_templates_active_sort (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS workday_overrides (
  override_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  work_date DATE NOT NULL,
  override_type ENUM('workday', 'non_workday', 'no_shift') NOT NULL,
  reason VARCHAR(255) NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (override_id),
  UNIQUE KEY uk_workday_overrides_date (work_date),
  CONSTRAINT fk_workday_overrides_created_by
    FOREIGN KEY (created_by) REFERENCES users(user_id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS availability_collections (
  collection_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  semester_id BIGINT UNSIGNED NULL,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  teaching_week INT UNSIGNED NULL,
  status ENUM('pending', 'active', 'completed') NOT NULL DEFAULT 'pending',
  total_users INT UNSIGNED NOT NULL DEFAULT 0,
  submitted_users INT UNSIGNED NOT NULL DEFAULT 0,
  created_by BIGINT UNSIGNED NULL,
  published_at DATETIME NULL,
  completed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (collection_id),
  UNIQUE KEY uk_availability_collections_week (week_start_date, week_end_date),
  KEY idx_availability_collections_status (status),
  CONSTRAINT fk_availability_collections_semester
    FOREIGN KEY (semester_id) REFERENCES semesters(semester_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_availability_collections_created_by
    FOREIGN KEY (created_by) REFERENCES users(user_id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS availabilities (
  availability_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  collection_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  work_date DATE NOT NULL,
  shift_template_id BIGINT UNSIGNED NOT NULL,
  status ENUM('available', 'unavailable') NOT NULL,
  max_weekly_shifts INT UNSIGNED NULL,
  is_week_leave TINYINT(1) NOT NULL DEFAULT 0,
  is_manual_added TINYINT(1) NOT NULL DEFAULT 0,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (availability_id),
  UNIQUE KEY uk_availabilities_slot (collection_id, user_id, work_date, shift_template_id),
  KEY idx_availabilities_collection_date (collection_id, work_date),
  CONSTRAINT fk_availabilities_collection
    FOREIGN KEY (collection_id) REFERENCES availability_collections(collection_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_availabilities_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_availabilities_shift_template
    FOREIGN KEY (shift_template_id) REFERENCES shift_templates(shift_template_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_availabilities_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(user_id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS schedules (
  schedule_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  collection_id BIGINT UNSIGNED NULL,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  status ENUM('draft', 'published', 'adjusted') NOT NULL DEFAULT 'draft',
  risk_summary TEXT NULL,
  confirmed_by BIGINT UNSIGNED NULL,
  confirmed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (schedule_id),
  KEY idx_schedules_week_status (week_start_date, week_end_date, status),
  CONSTRAINT fk_schedules_collection
    FOREIGN KEY (collection_id) REFERENCES availability_collections(collection_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_schedules_confirmed_by
    FOREIGN KEY (confirmed_by) REFERENCES users(user_id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS schedule_assignments (
  assignment_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  schedule_id BIGINT UNSIGNED NOT NULL,
  work_date DATE NOT NULL,
  shift_template_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  assignment_source ENUM('auto', 'manual', 'swap') NOT NULL DEFAULT 'auto',
  risk_tags TEXT NULL,
  notes VARCHAR(255) NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (assignment_id),
  UNIQUE KEY uk_schedule_assignments_user_slot (schedule_id, work_date, shift_template_id, user_id),
  KEY idx_schedule_assignments_user_date (user_id, work_date),
  CONSTRAINT fk_schedule_assignments_schedule
    FOREIGN KEY (schedule_id) REFERENCES schedules(schedule_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_schedule_assignments_shift_template
    FOREIGN KEY (shift_template_id) REFERENCES shift_templates(shift_template_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_schedule_assignments_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_schedule_assignments_created_by
    FOREIGN KEY (created_by) REFERENCES users(user_id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS swap_requests (
  swap_request_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  requester_id BIGINT UNSIGNED NOT NULL,
  original_assignment_id BIGINT UNSIGNED NOT NULL,
  target_user_id BIGINT UNSIGNED NULL,
  target_assignment_id BIGINT UNSIGNED NULL,
  reason VARCHAR(500) NULL,
  status ENUM('pending_peer', 'pending_admin', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending_admin',
  peer_confirmed_at DATETIME NULL,
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  review_note VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (swap_request_id),
  KEY idx_swap_requests_status (status),
  CONSTRAINT fk_swap_requests_requester
    FOREIGN KEY (requester_id) REFERENCES users(user_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_swap_requests_original_assignment
    FOREIGN KEY (original_assignment_id) REFERENCES schedule_assignments(assignment_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_swap_requests_target_user
    FOREIGN KEY (target_user_id) REFERENCES users(user_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_swap_requests_target_assignment
    FOREIGN KEY (target_assignment_id) REFERENCES schedule_assignments(assignment_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_swap_requests_reviewed_by
    FOREIGN KEY (reviewed_by) REFERENCES users(user_id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS overtime_records (
  overtime_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  assignment_id BIGINT UNSIGNED NOT NULL,
  duration_minutes INT UNSIGNED NOT NULL,
  reason VARCHAR(500) NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  review_note VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (overtime_id),
  KEY idx_overtime_records_user_status (user_id, status),
  CONSTRAINT fk_overtime_records_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_overtime_records_assignment
    FOREIGN KEY (assignment_id) REFERENCES schedule_assignments(assignment_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_overtime_records_reviewed_by
    FOREIGN KEY (reviewed_by) REFERENCES users(user_id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  notification_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  recipient_user_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(64) NOT NULL,
  title VARCHAR(128) NOT NULL,
  content VARCHAR(1000) NOT NULL,
  related_entity_type VARCHAR(64) NULL,
  related_entity_id BIGINT UNSIGNED NULL,
  read_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notification_id),
  KEY idx_notifications_recipient_read (recipient_user_id, read_at),
  CONSTRAINT fk_notifications_recipient
    FOREIGN KEY (recipient_user_id) REFERENCES users(user_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS operation_logs (
  log_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_user_id BIGINT UNSIGNED NULL,
  action VARCHAR(128) NOT NULL,
  entity_type VARCHAR(64) NULL,
  entity_id BIGINT UNSIGNED NULL,
  result ENUM('success', 'failed') NOT NULL DEFAULT 'success',
  detail TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (log_id),
  KEY idx_operation_logs_actor_time (actor_user_id, created_at),
  KEY idx_operation_logs_entity (entity_type, entity_id),
  CONSTRAINT fk_operation_logs_actor
    FOREIGN KEY (actor_user_id) REFERENCES users(user_id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS exported_files (
  exported_file_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  schedule_id BIGINT UNSIGNED NOT NULL,
  export_type ENUM('excel', 'image', 'share') NOT NULL DEFAULT 'excel',
  file_name VARCHAR(255) NOT NULL,
  local_path VARCHAR(512) NULL,
  cos_key VARCHAR(512) NULL,
  file_url VARCHAR(1024) NULL,
  generated_by BIGINT UNSIGNED NULL,
  generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (exported_file_id),
  KEY idx_exported_files_schedule (schedule_id),
  CONSTRAINT fk_exported_files_schedule
    FOREIGN KEY (schedule_id) REFERENCES schedules(schedule_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_exported_files_generated_by
    FOREIGN KEY (generated_by) REFERENCES users(user_id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE users
  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  MODIFY name VARCHAR(64) NOT NULL,
  MODIFY college VARCHAR(128) NOT NULL,
  MODIFY grade VARCHAR(32) NOT NULL,
  MODIFY member_type ENUM('new_assistant', 'senior_assistant', 'intern_assistant', 'manager_assistant') NOT NULL DEFAULT 'new_assistant',
  MODIFY role ENUM('assistant', 'admin', 'super_admin') NOT NULL DEFAULT 'assistant',
  MODIFY account_status ENUM('pending', 'active', 'rejected', 'disabled') NOT NULL DEFAULT 'active';

INSERT INTO schema_migrations (version, description)
VALUES ('001', 'create core scheduler tables')
ON DUPLICATE KEY UPDATE
  description = VALUES(description);
