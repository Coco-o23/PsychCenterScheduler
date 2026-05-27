SET NAMES utf8mb4;

USE psych_scheduler;

INSERT INTO users (
  test_identity_key,
  student_id,
  name,
  gender,
  college,
  grade,
  member_type,
  role,
  account_status,
  can_solo_shift,
  reliability_tag
) VALUES
  ('test-disabled-assistant', 'A0004', 'Disabled Assistant', 'female', 'Psychology School', '2024', 'new_assistant', 'assistant', 'disabled', 0, 0),
  (NULL, 'A0005', 'Unbound Assistant', 'male', 'Education School', '2023', 'intern_assistant', 'assistant', 'pending', 0, 0)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  gender = VALUES(gender),
  college = VALUES(college),
  grade = VALUES(grade),
  member_type = VALUES(member_type),
  role = VALUES(role),
  account_status = VALUES(account_status),
  can_solo_shift = VALUES(can_solo_shift),
  reliability_tag = VALUES(reliability_tag);

INSERT INTO semesters (
  name,
  first_week_start_date,
  total_weeks,
  grade_update_status,
  is_current
) VALUES
  ('2026 Spring Semester', '2026-03-02', 18, 'confirmed', 1)
ON DUPLICATE KEY UPDATE
  first_week_start_date = VALUES(first_week_start_date),
  total_weeks = VALUES(total_weeks),
  grade_update_status = VALUES(grade_update_status),
  is_current = VALUES(is_current);

UPDATE semesters
SET is_current = CASE
  WHEN name = '2026 Spring Semester' THEN 1
  ELSE 0
END;

SET @admin_user_id := (
  SELECT user_id
  FROM users
  WHERE test_identity_key = 'test-admin'
  LIMIT 1
);

SET @assistant_a_user_id := (
  SELECT user_id
  FROM users
  WHERE test_identity_key = 'test-assistant-a'
  LIMIT 1
);

SET @assistant_b_user_id := (
  SELECT user_id
  FROM users
  WHERE test_identity_key = 'test-assistant-b'
  LIMIT 1
);

SET @assistant_c_user_id := (
  SELECT user_id
  FROM users
  WHERE test_identity_key = 'test-assistant-c'
  LIMIT 1
);

SET @disabled_user_id := (
  SELECT user_id
  FROM users
  WHERE student_id = 'A0004'
  LIMIT 1
);

SET @current_semester_id := (
  SELECT semester_id
  FROM semesters
  WHERE name = '2026 Spring Semester'
  LIMIT 1
);

INSERT INTO workday_overrides (
  work_date,
  override_type,
  reason,
  created_by
) VALUES
  ('2026-05-23', 'workday', 'Saturday makeup workday for holiday adjustment', @admin_user_id),
  ('2026-05-25', 'no_shift', 'Center closed for teacher training', @admin_user_id)
ON DUPLICATE KEY UPDATE
  override_type = VALUES(override_type),
  reason = VALUES(reason),
  created_by = VALUES(created_by);

INSERT INTO system_settings (
  setting_key,
  setting_value,
  description,
  updated_by
) VALUES
  (
    'schedule_rule_flags',
    '{"crossCollegePreferred": true, "crossGradePreferred": true, "genderBalancePreferred": true, "seniorWithNewPreferred": true}',
    'Rule preference snapshot for schedule generation',
    @admin_user_id
  ),
  (
    'default_shift_min_count',
    '1',
    'Default minimum number of assistants per shift',
    @admin_user_id
  )
ON DUPLICATE KEY UPDATE
  setting_value = VALUES(setting_value),
  description = VALUES(description),
  updated_by = VALUES(updated_by);

INSERT INTO availability_collections (
  title,
  semester_id,
  week_start_date,
  week_end_date,
  teaching_week,
  status,
  admin_max_weekly_shifts_limit,
  total_users,
  submitted_users,
  created_by,
  published_at,
  completed_at,
  notes
) VALUES
  (
    'Week 11 pending collection',
    @current_semester_id,
    '2026-05-18',
    '2026-05-22',
    11,
    'pending',
    3,
    4,
    0,
    @admin_user_id,
    NULL,
    NULL,
    'Validation data for pending collection'
  ),
  (
    'Week 12 active collection',
    @current_semester_id,
    '2026-05-25',
    '2026-05-29',
    12,
    'active',
    3,
    4,
    3,
    @admin_user_id,
    '2026-05-20 09:00:00',
    NULL,
    'Validation data for active collection'
  ),
  (
    'Week 13 completed collection',
    @current_semester_id,
    '2026-06-01',
    '2026-06-05',
    13,
    'completed',
    3,
    4,
    4,
    @admin_user_id,
    '2026-05-27 09:00:00',
    '2026-05-29 20:00:00',
    'Validation data for completed collection'
  )
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  semester_id = VALUES(semester_id),
  teaching_week = VALUES(teaching_week),
  status = VALUES(status),
  admin_max_weekly_shifts_limit = VALUES(admin_max_weekly_shifts_limit),
  total_users = VALUES(total_users),
  submitted_users = VALUES(submitted_users),
  created_by = VALUES(created_by),
  published_at = VALUES(published_at),
  completed_at = VALUES(completed_at),
  notes = VALUES(notes);

SET @active_collection_id := (
  SELECT collection_id
  FROM availability_collections
  WHERE week_start_date = '2026-05-25'
    AND week_end_date = '2026-05-29'
  LIMIT 1
);

SET @completed_collection_id := (
  SELECT collection_id
  FROM availability_collections
  WHERE week_start_date = '2026-06-01'
    AND week_end_date = '2026-06-05'
  LIMIT 1
);

SET @morning_shift_id := (
  SELECT shift_template_id
  FROM shift_templates
  WHERE name = '上午班'
  LIMIT 1
);

SET @afternoon_shift_id := (
  SELECT shift_template_id
  FROM shift_templates
  WHERE name = '下午班'
  LIMIT 1
);

INSERT INTO availabilities (
  collection_id,
  user_id,
  work_date,
  shift_template_id,
  status,
  max_weekly_shifts,
  is_week_leave,
  is_manual_added,
  updated_by,
  submitted_at
) VALUES
  (@active_collection_id, @assistant_a_user_id, '2026-05-26', @morning_shift_id, 'available', 2, 0, 0, @assistant_a_user_id, '2026-05-20 10:00:00'),
  (@active_collection_id, @assistant_a_user_id, '2026-05-26', @afternoon_shift_id, 'unavailable', 2, 0, 0, @assistant_a_user_id, '2026-05-20 10:00:00'),
  (@active_collection_id, @assistant_b_user_id, '2026-05-26', @morning_shift_id, 'available', 3, 0, 0, @assistant_b_user_id, '2026-05-20 10:10:00'),
  (@active_collection_id, @assistant_b_user_id, '2026-05-26', @afternoon_shift_id, 'available', 3, 0, 0, @assistant_b_user_id, '2026-05-20 10:10:00'),
  (@active_collection_id, @assistant_c_user_id, '2026-05-26', @morning_shift_id, 'unavailable', 1, 1, 0, @assistant_c_user_id, '2026-05-20 10:20:00'),
  (@active_collection_id, @assistant_c_user_id, '2026-05-26', @afternoon_shift_id, 'unavailable', 1, 1, 0, @assistant_c_user_id, '2026-05-20 10:20:00')
ON DUPLICATE KEY UPDATE
  status = VALUES(status),
  max_weekly_shifts = VALUES(max_weekly_shifts),
  is_week_leave = VALUES(is_week_leave),
  is_manual_added = VALUES(is_manual_added),
  updated_by = VALUES(updated_by),
  submitted_at = VALUES(submitted_at);

INSERT INTO availabilities (
  collection_id,
  user_id,
  work_date,
  shift_template_id,
  status,
  max_weekly_shifts,
  is_week_leave,
  is_manual_added,
  updated_by,
  submitted_at
) VALUES
  (@completed_collection_id, @assistant_a_user_id, '2026-06-02', @morning_shift_id, 'available', 2, 0, 0, @assistant_a_user_id, '2026-05-28 09:00:00'),
  (@completed_collection_id, @assistant_b_user_id, '2026-06-02', @morning_shift_id, 'available', 3, 0, 0, @assistant_b_user_id, '2026-05-28 09:05:00')
ON DUPLICATE KEY UPDATE
  status = VALUES(status),
  max_weekly_shifts = VALUES(max_weekly_shifts),
  is_week_leave = VALUES(is_week_leave),
  is_manual_added = VALUES(is_manual_added),
  updated_by = VALUES(updated_by),
  submitted_at = VALUES(submitted_at);

INSERT INTO schedules (
  collection_id,
  week_start_date,
  week_end_date,
  status,
  risk_summary,
  confirmed_by,
  confirmed_at
)
SELECT
  @completed_collection_id,
  '2026-06-01',
  '2026-06-05',
  'draft',
  'Need review for afternoon staffing coverage',
  NULL,
  NULL
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1
  FROM schedules
  WHERE collection_id = @completed_collection_id
    AND week_start_date = '2026-06-01'
    AND week_end_date = '2026-06-05'
    AND status = 'draft'
);

SET @draft_schedule_id := (
  SELECT schedule_id
  FROM schedules
  WHERE collection_id = @completed_collection_id
    AND week_start_date = '2026-06-01'
    AND week_end_date = '2026-06-05'
  ORDER BY schedule_id DESC
  LIMIT 1
);

INSERT INTO schedule_assignments (
  schedule_id,
  work_date,
  shift_template_id,
  user_id,
  assignment_source,
  risk_tags,
  notes,
  created_by
) VALUES
  (@draft_schedule_id, '2026-06-02', @morning_shift_id, @assistant_a_user_id, 'auto', 'cross_college_preferred_not_met', 'Seeded draft assignment', @admin_user_id),
  (@draft_schedule_id, '2026-06-02', @morning_shift_id, @assistant_b_user_id, 'manual', 'none', 'Manual balancing example', @admin_user_id)
ON DUPLICATE KEY UPDATE
  assignment_source = VALUES(assignment_source),
  risk_tags = VALUES(risk_tags),
  notes = VALUES(notes),
  created_by = VALUES(created_by);

SET @assistant_a_assignment_id := (
  SELECT assignment_id
  FROM schedule_assignments
  WHERE schedule_id = @draft_schedule_id
    AND work_date = '2026-06-02'
    AND shift_template_id = @morning_shift_id
    AND user_id = @assistant_a_user_id
  LIMIT 1
);

SET @assistant_b_assignment_id := (
  SELECT assignment_id
  FROM schedule_assignments
  WHERE schedule_id = @draft_schedule_id
    AND work_date = '2026-06-02'
    AND shift_template_id = @morning_shift_id
    AND user_id = @assistant_b_user_id
  LIMIT 1
);

INSERT INTO swap_requests (
  requester_id,
  original_assignment_id,
  target_user_id,
  target_assignment_id,
  reason,
  status,
  peer_confirmed_at,
  reviewed_by,
  reviewed_at,
  review_note
)
SELECT
  @assistant_a_user_id,
  @assistant_a_assignment_id,
  @assistant_b_user_id,
  @assistant_b_assignment_id,
  'Need to attend a class presentation',
  'pending_admin',
  '2026-05-29 11:00:00',
  NULL,
  NULL,
  NULL
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1
  FROM swap_requests
  WHERE requester_id = @assistant_a_user_id
    AND original_assignment_id = @assistant_a_assignment_id
    AND status = 'pending_admin'
);

INSERT INTO overtime_records (
  user_id,
  assignment_id,
  duration_minutes,
  reason,
  status,
  reviewed_by,
  reviewed_at,
  review_note
)
SELECT
  @assistant_b_user_id,
  @assistant_b_assignment_id,
  45,
  'Stayed late to finish reception summary',
  'approved',
  @admin_user_id,
  '2026-06-02 18:30:00',
  'Approved during validation seeding'
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1
  FROM overtime_records
  WHERE user_id = @assistant_b_user_id
    AND assignment_id = @assistant_b_assignment_id
    AND status = 'approved'
);

INSERT INTO notifications (
  recipient_user_id,
  type,
  title,
  content,
  related_entity_type,
  related_entity_id,
  read_at
)
SELECT
  @assistant_a_user_id,
  'manual_assignment',
  'Schedule adjusted',
  'You were manually added to a validation schedule assignment.',
  'schedule_assignment',
  @assistant_a_assignment_id,
  NULL
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1
  FROM notifications
  WHERE recipient_user_id = @assistant_a_user_id
    AND type = 'manual_assignment'
    AND related_entity_type = 'schedule_assignment'
    AND related_entity_id = @assistant_a_assignment_id
);

INSERT INTO operation_logs (
  actor_user_id,
  action,
  entity_type,
  entity_id,
  result,
  detail
)
SELECT
  @admin_user_id,
  'publish_collection',
  'availability_collection',
  @active_collection_id,
  'success',
  'Seeded validation log for active collection publishing.'
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1
  FROM operation_logs
  WHERE actor_user_id = @admin_user_id
    AND action = 'publish_collection'
    AND entity_type = 'availability_collection'
    AND entity_id = @active_collection_id
    AND result = 'success'
);

INSERT INTO exported_files (
  schedule_id,
  export_type,
  file_name,
  local_path,
  generated_by
)
SELECT
  @draft_schedule_id,
  'excel',
  'schedule-2026-06-01.xlsx',
  'exports/schedule-2026-06-01.xlsx',
  @admin_user_id
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1
  FROM exported_files
  WHERE schedule_id = @draft_schedule_id
    AND export_type = 'excel'
    AND file_name = 'schedule-2026-06-01.xlsx'
);
