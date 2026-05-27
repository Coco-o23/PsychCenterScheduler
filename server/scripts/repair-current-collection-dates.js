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
  const todayArg = argv.find((item) => item.startsWith('--today='));

  return {
    apply,
    today: todayArg ? todayArg.slice('--today='.length) : null,
  };
}

function padDatePart(value) {
  return String(value).padStart(2, '0');
}

function toDateOnly(value) {
  return `${value.getFullYear()}-${padDatePart(value.getMonth() + 1)}-${padDatePart(value.getDate())}`;
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

  if (toDateOnly(parsed) !== dateText) {
    return null;
  }

  return parsed;
}

function addDays(dateText, offsetDays) {
  const date = parseDateOnly(dateText);

  if (!date) {
    throw new Error(`Invalid date text: ${dateText}`);
  }

  date.setDate(date.getDate() + offsetDays);
  return toDateOnly(date);
}

function diffDays(dateFrom, dateTo) {
  const from = parseDateOnly(dateFrom);
  const to = parseDateOnly(dateTo);

  if (!from || !to) {
    throw new Error(`Invalid date range: ${dateFrom} -> ${dateTo}`);
  }

  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function getWeekday(dateText) {
  const date = parseDateOnly(dateText);

  if (!date) {
    throw new Error(`Invalid date text: ${dateText}`);
  }

  const weekday = date.getDay();
  return weekday === 0 ? 7 : weekday;
}

function getWeekdayName(weekday) {
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][weekday - 1] ?? `Day ${weekday}`;
}

function clampTeachingWeek(value, totalWeeks) {
  if (value < 1) {
    return 1;
  }

  if (value > totalWeeks) {
    return totalWeeks;
  }

  return value;
}

function calculateCurrentTeachingWeek(firstWeekStartDate, totalWeeks, todayText) {
  const today = parseDateOnly(todayText);
  const semesterStart = parseDateOnly(firstWeekStartDate);

  if (!today || !semesterStart) {
    throw new Error('Invalid date input when calculating current teaching week.');
  }

  const elapsedDays = Math.floor((today.getTime() - semesterStart.getTime()) / 86400000);

  if (elapsedDays < 0) {
    return null;
  }

  const teachingWeek = Math.floor(elapsedDays / 7) + 1;
  return teachingWeek <= totalWeeks ? teachingWeek : null;
}

function logSection(title) {
  console.log(`\n[${title}]`);
}

function describeCollection(row) {
  return `collectionId=${row.collection_id}, teachingWeek=${row.teaching_week}, status=${row.status}, week=${toDateOnly(row.week_start_date)} ~ ${toDateOnly(row.week_end_date)}`;
}

async function fetchCurrentSemester(connection) {
  const [rows] = await connection.query(
    `
      SELECT
        semester_id,
        name,
        first_week_start_date,
        total_weeks
      FROM semesters
      WHERE is_current = 1
      ORDER BY updated_at DESC
      LIMIT 1
    `,
  );

  return rows[0] ?? null;
}

async function fetchCandidateCollections(connection, semesterId, teachingWeek) {
  const [rows] = await connection.query(
    `
      SELECT
        collection_id,
        semester_id,
        title,
        week_start_date,
        week_end_date,
        teaching_week,
        status,
        total_users,
        submitted_users,
        published_at,
        completed_at
      FROM availability_collections
      WHERE semester_id = ?
        AND teaching_week = ?
      ORDER BY collection_id DESC
    `,
    [semesterId, teachingWeek],
  );

  return rows;
}

async function fetchConflictingCollection(connection, expectedWeekStartDate, expectedWeekEndDate, targetCollectionId) {
  const [rows] = await connection.query(
    `
      SELECT collection_id
      FROM availability_collections
      WHERE week_start_date = ?
        AND week_end_date = ?
        AND collection_id <> ?
      LIMIT 1
    `,
    [expectedWeekStartDate, expectedWeekEndDate, targetCollectionId],
  );

  return rows[0] ?? null;
}

async function fetchImpactSummary(connection, collectionId) {
  const [[availabilitySummary]] = await connection.query(
    `
      SELECT
        COUNT(*) AS availability_count,
        MIN(work_date) AS min_work_date,
        MAX(work_date) AS max_work_date
      FROM availabilities
      WHERE collection_id = ?
    `,
    [collectionId],
  );

  const [scheduleRows] = await connection.query(
    `
      SELECT
        schedule_id,
        week_start_date,
        week_end_date,
        status
      FROM schedules
      WHERE collection_id = ?
      ORDER BY schedule_id ASC
    `,
    [collectionId],
  );

  const [[assignmentSummary]] = await connection.query(
    `
      SELECT
        COUNT(*) AS assignment_count,
        MIN(sa.work_date) AS min_work_date,
        MAX(sa.work_date) AS max_work_date
      FROM schedule_assignments sa
      INNER JOIN schedules s ON s.schedule_id = sa.schedule_id
      WHERE s.collection_id = ?
    `,
    [collectionId],
  );

  return {
    availabilitySummary,
    scheduleRows,
    assignmentSummary,
  };
}

async function shiftDatesWithTempOffset(connection, collectionId, deltaDays) {
  if (deltaDays === 0) {
    return;
  }

  const tempOffset = deltaDays >= 0 ? 14 : -14;
  const finalOffset = deltaDays - tempOffset;

  await connection.query(
    `
      UPDATE availabilities
      SET work_date = DATE_ADD(work_date, INTERVAL ? DAY)
      WHERE collection_id = ?
    `,
    [tempOffset, collectionId],
  );

  await connection.query(
    `
      UPDATE schedule_assignments sa
      INNER JOIN schedules s ON s.schedule_id = sa.schedule_id
      SET sa.work_date = DATE_ADD(sa.work_date, INTERVAL ? DAY)
      WHERE s.collection_id = ?
    `,
    [tempOffset, collectionId],
  );

  await connection.query(
    `
      UPDATE availabilities
      SET work_date = DATE_ADD(work_date, INTERVAL ? DAY)
      WHERE collection_id = ?
    `,
    [finalOffset, collectionId],
  );

  await connection.query(
    `
      UPDATE schedule_assignments sa
      INNER JOIN schedules s ON s.schedule_id = sa.schedule_id
      SET sa.work_date = DATE_ADD(sa.work_date, INTERVAL ? DAY)
      WHERE s.collection_id = ?
    `,
    [finalOffset, collectionId],
  );
}

async function repairCurrentCollectionDates() {
  const args = parseArgs(process.argv.slice(2));
  const dbConfig = loadEnv();
  const connection = await mysql.createConnection(dbConfig);

  try {
    const semester = await fetchCurrentSemester(connection);

    if (!semester) {
      throw new Error('No current semester is configured.');
    }

    const semesterStartDate = toDateOnly(semester.first_week_start_date);
    const semesterStartWeekday = getWeekday(semesterStartDate);

    if (semesterStartWeekday !== 1) {
      throw new Error(
        `Current semester first_week_start_date is ${semesterStartDate} (${getWeekdayName(semesterStartWeekday)}). Please correct the semester start date to a Monday before repairing the current collection.`,
      );
    }

    const todayText = args.today ?? toDateOnly(new Date());
    const currentTeachingWeek = calculateCurrentTeachingWeek(
      semesterStartDate,
      semester.total_weeks,
      todayText,
    );
    const targetTeachingWeek = clampTeachingWeek((currentTeachingWeek ?? 0) + 1, semester.total_weeks);
    const expectedWeekStartDate = addDays(semesterStartDate, (targetTeachingWeek - 1) * 7);
    const expectedWeekEndDate = addDays(expectedWeekStartDate, 6);

    logSection('Target');
    console.log(`today=${todayText}`);
    console.log(`semester=${semester.name}`);
    console.log(`firstWeekStartDate=${semesterStartDate}`);
    console.log(`targetTeachingWeek=${targetTeachingWeek}`);
    console.log(`expectedWeek=${expectedWeekStartDate} ~ ${expectedWeekEndDate}`);

    const candidateCollections = await fetchCandidateCollections(
      connection,
      semester.semester_id,
      targetTeachingWeek,
    );

    if (candidateCollections.length === 0) {
      logSection('Result');
      console.log('No availability collection was found for the current target teaching week. Nothing was changed.');
      return;
    }

    if (candidateCollections.length > 1) {
      logSection('Ambiguous');
      candidateCollections.forEach((row) => {
        console.log(describeCollection(row));
      });
      throw new Error('More than one collection matches the current semester + teaching week. Please resolve manually before running this repair.');
    }

    const collection = candidateCollections[0];
    const actualWeekStartDate = toDateOnly(collection.week_start_date);
    const actualWeekEndDate = toDateOnly(collection.week_end_date);

    logSection('Current Collection');
    console.log(describeCollection(collection));

    const conflictingCollection = await fetchConflictingCollection(
      connection,
      expectedWeekStartDate,
      expectedWeekEndDate,
      collection.collection_id,
    );

    if (conflictingCollection) {
      throw new Error(
        `Another collection (${conflictingCollection.collection_id}) already uses the expected week range ${expectedWeekStartDate} ~ ${expectedWeekEndDate}. Aborting to avoid a unique key conflict.`,
      );
    }

    const deltaDays = diffDays(actualWeekStartDate, expectedWeekStartDate);
    const impactSummary = await fetchImpactSummary(connection, collection.collection_id);

    logSection('Impact');
    console.log(
      `availabilities=${impactSummary.availabilitySummary.availability_count}, range=${impactSummary.availabilitySummary.min_work_date ? toDateOnly(impactSummary.availabilitySummary.min_work_date) : 'N/A'} ~ ${impactSummary.availabilitySummary.max_work_date ? toDateOnly(impactSummary.availabilitySummary.max_work_date) : 'N/A'}`,
    );
    console.log(`schedules=${impactSummary.scheduleRows.length}`);
    impactSummary.scheduleRows.forEach((row) => {
      console.log(
        `  scheduleId=${row.schedule_id}, status=${row.status}, week=${toDateOnly(row.week_start_date)} ~ ${toDateOnly(row.week_end_date)}`,
      );
    });
    console.log(
      `scheduleAssignments=${impactSummary.assignmentSummary.assignment_count}, range=${impactSummary.assignmentSummary.min_work_date ? toDateOnly(impactSummary.assignmentSummary.min_work_date) : 'N/A'} ~ ${impactSummary.assignmentSummary.max_work_date ? toDateOnly(impactSummary.assignmentSummary.max_work_date) : 'N/A'}`,
    );

    if (deltaDays === 0 && actualWeekEndDate === expectedWeekEndDate) {
      logSection('Result');
      console.log('The current collection already has the correct week range. Nothing was changed.');
      return;
    }

    logSection('Plan');
    console.log(`deltaDays=${deltaDays}`);
    console.log(`collection week: ${actualWeekStartDate} ~ ${actualWeekEndDate} -> ${expectedWeekStartDate} ~ ${expectedWeekEndDate}`);

    if (!args.apply) {
      logSection('Dry Run');
      console.log('No database changes were made. Re-run with --apply to perform the repair.');
      return;
    }

    await connection.beginTransaction();

    await connection.query(
      `
        UPDATE availability_collections
        SET
          week_start_date = ?,
          week_end_date = ?
        WHERE collection_id = ?
      `,
      [expectedWeekStartDate, expectedWeekEndDate, collection.collection_id],
    );

    await connection.query(
      `
        UPDATE schedules
        SET
          week_start_date = ?,
          week_end_date = ?
        WHERE collection_id = ?
      `,
      [expectedWeekStartDate, expectedWeekEndDate, collection.collection_id],
    );

    await shiftDatesWithTempOffset(connection, collection.collection_id, deltaDays);

    await connection.commit();

    logSection('Done');
    console.log(`Repaired collection ${collection.collection_id}.`);
    console.log(`Updated week range to ${expectedWeekStartDate} ~ ${expectedWeekEndDate}.`);
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // Ignore rollback errors when no transaction is active.
    }

    throw error;
  } finally {
    await connection.end();
  }
}

repairCurrentCollectionDates().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Repair failed: ${message}`);
  process.exit(1);
});
