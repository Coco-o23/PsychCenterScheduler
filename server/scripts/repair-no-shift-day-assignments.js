const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');

  if (!fs.existsSync(envPath)) {
    throw new Error('Missing server/.env. Create it from server/.env.example before running this script.');
  }

  dotenv.config({ path: envPath });

  const requiredKeys = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];

  for (const key of requiredKeys) {
    if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };
}

function parseArgs(argv) {
  const apply = argv.includes('--apply');
  const dateArg = argv.find((item) => item.startsWith('--date='));
  const scheduleArg = argv.find((item) => item.startsWith('--schedule-id='));
  const collectionArg = argv.find((item) => item.startsWith('--collection-id='));

  return {
    apply,
    workDate: dateArg ? dateArg.slice('--date='.length) : null,
    scheduleId: scheduleArg ? Number(scheduleArg.slice('--schedule-id='.length)) : null,
    collectionId: collectionArg ? Number(collectionArg.slice('--collection-id='.length)) : null,
  };
}

function parseDateOnly(dateText) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    return null;
  }

  const [yearText, monthText, dayText] = dateText.split('-');
  const parsed = new Date(Number(yearText), Number(monthText) - 1, Number(dayText));

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const normalized = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  return normalized === dateText ? parsed : null;
}

function assertInteger(value, fieldName) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid ${fieldName}.`);
  }
}

function logSection(title) {
  console.log(`\n[${title}]`);
}

function parseDraftStore(riskSummaryText) {
  if (!riskSummaryText) {
    return null;
  }

  const parsed = JSON.parse(riskSummaryText);

  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.plans)) {
    return null;
  }

  return parsed;
}

async function findTargetSchedule(connection, args) {
  if (args.scheduleId !== null) {
    assertInteger(args.scheduleId, 'schedule-id');
    const [rows] = await connection.query(
      `
        SELECT
          schedule_id,
          collection_id,
          week_start_date,
          week_end_date,
          status,
          risk_summary
        FROM schedules
        WHERE schedule_id = ?
        LIMIT 1
      `,
      [args.scheduleId],
    );

    return rows[0] ?? null;
  }

  if (args.collectionId !== null) {
    assertInteger(args.collectionId, 'collection-id');
    const [rows] = await connection.query(
      `
        SELECT
          schedule_id,
          collection_id,
          week_start_date,
          week_end_date,
          status,
          risk_summary
        FROM schedules
        WHERE collection_id = ?
          AND status IN ('published', 'adjusted')
        ORDER BY schedule_id DESC
        LIMIT 1
      `,
      [args.collectionId],
    );

    return rows[0] ?? null;
  }

  const [rows] = await connection.query(
    `
      SELECT
        schedule_id,
        collection_id,
        week_start_date,
        week_end_date,
        status,
        risk_summary
      FROM schedules
      WHERE ? BETWEEN week_start_date AND week_end_date
        AND status IN ('published', 'adjusted')
      ORDER BY schedule_id DESC
      LIMIT 2
    `,
    [args.workDate],
  );

  if (rows.length > 1) {
    throw new Error(`Found multiple published/adjusted schedules covering ${args.workDate}. Pass --schedule-id to disambiguate.`);
  }

  return rows[0] ?? null;
}

function findSelectedPlan(draftStore) {
  if (!draftStore || !Array.isArray(draftStore.plans) || draftStore.plans.length === 0) {
    return null;
  }

  if (draftStore.selectedStrategyKey) {
    const selected = draftStore.plans.find((item) => item.strategyKey === draftStore.selectedStrategyKey);

    if (selected) {
      return selected;
    }
  }

  return draftStore.plans[0] ?? null;
}

async function listExistingAssignments(connection, scheduleId, workDate) {
  const [rows] = await connection.query(
    `
      SELECT
        assignment_id,
        work_date,
        shift_template_id,
        user_id,
        assignment_source,
        risk_tags,
        notes
      FROM schedule_assignments
      WHERE schedule_id = ?
        AND work_date = ?
      ORDER BY shift_template_id ASC, user_id ASC
    `,
    [scheduleId, workDate],
  );

  return rows;
}

function buildExpectedAssignments(plan, workDate) {
  return plan.slots
    .filter((slot) => slot.workDate === workDate)
    .flatMap((slot) =>
      (slot.assignedMembers ?? []).map((member) => ({
        workDate,
        shiftTemplateId: slot.shiftTemplateId,
        userId: member.userId,
        assignmentSource: member.assignmentSource ?? 'auto',
        riskTags: slot.riskTags ?? [],
        notes: member.notes ?? null,
      })),
    );
}

function buildKey(item) {
  return `${item.workDate}-${item.shiftTemplateId}-${item.userId}`;
}

function diffAssignments(expected, existing) {
  const existingKeySet = new Set(existing.map((item) => buildKey({
    workDate: item.work_date instanceof Date
      ? `${item.work_date.getFullYear()}-${String(item.work_date.getMonth() + 1).padStart(2, '0')}-${String(item.work_date.getDate()).padStart(2, '0')}`
      : item.work_date,
    shiftTemplateId: item.shift_template_id,
    userId: item.user_id,
  })));

  const missing = expected.filter((item) => !existingKeySet.has(buildKey(item)));
  return { missing };
}

async function insertMissingAssignments(connection, scheduleId, missingAssignments) {
  for (const item of missingAssignments) {
    await connection.query(
      `
        INSERT INTO schedule_assignments (
          schedule_id,
          work_date,
          shift_template_id,
          user_id,
          assignment_source,
          risk_tags,
          notes,
          created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
      `,
      [
        scheduleId,
        item.workDate,
        item.shiftTemplateId,
        item.userId,
        item.assignmentSource,
        JSON.stringify(item.riskTags),
        item.notes,
      ],
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.workDate || !parseDateOnly(args.workDate)) {
    throw new Error('Usage: node scripts/repair-no-shift-day-assignments.js --date=YYYY-MM-DD [--schedule-id=ID] [--collection-id=ID] [--apply]');
  }

  if (args.scheduleId !== null && args.collectionId !== null) {
    throw new Error('Pass either --schedule-id or --collection-id, not both.');
  }

  const connection = await mysql.createConnection(loadEnv());

  try {
    logSection('Target');
    console.log(`workDate=${args.workDate}`);
    console.log(`mode=${args.apply ? 'apply' : 'dry-run'}`);

    const schedule = await findTargetSchedule(connection, args);

    if (!schedule) {
      throw new Error(`No published/adjusted schedule found for ${args.workDate}.`);
    }

    console.log(`scheduleId=${schedule.schedule_id}, collectionId=${schedule.collection_id}, status=${schedule.status}`);

    const draftStore = parseDraftStore(schedule.risk_summary);
    const selectedPlan = findSelectedPlan(draftStore);

    if (!selectedPlan) {
      throw new Error('This schedule does not contain a recoverable draft plan in risk_summary.');
    }

    const expectedAssignments = buildExpectedAssignments(selectedPlan, args.workDate);
    const existingAssignments = await listExistingAssignments(connection, schedule.schedule_id, args.workDate);

    logSection('Inspection');
    console.log(`expectedAssignments=${expectedAssignments.length}`);
    console.log(`existingAssignments=${existingAssignments.length}`);

    if (expectedAssignments.length === 0) {
      console.log('The selected plan has no assignments for this date. Nothing to restore.');
      return;
    }

    const { missing } = diffAssignments(expectedAssignments, existingAssignments);

    if (missing.length === 0) {
      console.log('No missing assignments found for this date.');
      return;
    }

    console.log(`missingAssignments=${missing.length}`);
    missing.forEach((item) => {
      console.log(`  restore shiftTemplateId=${item.shiftTemplateId}, userId=${item.userId}, source=${item.assignmentSource}`);
    });

    if (!args.apply) {
      logSection('Dry Run');
      console.log('No changes written. Re-run with --apply to restore only the missing assignments above.');
      return;
    }

    await connection.beginTransaction();
    await insertMissingAssignments(connection, schedule.schedule_id, missing);
    await connection.commit();

    logSection('Applied');
    console.log(`Inserted ${missing.length} assignment row(s) for ${args.workDate}.`);
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // ignore rollback errors when no transaction is active
    }

    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
