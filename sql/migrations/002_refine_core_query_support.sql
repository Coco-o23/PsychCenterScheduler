SET NAMES utf8mb4;

USE psych_scheduler;

DELIMITER $$

DROP PROCEDURE IF EXISTS add_column_if_missing $$
CREATE PROCEDURE add_column_if_missing(
  IN p_table_name VARCHAR(64),
  IN p_column_name VARCHAR(64),
  IN p_column_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table_name
      AND COLUMN_NAME = p_column_name
  ) THEN
    SET @sql_text = CONCAT(
      'ALTER TABLE `',
      p_table_name,
      '` ADD COLUMN ',
      p_column_definition
    );
    PREPARE stmt FROM @sql_text;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DROP PROCEDURE IF EXISTS add_index_if_missing $$
CREATE PROCEDURE add_index_if_missing(
  IN p_table_name VARCHAR(64),
  IN p_index_name VARCHAR(64),
  IN p_index_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table_name
      AND INDEX_NAME = p_index_name
  ) THEN
    SET @sql_text = CONCAT(
      'ALTER TABLE `',
      p_table_name,
      '` ADD INDEX `',
      p_index_name,
      '` ',
      p_index_definition
    );
    PREPARE stmt FROM @sql_text;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DELIMITER ;

CALL add_column_if_missing(
  'availability_collections',
  'title',
  '`title` VARCHAR(255) NULL AFTER `collection_id`'
);

CALL add_column_if_missing(
  'availability_collections',
  'admin_max_weekly_shifts_limit',
  '`admin_max_weekly_shifts_limit` INT UNSIGNED NOT NULL DEFAULT 3 AFTER `status`'
);

CALL add_column_if_missing(
  'availability_collections',
  'notes',
  '`notes` VARCHAR(500) NULL AFTER `completed_at`'
);

CALL add_column_if_missing(
  'availabilities',
  'submitted_at',
  '`submitted_at` DATETIME NULL AFTER `updated_by`'
);

UPDATE availability_collections
SET title = CASE
  WHEN teaching_week IS NULL THEN CONCAT(DATE_FORMAT(week_start_date, '%Y-%m-%d'), ' availability collection')
  ELSE CONCAT('Teaching Week ', teaching_week, ' availability collection')
END
WHERE title IS NULL;

UPDATE availabilities
SET submitted_at = updated_at
WHERE submitted_at IS NULL;

CALL add_index_if_missing(
  'availability_collections',
  'idx_availability_collections_semester_status_week',
  '(`semester_id`, `status`, `week_start_date`)'
);

CALL add_index_if_missing(
  'availability_collections',
  'idx_availability_collections_status_range',
  '(`status`, `week_start_date`, `week_end_date`)'
);

CALL add_index_if_missing(
  'availabilities',
  'idx_availabilities_collection_user',
  '(`collection_id`, `user_id`)'
);

CALL add_index_if_missing(
  'availabilities',
  'idx_availabilities_user_collection_date',
  '(`user_id`, `collection_id`, `work_date`)'
);

CALL add_index_if_missing(
  'availabilities',
  'idx_availabilities_collection_shift_date_status',
  '(`collection_id`, `shift_template_id`, `work_date`, `status`)'
);

CALL add_index_if_missing(
  'schedules',
  'idx_schedules_collection_status',
  '(`collection_id`, `status`)'
);

CALL add_index_if_missing(
  'schedules',
  'idx_schedules_status_updated_at',
  '(`status`, `updated_at`)'
);

CALL add_index_if_missing(
  'schedule_assignments',
  'idx_schedule_assignments_schedule_slot',
  '(`schedule_id`, `work_date`, `shift_template_id`)'
);

CALL add_index_if_missing(
  'schedule_assignments',
  'idx_schedule_assignments_schedule_user',
  '(`schedule_id`, `user_id`)'
);

CALL add_index_if_missing(
  'swap_requests',
  'idx_swap_requests_requester_status',
  '(`requester_id`, `status`)'
);

CALL add_index_if_missing(
  'swap_requests',
  'idx_swap_requests_target_user_status',
  '(`target_user_id`, `status`)'
);

CALL add_index_if_missing(
  'overtime_records',
  'idx_overtime_records_assignment_status',
  '(`assignment_id`, `status`)'
);

CALL add_index_if_missing(
  'notifications',
  'idx_notifications_recipient_created',
  '(`recipient_user_id`, `created_at`)'
);

CALL add_index_if_missing(
  'notifications',
  'idx_notifications_related_entity',
  '(`related_entity_type`, `related_entity_id`)'
);

CALL add_index_if_missing(
  'exported_files',
  'idx_exported_files_generated_by_time',
  '(`generated_by`, `generated_at`)'
);

CALL add_index_if_missing(
  'exported_files',
  'idx_exported_files_type_time',
  '(`export_type`, `generated_at`)'
);

DROP PROCEDURE IF EXISTS add_column_if_missing;
DROP PROCEDURE IF EXISTS add_index_if_missing;

INSERT INTO schema_migrations (version, description)
VALUES ('002', 'refine core query support')
ON DUPLICATE KEY UPDATE
  description = VALUES(description);
