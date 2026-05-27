# Migration Records

Record each manually executed SQL migration here during development and deployment.

Suggested record format:

```text
YYYY-MM-DD HH:mm
environment: local | staging | production
database: psych_scheduler
executed:
- migrations/001_create_core_tables.sql
- migrations/002_refine_core_query_support.sql
- seeds/001_seed_test_users.sql
- seeds/002_seed_stage4_validation_data.sql
operator: name
result: success | failed
notes:
```

The database also contains a `schema_migrations` table for machine-readable migration markers.
