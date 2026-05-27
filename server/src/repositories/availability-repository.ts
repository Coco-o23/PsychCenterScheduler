import type {
  Pool,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from 'mysql2/promise';
import { AppError } from '../errors/app-error';
import type {
  CollectionDashboardPayload,
  CollectionDashboardSummary,
  CollectionDetailMember,
  CollectionDetailPayload,
  CollectionDetailSlot,
  CollectionFillDay,
  CollectionFillSlot,
  CollectionWeekContext,
  CurrentCollectionFillPayload,
  ManualAvailabilityMutationInput,
  SaveCollectionSubmissionInput,
} from '../models/availability';
import type {
  SchedulerWorkSettings,
  WorkdayOverrideConfiguration,
} from '../models/configuration';
import {
  getCurrentSemester,
  getDefaultAvailabilityConfiguration,
  getSchedulerWorkSettings,
  saveDefaultAvailabilityConfiguration,
} from './configuration-repository';

interface CollectionRow extends RowDataPacket {
  collection_id: number;
  semester_id: number | null;
  title: string;
  week_start_date: Date;
  week_end_date: Date;
  teaching_week: number | null;
  status: 'pending' | 'active' | 'completed';
  total_users: number;
  submitted_users: number;
  published_at: Date | null;
  completed_at: Date | null;
}

interface CollectionScheduleRow extends RowDataPacket {
  schedule_id: number;
  status: 'draft' | 'published' | 'adjusted';
}

interface SubmittedMemberRow extends RowDataPacket {
  user_id: number;
  name: string;
  student_id: string;
}

interface DutyParticipantRow extends RowDataPacket {
  user_id: number;
  student_id: string;
  name: string;
  gender: 'male' | 'female';
  college: string;
  grade: string;
  role: 'assistant' | 'admin' | 'super_admin';
  member_type: 'new_assistant' | 'senior_assistant' | 'intern_assistant' | 'manager_assistant';
  account_status: 'pending' | 'active' | 'rejected' | 'disabled';
  can_solo_shift: 0 | 1;
  reliability_tag: 0 | 1;
}

interface AvailabilityRow extends RowDataPacket {
  work_date: Date;
  weekday: number;
  shift_template_id: number;
  status: 'available' | 'unavailable';
  max_weekly_shifts: number | null;
  is_week_leave: 0 | 1;
  is_manual_added: 0 | 1;
  submitted_at: Date | null;
}

interface DetailMemberRow extends RowDataPacket {
  work_date: Date;
  weekday: number;
  shift_template_id: number;
  user_id: number;
  student_id: string;
  name: string;
  gender: 'male' | 'female';
  college: string;
  grade: string;
  role: 'assistant' | 'admin' | 'super_admin';
  member_type: 'new_assistant' | 'senior_assistant' | 'intern_assistant' | 'manager_assistant';
  can_solo_shift: 0 | 1;
  reliability_tag: 0 | 1;
  is_manual_added: 0 | 1;
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

function parseDateOnly(dateText: string): Date | null {
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

function toDateOnly(value: Date): string {
  return `${value.getFullYear()}-${padDatePart(value.getMonth() + 1)}-${padDatePart(value.getDate())}`;
}

function toDateTime(value: Date | null): string | null {
  if (!value) {
    return null;
  }

  return `${toDateOnly(value)}T${padDatePart(value.getHours())}:${padDatePart(value.getMinutes())}:${padDatePart(value.getSeconds())}`;
}

function addDays(dateText: string, offsetDays: number): string {
  const date = parseDateOnly(dateText);

  if (!date) {
    throw new AppError(500, 'INVALID_DATE', `Invalid date text: ${dateText}`);
  }

  date.setDate(date.getDate() + offsetDays);
  return toDateOnly(date);
}

function getWeekday(dateText: string): number {
  const date = parseDateOnly(dateText);

  if (!date) {
    throw new AppError(500, 'INVALID_DATE', `Invalid date text: ${dateText}`);
  }

  const weekday = date.getDay();
  return weekday === 0 ? 7 : weekday;
}

function getWeekdayLabel(weekday: number): string {
  return WEEKDAY_LABELS[weekday - 1] ?? `Day ${weekday}`;
}

function formatWeekLabel(weekStartDate: string, weekEndDate: string): string {
  return `${weekStartDate} ~ ${weekEndDate}`;
}

function createCollectionTitle(teachingWeek: number): string {
  return `\u7b2c${teachingWeek} \u6559\u5b66\u5468\u7a7a\u95f2\u65f6\u95f4\u6536\u96c6`;
}

function clampTeachingWeek(value: number, totalWeeks: number): number {
  if (value < 1) {
    return 1;
  }

  if (value > totalWeeks) {
    return totalWeeks;
  }

  return value;
}

function computeUpcomingCollectionWeek(
  firstWeekStartDate: string,
  totalWeeks: number,
  currentTeachingWeek: number | null,
): CollectionWeekContext {
  const targetTeachingWeek = clampTeachingWeek((currentTeachingWeek ?? 0) + 1, totalWeeks);
  const weekStartDate = addDays(firstWeekStartDate, (targetTeachingWeek - 1) * 7);
  const weekEndDate = addDays(weekStartDate, 6);

  return {
    teachingWeek: targetTeachingWeek,
    title: createCollectionTitle(targetTeachingWeek),
    weekEndDate,
    weekLabel: formatWeekLabel(weekStartDate, weekEndDate),
    weekStartDate,
  };
}

function buildCollectionDashboardSummary(input: {
  collection: CollectionRow | null;
  totalUsers: number;
  weekContext: CollectionWeekContext | null;
  hasSemesterConfiguration: boolean;
}): CollectionDashboardSummary {
  const { collection, totalUsers, weekContext, hasSemesterConfiguration } = input;

  if (!hasSemesterConfiguration || !weekContext) {
    return {
      collectionId: null,
      status: 'missing_semester',
      title: '\u672a\u914d\u7f6e\u6559\u5b66\u5468',
      teachingWeek: null,
      weekEndDate: null,
      weekLabel: null,
      weekStartDate: null,
      totalUsers: 0,
      submittedUsers: 0,
      progressPercent: 0,
      publishedAt: null,
      completedAt: null,
      canPublish: false,
      hasSemesterConfiguration: false,
    };
  }

  if (!collection) {
    return {
      collectionId: null,
      status: 'pending',
      title: weekContext.title,
      teachingWeek: weekContext.teachingWeek,
      weekEndDate: weekContext.weekEndDate,
      weekLabel: weekContext.weekLabel,
      weekStartDate: weekContext.weekStartDate,
      totalUsers,
      submittedUsers: 0,
      progressPercent: 0,
      publishedAt: null,
      completedAt: null,
      canPublish: true,
      hasSemesterConfiguration: true,
    };
  }

  const progressPercent =
    collection.total_users > 0
      ? Math.round((collection.submitted_users / collection.total_users) * 100)
      : 0;

  return {
    collectionId: collection.collection_id,
    status: collection.status,
    title: collection.title,
    teachingWeek: collection.teaching_week,
    weekEndDate: toDateOnly(collection.week_end_date),
    weekLabel: formatWeekLabel(toDateOnly(collection.week_start_date), toDateOnly(collection.week_end_date)),
    weekStartDate: toDateOnly(collection.week_start_date),
    totalUsers: collection.total_users,
    submittedUsers: collection.submitted_users,
    progressPercent,
    publishedAt: toDateTime(collection.published_at),
    completedAt: toDateTime(collection.completed_at),
    canPublish: false,
    hasSemesterConfiguration: true,
  };
}

function mapShiftTemplates(workSettings: SchedulerWorkSettings): CollectionFillSlot[] {
  return workSettings.shiftTemplates.map((item) => ({
    shiftTemplateId: item.shiftTemplateId,
    shiftLabel: item.name,
    startTime: item.startTime,
    endTime: item.endTime,
  }));
}

function buildWorkDateList(
  weekStartDate: string,
  weeklyWorkdays: number[],
  overrides: WorkdayOverrideConfiguration[],
): CollectionFillDay[] {
  const overrideMap = new Map(overrides.map((item) => [item.workDate, item.overrideType]));
  const result: CollectionFillDay[] = [];

  for (let offset = 0; offset < 7; offset += 1) {
    const workDate = addDays(weekStartDate, offset);
    const weekday = getWeekday(workDate);
    const overrideType = overrideMap.get(workDate);
    const shouldInclude =
      overrideType === 'workday'
        ? true
        : overrideType === 'non_workday' || overrideType === 'no_shift'
          ? false
          : weeklyWorkdays.includes(weekday);

    if (!shouldInclude) {
      continue;
    }

    result.push({
      date: workDate,
      label: getWeekdayLabel(weekday),
      weekday,
    });
  }

  return result;
}

function buildSelectedKeys(
  availabilityRows: AvailabilityRow[],
  slots: CollectionFillSlot[],
  days: CollectionFillDay[],
): string[] {
  const shiftIndexById = new Map(slots.map((item, index) => [item.shiftTemplateId, index]));
  const dayIndexByDate = new Map(days.map((item) => [item.date, item.weekday]));

  return availabilityRows
    .filter((item) => item.status === 'available')
    .map((item) => {
      const workDate = toDateOnly(item.work_date);
      const shiftIndex = shiftIndexById.get(item.shift_template_id);
      const weekday = dayIndexByDate.get(workDate);

      if (shiftIndex === undefined || weekday === undefined) {
        return null;
      }

      return `${shiftIndex}-${weekday}`;
    })
    .filter((item): item is string => item !== null)
    .sort();
}

function parseSelectedKey(selectedKey: string): { shiftIndex: number; weekday: number } | null {
  const [shiftIndexText, weekdayText] = selectedKey.split('-');
  const shiftIndex = Number(shiftIndexText);
  const weekday = Number(weekdayText);

  if (!Number.isInteger(shiftIndex) || !Number.isInteger(weekday)) {
    return null;
  }

  return { shiftIndex, weekday };
}

function computeRiskLabel(
  availableCount: number,
  minCount: number,
): { riskLevel: CollectionDetailSlot['riskLevel']; riskLabel: string } {
  if (availableCount === 0) {
    return {
      riskLevel: 'critical',
      riskLabel: '\u65e0\u4eba\u53ef\u6392',
    };
  }

  if (availableCount < minCount) {
    return {
      riskLevel: 'warning',
      riskLabel: '\u4eba\u6570\u4e0d\u8db3',
    };
  }

  return {
    riskLevel: 'none',
    riskLabel: '',
  };
}

async function listDutyParticipants(
  pool: Pool | PoolConnection,
): Promise<DutyParticipantRow[]> {
  const [rows] = await pool.query<DutyParticipantRow[]>(
    `
      SELECT
        user_id,
        student_id,
        name,
        gender,
        college,
        grade,
        role,
        member_type,
        account_status,
        can_solo_shift,
        reliability_tag
      FROM users
      WHERE account_status = 'active'
        AND role IN ('assistant', 'admin', 'super_admin')
      ORDER BY
        FIELD(role, 'assistant', 'admin', 'super_admin') ASC,
        student_id ASC
    `,
  );

  return rows;
}

async function getCollectionByWeek(
  pool: Pool | PoolConnection,
  weekStartDate: string,
  weekEndDate: string,
): Promise<CollectionRow | null> {
  const [rows] = await pool.query<CollectionRow[]>(
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
      WHERE week_start_date = ?
        AND week_end_date = ?
      LIMIT 1
    `,
    [weekStartDate, weekEndDate],
  );

  return rows[0] ?? null;
}

async function getCollectionById(
  pool: Pool | PoolConnection,
  collectionId: number,
): Promise<CollectionRow | null> {
  const [rows] = await pool.query<CollectionRow[]>(
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
      WHERE collection_id = ?
      LIMIT 1
    `,
    [collectionId],
  );

  return rows[0] ?? null;
}

async function getLatestScheduleByCollectionId(
  pool: Pool | PoolConnection,
  collectionId: number,
): Promise<CollectionScheduleRow | null> {
  const [rows] = await pool.query<CollectionScheduleRow[]>(
    `
      SELECT
        schedule_id,
        status
      FROM schedules
      WHERE collection_id = ?
      ORDER BY schedule_id DESC
      LIMIT 1
    `,
    [collectionId],
  );

  return rows[0] ?? null;
}

function buildCollectionWorkflowState(input: {
  collectionStatus: 'pending' | 'active' | 'completed' | 'none';
  scheduleStatus: 'none' | 'draft' | 'published' | 'adjusted';
}): CurrentCollectionFillPayload['collectionWorkflowState'] {
  const { collectionStatus, scheduleStatus } = input;

  if (scheduleStatus === 'published' || scheduleStatus === 'adjusted') {
    return 'schedule_published';
  }

  if (scheduleStatus === 'draft') {
    return 'schedule_draft';
  }

  if (collectionStatus === 'completed') {
    return 'collection_completed';
  }

  if (collectionStatus === 'active') {
    return 'collecting';
  }

  return 'none';
}

async function listSubmittedMembersPreview(
  pool: Pool | PoolConnection,
  collectionId: number,
): Promise<SubmittedMemberRow[]> {
  const [rows] = await pool.query<SubmittedMemberRow[]>(
    `
      SELECT
        u.user_id,
        u.name,
        u.student_id
      FROM users u
      WHERE EXISTS (
        SELECT 1
        FROM availabilities a
        WHERE a.collection_id = ?
          AND a.user_id = u.user_id
          AND a.submitted_at IS NOT NULL
      )
        AND u.account_status = 'active'
        AND u.role IN ('assistant', 'admin', 'super_admin')
      ORDER BY u.student_id ASC
    `,
    [collectionId],
  );

  return rows;
}

function buildUnsubmittedMembersPreview(
  participants: DutyParticipantRow[],
  submittedMembers: SubmittedMemberRow[],
): Array<{ userId: number; name: string; studentId: string }> {
  const submittedUserIds = new Set(submittedMembers.map((item) => item.user_id));

  return participants
    .filter((item) => !submittedUserIds.has(item.user_id))
    .map((item) => ({
      userId: item.user_id,
      name: item.name,
      studentId: item.student_id,
    }));
}

async function listUserAvailabilityRows(
  pool: Pool | PoolConnection,
  collectionId: number,
  userId: number,
): Promise<AvailabilityRow[]> {
  const [rows] = await pool.query<AvailabilityRow[]>(
    `
      SELECT
        work_date,
        WEEKDAY(work_date) + 1 AS weekday,
        shift_template_id,
        status,
        max_weekly_shifts,
        is_week_leave,
        is_manual_added,
        submitted_at
      FROM availabilities
      WHERE collection_id = ?
        AND user_id = ?
      ORDER BY work_date ASC, shift_template_id ASC
    `,
    [collectionId, userId],
  );

  return rows;
}

async function recalculateCollectionProgress(
  executor: Pool | PoolConnection,
  collectionId: number,
): Promise<{ submittedUsers: number; totalUsers: number }> {
  const [rows] = await executor.query<Array<RowDataPacket & { submitted_users: number; total_users: number }>>(
    `
      SELECT
        COUNT(DISTINCT CASE WHEN submitted_at IS NOT NULL THEN user_id END) AS submitted_users,
        MAX(total_users) AS total_users
      FROM availabilities a
      INNER JOIN availability_collections c ON c.collection_id = a.collection_id
      WHERE a.collection_id = ?
    `,
    [collectionId],
  );

  const submittedUsers = rows[0]?.submitted_users ?? 0;
  const totalUsers = rows[0]?.total_users ?? 0;

  await executor.query(
    `
      UPDATE availability_collections
      SET
        submitted_users = ?,
        status = CASE
          WHEN ? >= total_users AND total_users > 0 THEN 'completed'
          ELSE status
        END,
        completed_at = CASE
          WHEN ? >= total_users AND total_users > 0 THEN COALESCE(completed_at, CURRENT_TIMESTAMP)
          ELSE completed_at
        END
      WHERE collection_id = ?
    `,
    [submittedUsers, submittedUsers, submittedUsers, collectionId],
  );

  return { submittedUsers, totalUsers };
}

async function syncPublishedCollectionParticipantStats(
  executor: Pool | PoolConnection,
  collection: CollectionRow,
): Promise<CollectionRow> {
  const participants = await listDutyParticipants(executor);
  const [submittedRows] = await executor.query<Array<RowDataPacket & { submitted_users: number }>>(
    `
      SELECT COUNT(DISTINCT a.user_id) AS submitted_users
      FROM availabilities a
      INNER JOIN users u ON u.user_id = a.user_id
      WHERE a.collection_id = ?
        AND a.submitted_at IS NOT NULL
        AND u.account_status = 'active'
        AND u.role IN ('assistant', 'admin', 'super_admin')
    `,
    [collection.collection_id],
  );

  const totalUsers = participants.length;
  const submittedUsers = submittedRows[0]?.submitted_users ?? 0;
  const shouldComplete = totalUsers > 0 && submittedUsers >= totalUsers;

  await executor.query(
    `
      UPDATE availability_collections
      SET
        total_users = ?,
        submitted_users = ?,
        status = ?,
        completed_at = CASE
          WHEN ? THEN COALESCE(completed_at, CURRENT_TIMESTAMP)
          ELSE NULL
        END
      WHERE collection_id = ?
    `,
    [
      totalUsers,
      submittedUsers,
      shouldComplete ? 'completed' : 'active',
      shouldComplete ? 1 : 0,
      collection.collection_id,
    ],
  );

  return (await getCollectionById(executor, collection.collection_id)) ?? collection;
}

function mapDetailMember(row: DetailMemberRow): CollectionDetailMember {
  return {
    userId: row.user_id,
    studentId: row.student_id,
    name: row.name,
    gender: row.gender,
    college: row.college,
    grade: row.grade,
    role: row.role,
    memberType: row.member_type,
    canSoloShift: row.can_solo_shift === 1,
    reliabilityTag: row.reliability_tag === 1,
    isManualAdded: row.is_manual_added === 1,
  };
}

export async function getCollectionDashboard(
  pool: Pool,
): Promise<CollectionDashboardPayload> {
  const [semester, workSettings, participants] = await Promise.all([
    getCurrentSemester(pool),
    getSchedulerWorkSettings(pool),
    listDutyParticipants(pool),
  ]);

  const weekContext = semester
    ? computeUpcomingCollectionWeek(
        semester.firstWeekStartDate,
        semester.totalWeeks,
        semester.currentTeachingWeek,
      )
    : null;
  const collection = weekContext
    ? await getCollectionByWeek(pool, weekContext.weekStartDate, weekContext.weekEndDate)
    : null;
  const syncedCollection = collection && collection.published_at !== null
    ? await syncPublishedCollectionParticipantStats(pool, collection)
    : collection;
  const submittedMembersPreview = syncedCollection
    ? await listSubmittedMembersPreview(pool, syncedCollection.collection_id)
    : [];
  const unsubmittedMembersPreview = syncedCollection
    ? buildUnsubmittedMembersPreview(participants, submittedMembersPreview)
    : [];

  return {
    summary: buildCollectionDashboardSummary({
      collection: syncedCollection,
      totalUsers: participants.length,
      weekContext,
      hasSemesterConfiguration: semester !== null,
    }),
    shiftTemplates: workSettings.shiftTemplates.map((item) => ({
      shiftTemplateId: item.shiftTemplateId,
      name: item.name,
      startTime: item.startTime,
      endTime: item.endTime,
      defaultRequiredCount: item.defaultRequiredCount,
      minCount: item.minCount,
      allowSolo: item.allowSolo,
    })),
    submittedMembersPreview: submittedMembersPreview.map((item) => ({
      userId: item.user_id,
      name: item.name,
      studentId: item.student_id,
    })),
    unsubmittedMembersPreview,
  };
}

export async function publishUpcomingCollection(
  pool: Pool,
  actorUserId: number,
): Promise<CollectionDashboardPayload> {
  const semester = await getCurrentSemester(pool);

  if (!semester) {
    throw new AppError(409, 'SEMESTER_REQUIRED', 'Please configure the current semester before publishing.');
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const workSettings = await getSchedulerWorkSettings(connection);
    const participants = await listDutyParticipants(connection);
    const weekContext = computeUpcomingCollectionWeek(
      semester.firstWeekStartDate,
      semester.totalWeeks,
      semester.currentTeachingWeek,
    );
    const existingCollection = await getCollectionByWeek(
      connection,
      weekContext.weekStartDate,
      weekContext.weekEndDate,
    );

    if (existingCollection) {
      throw new AppError(
        409,
        'COLLECTION_ALREADY_EXISTS',
        'A collection already exists for this teaching week.',
      );
    }

    const [result] = await connection.query<ResultSetHeader>(
      `
        INSERT INTO availability_collections (
          semester_id,
          title,
          week_start_date,
          week_end_date,
          teaching_week,
          status,
          total_users,
          submitted_users,
          created_by,
          published_at
        ) VALUES (?, ?, ?, ?, ?, 'active', ?, 0, ?, CURRENT_TIMESTAMP)
      `,
      [
        semester.semesterId,
        weekContext.title,
        weekContext.weekStartDate,
        weekContext.weekEndDate,
        weekContext.teachingWeek,
        participants.length,
        actorUserId,
      ],
    );

    await connection.commit();
    const publishedCollection = await getCollectionById(pool, result.insertId);

    return {
      summary: buildCollectionDashboardSummary({
        collection: publishedCollection,
        totalUsers: participants.length,
        weekContext,
        hasSemesterConfiguration: true,
      }),
      shiftTemplates: workSettings.shiftTemplates.map((item) => ({
        shiftTemplateId: item.shiftTemplateId,
        name: item.name,
        startTime: item.startTime,
        endTime: item.endTime,
        defaultRequiredCount: item.defaultRequiredCount,
        minCount: item.minCount,
        allowSolo: item.allowSolo,
      })),
      submittedMembersPreview: [],
      unsubmittedMembersPreview: participants.map((item) => ({
        userId: item.user_id,
        name: item.name,
        studentId: item.student_id,
      })),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function republishCurrentCollection(
  pool: Pool,
  actorUserId: number,
): Promise<CollectionDashboardPayload> {
  const semester = await getCurrentSemester(pool);

  if (!semester) {
    throw new AppError(409, 'SEMESTER_REQUIRED', 'Please configure the current semester before republishing.');
  }

  const weekContext = computeUpcomingCollectionWeek(
    semester.firstWeekStartDate,
    semester.totalWeeks,
    semester.currentTeachingWeek,
  );
  const currentCollection = await getCollectionByWeek(
    pool,
    weekContext.weekStartDate,
    weekContext.weekEndDate,
  );

  if (!currentCollection) {
    throw new AppError(
      404,
      'COLLECTION_NOT_FOUND',
      'The current collection does not exist. Please publish it first.',
    );
  }

  if (currentCollection.status !== 'active') {
    throw new AppError(
      409,
      'COLLECTION_NOT_ACTIVE',
      'Only the current active collection can be republished.',
    );
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const participants = await listDutyParticipants(connection);

    await connection.query(
      `
        DELETE FROM availabilities
        WHERE collection_id = ?
      `,
      [currentCollection.collection_id],
    );

    await connection.query(
      `
        UPDATE availability_collections
        SET
          total_users = ?,
          submitted_users = 0,
          status = 'active',
          completed_at = NULL,
          published_at = CURRENT_TIMESTAMP,
          created_by = ?
        WHERE collection_id = ?
      `,
      [participants.length, actorUserId, currentCollection.collection_id],
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return getCollectionDashboard(pool);
}

export async function getCurrentCollectionFillPayload(
  pool: Pool,
  userId: number,
): Promise<CurrentCollectionFillPayload> {
  const semester = await getCurrentSemester(pool);

  if (!semester) {
    return {
      collectionId: null,
      collectionStatus: 'none',
      collectionWorkflowState: 'none',
      title: '\u672a\u914d\u7f6e\u6559\u5b66\u5468',
      teachingWeek: null,
      weekLabel: null,
      days: [],
      slots: [],
      selectedKeys: [],
      maxWeeklyShiftsLimit: 3,
      selectedMaxWeeklyShifts: 1,
      isWeekLeave: false,
      submittedAt: null,
      scheduleId: null,
      scheduleStatus: 'none',
      schedulePublished: false,
    };
  }

  const weekContext = computeUpcomingCollectionWeek(
    semester.firstWeekStartDate,
    semester.totalWeeks,
    semester.currentTeachingWeek,
  );
  const [collection, workSettings] = await Promise.all([
    getCollectionByWeek(pool, weekContext.weekStartDate, weekContext.weekEndDate),
    getSchedulerWorkSettings(pool),
  ]);
  const slots = mapShiftTemplates(workSettings);
  const days = buildWorkDateList(
    weekContext.weekStartDate,
    workSettings.weeklyWorkdays,
    workSettings.overrides,
  );

  if (!collection) {
    return {
      collectionId: null,
      collectionStatus: 'none',
      collectionWorkflowState: 'none',
      title: weekContext.title,
      teachingWeek: weekContext.teachingWeek,
      weekLabel: weekContext.weekLabel,
      days,
      slots,
      selectedKeys: [],
      maxWeeklyShiftsLimit: workSettings.maxWeeklyShiftsLimit,
      selectedMaxWeeklyShifts: 1,
      isWeekLeave: false,
      submittedAt: null,
      scheduleId: null,
      scheduleStatus: 'none',
      schedulePublished: false,
    };
  }

  const [availabilityRows, schedule] = await Promise.all([
    listUserAvailabilityRows(pool, collection.collection_id, userId),
    getLatestScheduleByCollectionId(pool, collection.collection_id),
  ]);
  const defaultAvailability = await getDefaultAvailabilityConfiguration(pool, userId, workSettings);
  const selectedKeys =
    availabilityRows.length > 0
      ? buildSelectedKeys(availabilityRows, slots, days)
      : defaultAvailability.selectedSlots
          .map((item) => {
            const weekday = days.find((day) => day.weekday === item.weekday)?.weekday;
            return weekday === undefined ? null : `${item.shiftIndex}-${weekday}`;
          })
          .filter((item): item is string => item !== null)
          .sort();
  const selectedMaxWeeklyShifts = availabilityRows[0]?.max_weekly_shifts ?? 1;
  const isWeekLeave = availabilityRows[0]?.is_week_leave === 1;
  const submittedAt = availabilityRows.find((item) => item.submitted_at)?.submitted_at ?? null;
  const scheduleStatus = (schedule?.status ?? 'none') as CurrentCollectionFillPayload['scheduleStatus'];
  const collectionWorkflowState = buildCollectionWorkflowState({
    collectionStatus: collection.status,
    scheduleStatus,
  });

  return {
    collectionId: collection.collection_id,
    collectionStatus: collection.status,
    collectionWorkflowState,
    title: collection.title,
    teachingWeek: collection.teaching_week,
    weekLabel: formatWeekLabel(toDateOnly(collection.week_start_date), toDateOnly(collection.week_end_date)),
    days,
    slots,
    selectedKeys,
    maxWeeklyShiftsLimit: workSettings.maxWeeklyShiftsLimit,
    selectedMaxWeeklyShifts,
    isWeekLeave,
    submittedAt: toDateTime(submittedAt),
    scheduleId: schedule?.schedule_id ?? null,
    scheduleStatus,
    schedulePublished: scheduleStatus === 'published' || scheduleStatus === 'adjusted',
  };
}

export async function saveCurrentCollectionSubmission(
  pool: Pool,
  userId: number,
  input: SaveCollectionSubmissionInput,
): Promise<CurrentCollectionFillPayload> {
  const semester = await getCurrentSemester(pool);

  if (!semester) {
    throw new AppError(409, 'SEMESTER_REQUIRED', 'No current semester is configured.');
  }

  const weekContext = computeUpcomingCollectionWeek(
    semester.firstWeekStartDate,
    semester.totalWeeks,
    semester.currentTeachingWeek,
  );
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [collection, workSettings] = await Promise.all([
      getCollectionByWeek(connection, weekContext.weekStartDate, weekContext.weekEndDate),
      getSchedulerWorkSettings(connection),
    ]);

    if (!collection || collection.status !== 'active') {
      throw new AppError(409, 'ACTIVE_COLLECTION_REQUIRED', 'There is no active collection to submit.');
    }

    const latestSchedule = await getLatestScheduleByCollectionId(connection, collection.collection_id);

    if (latestSchedule && (latestSchedule.status === 'published' || latestSchedule.status === 'adjusted')) {
      throw new AppError(
        409,
        'COLLECTION_SUBMISSION_CLOSED',
        'This collection has already been scheduled and published. Please check the duty page instead of editing this submission.',
      );
    }

    if (
      input.selectedMaxWeeklyShifts < 1 ||
      input.selectedMaxWeeklyShifts > workSettings.maxWeeklyShiftsLimit
    ) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        `selectedMaxWeeklyShifts must be between 1 and ${workSettings.maxWeeklyShiftsLimit}.`,
      );
    }

    const days = buildWorkDateList(
      weekContext.weekStartDate,
      workSettings.weeklyWorkdays,
      workSettings.overrides,
    );
    const selectedKeySet = new Set(input.selectedKeys);

    for (const selectedKey of input.selectedKeys) {
      const parsed = parseSelectedKey(selectedKey);

      if (!parsed) {
        throw new AppError(400, 'VALIDATION_ERROR', `Invalid selected key: ${selectedKey}.`);
      }

      if (parsed.shiftIndex < 0 || parsed.shiftIndex >= workSettings.shiftTemplates.length) {
        throw new AppError(400, 'VALIDATION_ERROR', `Invalid shift index in selected key: ${selectedKey}.`);
      }

      if (!days.some((item) => item.weekday === parsed.weekday)) {
        throw new AppError(400, 'VALIDATION_ERROR', `Invalid weekday in selected key: ${selectedKey}.`);
      }
    }

    await connection.query(
      `
        DELETE FROM availabilities
        WHERE collection_id = ?
          AND user_id = ?
      `,
      [collection.collection_id, userId],
    );

    for (const day of days) {
      for (const [shiftIndex, shiftTemplate] of workSettings.shiftTemplates.entries()) {
        const selectedKey = `${shiftIndex}-${day.weekday}`;
        await connection.query(
          `
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
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, CURRENT_TIMESTAMP)
          `,
          [
            collection.collection_id,
            userId,
            day.date,
            shiftTemplate.shiftTemplateId,
            input.isWeekLeave
              ? 'unavailable'
              : selectedKeySet.has(selectedKey)
                ? 'available'
                : 'unavailable',
            input.selectedMaxWeeklyShifts,
            input.isWeekLeave ? 1 : 0,
            userId,
          ],
        );
      }
    }

    if (input.saveAsDefault) {
      const selectedSlots = input.selectedKeys
        .map(parseSelectedKey)
        .filter((item): item is { shiftIndex: number; weekday: number } => item !== null);

      await saveDefaultAvailabilityConfiguration(connection, userId, {
        selectedSlots,
      });
    }

    await recalculateCollectionProgress(connection, collection.collection_id);
    await connection.commit();

    return getCurrentCollectionFillPayload(pool, userId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getCollectionDetail(
  pool: Pool,
  collectionId: number,
): Promise<CollectionDetailPayload> {
  const [collection, workSettings, participants] = await Promise.all([
    getCollectionById(pool, collectionId),
    getSchedulerWorkSettings(pool),
    listDutyParticipants(pool),
  ]);

  if (!collection) {
    throw new AppError(404, 'COLLECTION_NOT_FOUND', 'The requested collection does not exist.');
  }

  const syncedCollection =
    collection.published_at !== null
      ? await syncPublishedCollectionParticipantStats(pool, collection)
      : collection;

  const days = buildWorkDateList(
    toDateOnly(syncedCollection.week_start_date),
    workSettings.weeklyWorkdays,
    workSettings.overrides,
  );

  const [memberRows] = await pool.query<DetailMemberRow[]>(
    `
      SELECT
        a.work_date,
        WEEKDAY(a.work_date) + 1 AS weekday,
        a.shift_template_id,
        u.user_id,
        u.student_id,
        u.name,
        u.gender,
        u.college,
        u.grade,
        u.role,
        u.member_type,
        u.can_solo_shift,
        u.reliability_tag,
        a.is_manual_added
      FROM availabilities a
      INNER JOIN users u ON u.user_id = a.user_id
      WHERE a.collection_id = ?
        AND a.status = 'available'
      ORDER BY a.work_date ASC, a.shift_template_id ASC, u.student_id ASC
    `,
    [collectionId],
  );

  const membersBySlot = new Map<string, CollectionDetailMember[]>();

  memberRows.forEach((row) => {
    const slotKey = `${toDateOnly(row.work_date)}-${row.shift_template_id}`;
    const currentMembers = membersBySlot.get(slotKey) ?? [];
    currentMembers.push(mapDetailMember(row));
    membersBySlot.set(slotKey, currentMembers);
  });

  const slots: CollectionDetailSlot[] = [];

  for (const day of days) {
    for (const shiftTemplate of workSettings.shiftTemplates) {
      const slotKey = `${day.date}-${shiftTemplate.shiftTemplateId}`;
      const members = membersBySlot.get(slotKey) ?? [];
      const risk = computeRiskLabel(members.length, shiftTemplate.minCount);

      slots.push({
        workDate: day.date,
        weekday: day.weekday,
        dateLabel: `${day.label} ${day.date.slice(5)}`,
        shiftTemplateId: shiftTemplate.shiftTemplateId,
        shiftLabel: shiftTemplate.name,
        startTime: shiftTemplate.startTime,
        endTime: shiftTemplate.endTime,
        defaultRequiredCount: shiftTemplate.defaultRequiredCount,
        minCount: shiftTemplate.minCount,
        allowSolo: shiftTemplate.allowSolo,
        availableCount: members.length,
        riskLevel: risk.riskLevel,
        riskLabel: risk.riskLabel,
        members,
      });
    }
  }

  const progressPercent =
    syncedCollection.total_users > 0
      ? Math.round((syncedCollection.submitted_users / syncedCollection.total_users) * 100)
      : 0;

  return {
    collectionId: syncedCollection.collection_id,
    title: syncedCollection.title,
    teachingWeek: syncedCollection.teaching_week,
    weekLabel: formatWeekLabel(
      toDateOnly(syncedCollection.week_start_date),
      toDateOnly(syncedCollection.week_end_date),
    ),
    status: syncedCollection.status,
    totalUsers: syncedCollection.total_users,
    submittedUsers: syncedCollection.submitted_users,
    progressPercent,
    slots,
    candidateMembers: participants.map((item) => ({
      userId: item.user_id,
      studentId: item.student_id,
      name: item.name,
      gender: item.gender,
      college: item.college,
      grade: item.grade,
      role: item.role,
      memberType: item.member_type,
    })),
  };
}

export async function updateCollectionManualAvailability(
  pool: Pool,
  actorUserId: number,
  collectionId: number,
  input: ManualAvailabilityMutationInput,
): Promise<{ detail: CollectionDetailPayload; notifyUserId: number | null }> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const collection = await getCollectionById(connection, collectionId);

    if (!collection) {
      throw new AppError(404, 'COLLECTION_NOT_FOUND', 'The requested collection does not exist.');
    }

    const [existingRows] = await connection.query<Array<RowDataPacket & { availability_id: number; submitted_at: Date | null }>>(
      `
        SELECT availability_id, submitted_at
        FROM availabilities
        WHERE collection_id = ?
          AND user_id = ?
          AND work_date = ?
          AND shift_template_id = ?
        LIMIT 1
      `,
      [collectionId, input.userId, input.workDate, input.shiftTemplateId],
    );

    const existingRow = existingRows[0] ?? null;
    const notifyUserId = input.action === 'add' ? input.userId : null;

    if (existingRow) {
      await connection.query(
        `
          UPDATE availabilities
          SET
            status = ?,
            is_manual_added = ?,
            updated_by = ?
          WHERE availability_id = ?
        `,
        [
          input.action === 'add' ? 'available' : 'unavailable',
          input.action === 'add' ? 1 : 0,
          actorUserId,
          existingRow.availability_id,
        ],
      );
    } else {
      await connection.query(
        `
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
          ) VALUES (?, ?, ?, ?, ?, NULL, 0, ?, ?, NULL)
        `,
        [
          collectionId,
          input.userId,
          input.workDate,
          input.shiftTemplateId,
          input.action === 'add' ? 'available' : 'unavailable',
          input.action === 'add' ? 1 : 0,
          actorUserId,
        ],
      );
    }

    await recalculateCollectionProgress(connection, collectionId);
    await connection.commit();

    return {
      detail: await getCollectionDetail(pool, collectionId),
      notifyUserId,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function syncLatestPublishedCollectionStats(pool: Pool): Promise<void> {
  const [rows] = await pool.query<Array<RowDataPacket & { collection_id: number }>>(
    `
      SELECT collection_id
      FROM availability_collections
      WHERE published_at IS NOT NULL
      ORDER BY week_start_date DESC, collection_id DESC
      LIMIT 1
    `,
  );

  const latestCollectionId = rows[0]?.collection_id;

  if (!latestCollectionId) {
    return;
  }

  const collection = await getCollectionById(pool, latestCollectionId);

  if (!collection) {
    return;
  }

  await syncPublishedCollectionParticipantStats(pool, collection);
}
