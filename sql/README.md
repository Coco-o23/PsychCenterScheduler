# SQL Script Guide

This directory stores MySQL scripts for the local `psych_scheduler` database.

## Directory Layout

- `migrations/`: ordered schema migration scripts.
- `seeds/`: ordered seed data scripts.
- `migration_records/`: human-readable migration execution records.

## Execution Order

Run scripts in numeric order:

1. `migrations/001_create_core_tables.sql`
2. `migrations/002_refine_core_query_support.sql`
3. `seeds/001_seed_test_users.sql`
4. `seeds/002_seed_stage4_validation_data.sql`

Example:

```powershell
mysql -u root -p < sql/migrations/001_create_core_tables.sql
mysql -u root -p < sql/migrations/002_refine_core_query_support.sql
mysql -u root -p < sql/seeds/001_seed_test_users.sql
mysql -u root -p < sql/seeds/002_seed_stage4_validation_data.sql
```

## Repeat Strategy

Schema scripts use `CREATE TABLE IF NOT EXISTS`.

Seed scripts use stable unique keys and `ON DUPLICATE KEY UPDATE`, so repeated execution updates the known test records instead of creating duplicates.

Migration `002_refine_core_query_support.sql` uses metadata checks against `information_schema` before adding columns and indexes, so it can be re-run without re-adding the same structural refinements.

## Stage Four Validation Hints

The stage four validation seed adds:

- one disabled assistant and one unbound assistant record;
- one current semester;
- one makeup workday override and one no-shift override;
- one pending collection, one active collection, and one completed collection;
- sample availabilities, one draft schedule, assignments, a swap request, an approved overtime record, a notification, an operation log, and an exported file record.

Suggested verification queries:

```sql
SELECT student_id, role, account_status, test_identity_key
FROM users
ORDER BY student_id;

SELECT title, teaching_week, status, admin_max_weekly_shifts_limit
FROM availability_collections
ORDER BY week_start_date;

SELECT collection_id, user_id, work_date, shift_template_id, status, submitted_at
FROM availabilities
ORDER BY collection_id, user_id, work_date, shift_template_id;

SELECT schedule_id, week_start_date, status, risk_summary
FROM schedules
ORDER BY schedule_id;

SELECT requester_id, status, target_user_id
FROM swap_requests
ORDER BY swap_request_id;

SELECT user_id, status, duration_minutes
FROM overtime_records
ORDER BY overtime_id;
```
