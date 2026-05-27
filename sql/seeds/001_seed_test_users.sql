SET NAMES utf8mb4;

USE psych_scheduler;

ALTER TABLE users
  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  MODIFY name VARCHAR(64) NOT NULL,
  MODIFY college VARCHAR(128) NOT NULL,
  MODIFY grade VARCHAR(32) NOT NULL;

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
  ('test-admin', '19318109', '管理员入口', 'male', '心理中心', '2023', 'manager_assistant', 'admin', 'active', 1, 1),
  ('test-assistant-a', 'A0001', '助理入口 A', 'female', '心理学院', '2024', 'new_assistant', 'assistant', 'active', 0, 0),
  ('test-assistant-b', 'A0002', '助理入口 B', 'male', '教育学院', '2023', 'senior_assistant', 'assistant', 'active', 1, 1),
  ('test-assistant-c', 'A0003', '助理入口 C', 'female', '社会学院', '2022', 'senior_assistant', 'assistant', 'active', 1, 0)
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

INSERT INTO shift_templates (
  name,
  start_time,
  end_time,
  default_required_count,
  min_count,
  allow_solo,
  sort_order,
  is_active
) VALUES
  ('上午班', '08:30:00', '13:00:00', 2, 1, 0, 1, 1),
  ('下午班', '13:00:00', '17:30:00', 2, 1, 0, 2, 1)
ON DUPLICATE KEY UPDATE
  default_required_count = VALUES(default_required_count),
  min_count = VALUES(min_count),
  allow_solo = VALUES(allow_solo),
  sort_order = VALUES(sort_order),
  is_active = VALUES(is_active);

INSERT INTO system_settings (
  setting_key,
  setting_value,
  description
) VALUES
  ('max_weekly_shifts_limit', '3', '管理员设置的每人每周最高排班数上限'),
  ('default_workdays', '["monday","tuesday","wednesday","thursday","friday"]', '默认工作日为周一至周五，调休补班通过 workday_overrides 维护'),
  ('default_shift_required_count', '2', '默认每班人数')
ON DUPLICATE KEY UPDATE
  setting_value = VALUES(setting_value),
  description = VALUES(description);
