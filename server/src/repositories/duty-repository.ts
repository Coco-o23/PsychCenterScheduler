import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { AppError } from '../errors/app-error';
import type {
  AdminDutyOverviewPayload,
  AdminReviewOvertimeInput,
  AdminReviewSwapInput,
  AssistantDutyOverviewPayload,
  CreateOvertimeInput,
  CreateSwapRequestInput,
  DutyAssignmentItem,
  DutyCalendarDay,
  DutyMonthlySummary,
  DutyOverviewScope,
  DutyScheduleDay,
  OvertimeRecordView,
  PeerReviewSwapInput,
  SwapPeerOption,
  SwapRequestView,
  UpdateNoShiftInput,
} from '../models/duty';
import { getCurrentSemester } from './configuration-repository';

interface AssignmentMemberRow extends RowDataPacket {
  assignment_id: number;
  schedule_id: number;
  schedule_status: 'published' | 'adjusted';
  work_date: Date;
  shift_template_id: number;
  shift_name: string;
  start_time: string;
  end_time: string;
  user_id: number;
  user_name: string;
  student_id: string;
}

interface OverrideRow extends RowDataPacket {
  work_date: string;
  override_type: 'workday' | 'non_workday' | 'no_shift';
}

interface SwapRequestRow extends RowDataPacket {
  swap_request_id: number;
  requester_id: number;
  requester_name: string;
  requester_student_id: string;
  target_user_id: number | null;
  target_user_name: string | null;
  target_user_student_id: string | null;
  original_assignment_id: number;
  original_work_date: Date;
  original_shift_name: string;
  original_start_time: string;
  original_end_time: string;
  reason: string | null;
  status: 'pending_peer' | 'pending_admin' | 'approved' | 'rejected' | 'cancelled';
  peer_confirmed_at: Date | null;
  reviewed_at: Date | null;
  review_note: string | null;
  created_at: Date;
}

interface OvertimeRow extends RowDataPacket {
  overtime_id: number;
  user_id: number;
  user_name: string;
  user_student_id: string;
  assignment_id: number;
  work_date: Date;
  shift_name: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_at: Date | null;
  review_note: string | null;
  created_at: Date;
}

interface PeerOptionRow extends RowDataPacket {
  user_id: number;
  name: string;
  student_id: string;
}

interface SummaryRow extends RowDataPacket {
  total_count: number;
  scheduled_minutes: number | null;
}

interface OvertimeSummaryRow extends RowDataPacket {
  approved_overtime_minutes: number | null;
}

interface SlotGroup {
  workDate: string;
  weekday: number;
  dateLabel: string;
  shiftTemplateId: number;
  shiftLabel: string;
  startTime: string;
  endTime: string;
  scheduleId: number;
  scheduleStatus: 'published' | 'adjusted';
  members: Array<{
    assignmentId: number;
    userId: number;
    name: string;
    studentId: string;
  }>;
}

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

  if (toLocalDate(parsed) !== dateText) {
    return null;
  }

  return parsed;
}

function toLocalDate(value: Date): string {
  return `${value.getFullYear()}-${padDatePart(value.getMonth() + 1)}-${padDatePart(value.getDate())}`;
}

function toLocalDateTime(value: Date | null): string | null {
  if (!value) {
    return null;
  }

  return `${toLocalDate(value)} ${padDatePart(value.getHours())}:${padDatePart(value.getMinutes())}`;
}

function normalizeTime(value: string): string {
  return value.slice(0, 5);
}

function getWeekday(date: Date): number {
  const weekday = date.getDay();
  return weekday === 0 ? 7 : weekday;
}

function getWeekdayLabel(weekday: number): string {
  return ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][weekday - 1] ?? '';
}

function getWeekdayByDateText(dateText: string): number {
  const parsed = parseDateOnly(dateText);

  if (!parsed) {
    throw new AppError(500, 'INVALID_DATE', `Invalid date text: ${dateText}`);
  }

  return getWeekday(parsed);
}

function buildDateLabel(dateText: string): string {
  const parsed = parseDateOnly(dateText);

  if (!parsed) {
    throw new AppError(500, 'INVALID_DATE', `Invalid date text: ${dateText}`);
  }

  return `${getWeekdayLabel(getWeekday(parsed))} ${padDatePart(parsed.getMonth() + 1)}-${padDatePart(parsed.getDate())}`;
}

function parseMonthInput(month: string | null | undefined): { start: Date; end: Date; key: string; label: string } {
  const today = new Date();
  const fallback = `${today.getFullYear()}-${padDatePart(today.getMonth() + 1)}`;
  const normalized = month && /^\d{4}-\d{2}$/.test(month) ? month : fallback;
  const [year, rawMonth] = normalized.split('-').map(Number);
  const start = new Date(year, rawMonth - 1, 1);
  const end = new Date(year, rawMonth, 0);

  return {
    start,
    end,
    key: normalized,
    label: `${year}年${padDatePart(rawMonth)}月`,
  };
}

function parseSelectedDate(
  date: string | null | undefined,
  monthRange: { start: Date; end: Date; key: string },
): string {
  if (date && parseDateOnly(date) && date.startsWith(`${monthRange.key}-`)) {
    return date;
  }

  const today = new Date();
  const todayKey = toLocalDate(today);

  if (todayKey.startsWith(monthRange.key)) {
    return todayKey;
  }

  return `${monthRange.key}-01`;
}

function getMonthGridBounds(start: Date, end: Date): { gridStart: Date; gridEnd: Date } {
  const gridStart = new Date(start);
  gridStart.setDate(start.getDate() - (start.getDay() === 0 ? 6 : start.getDay() - 1));
  const gridEnd = new Date(end);
  gridEnd.setDate(end.getDate() + (gridEnd.getDay() === 0 ? 0 : 7 - gridEnd.getDay()));
  return { gridStart, gridEnd };
}

function buildTeachingWeekLabel(firstWeekStartDate: string | null, totalWeeks: number | null, selectedDate: string): string {
  if (!firstWeekStartDate || !totalWeeks) {
    return '未配置教学周';
  }

  const start = parseDateOnly(firstWeekStartDate);
  const current = parseDateOnly(selectedDate);

  if (!start || !current) {
    return '鏈厤缃暀瀛﹀懆';
  }

  const diffDays = Math.floor((current.getTime() - start.getTime()) / 86400000);

  if (diffDays < 0) {
    return '未到教学周范围';
  }

  const week = Math.floor(diffDays / 7) + 1;
  return week <= totalWeeks ? `第 ${week} 教学周` : '超出教学周范围';
}

async function listAssignmentsBetween(
  executor: Pool | PoolConnection,
  dateFrom: string,
  dateTo: string,
): Promise<AssignmentMemberRow[]> {
  const [rows] = await executor.query<AssignmentMemberRow[]>(
    `
      SELECT
        sa.assignment_id,
        sa.schedule_id,
        s.status AS schedule_status,
        sa.work_date,
        sa.shift_template_id,
        st.name AS shift_name,
        st.start_time,
        st.end_time,
        u.user_id,
        u.name AS user_name,
        u.student_id
      FROM schedule_assignments sa
      INNER JOIN schedules s ON s.schedule_id = sa.schedule_id
      INNER JOIN shift_templates st ON st.shift_template_id = sa.shift_template_id
      INNER JOIN users u ON u.user_id = sa.user_id
      WHERE s.status IN ('published', 'adjusted')
        AND sa.work_date BETWEEN ? AND ?
      ORDER BY sa.work_date ASC, st.sort_order ASC, sa.assignment_id ASC
    `,
    [dateFrom, dateTo],
  );

  return rows;
}

function buildSlotGroups(rows: AssignmentMemberRow[]): SlotGroup[] {
  const groups = new Map<string, SlotGroup>();

  rows.forEach((row) => {
    const workDate = toLocalDate(row.work_date);
    const key = `${workDate}-${row.shift_template_id}`;
    const group =
      groups.get(key) ??
      {
        workDate,
        weekday: getWeekdayByDateText(workDate),
        dateLabel: buildDateLabel(workDate),
        shiftTemplateId: row.shift_template_id,
        shiftLabel: row.shift_name,
        startTime: normalizeTime(row.start_time),
        endTime: normalizeTime(row.end_time),
        scheduleId: row.schedule_id,
        scheduleStatus: row.schedule_status,
        members: [],
      };

    group.members.push({
      assignmentId: row.assignment_id,
      userId: row.user_id,
      name: row.user_name,
      studentId: row.student_id,
    });
    groups.set(key, group);
  });

  return Array.from(groups.values());
}

function toOwnAssignment(group: SlotGroup, userId: number, todayKey: string): DutyAssignmentItem | null {
  const selfMember = group.members.find((member) => member.userId === userId);

  if (!selfMember) {
    return null;
  }

  const partners = group.members.filter((member) => member.userId !== userId).map((member) => member.name);

  return {
    assignmentId: selfMember.assignmentId,
    scheduleId: group.scheduleId,
    workDate: group.workDate,
    weekday: group.weekday,
    dateLabel: group.dateLabel,
    shiftTemplateId: group.shiftTemplateId,
    shiftLabel: group.shiftLabel,
    startTime: group.startTime,
    endTime: group.endTime,
    status: group.scheduleStatus,
    partnerNames: partners,
    partnerDisplayText: partners.length > 0 ? partners.join('、') : '暂无同班成员',
    memberNames: group.members.map((member) => member.name),
    memberDisplayText: group.members.map((member) => member.name).join('、'),
    canRequestSwap: group.workDate > todayKey,
    canSubmitOvertime: group.workDate <= todayKey,
  };
}

function toDayRosterAssignment(group: SlotGroup, userId: number, todayKey: string): DutyAssignmentItem {
  const selfMember = group.members.find((member) => member.userId === userId) ?? null;
  const partners = selfMember
    ? group.members.filter((member) => member.userId !== userId).map((member) => member.name)
    : [];

  return {
    assignmentId: selfMember?.assignmentId ?? group.members[0]?.assignmentId ?? 0,
    scheduleId: group.scheduleId,
    workDate: group.workDate,
    weekday: group.weekday,
    dateLabel: group.dateLabel,
    shiftTemplateId: group.shiftTemplateId,
    shiftLabel: group.shiftLabel,
    startTime: group.startTime,
    endTime: group.endTime,
    status: group.scheduleStatus,
    partnerNames: partners,
    partnerDisplayText: partners.length > 0 ? partners.join('、') : '暂无同班成员',
    memberNames: group.members.map((member) => `${member.name} · ${member.studentId}`),
    memberDisplayText: group.members.map((member) => `${member.name} · ${member.studentId}`).join('、'),
    canRequestSwap: selfMember !== null && group.workDate > todayKey,
    canSubmitOvertime: selfMember !== null && group.workDate <= todayKey,
  };
}

function buildScheduleDays(assignments: DutyAssignmentItem[], noShiftDates: Set<string>): DutyScheduleDay[] {
  const groups = new Map<string, DutyScheduleDay>();

  assignments.forEach((assignment) => {
    const current =
      groups.get(assignment.workDate) ??
      {
        date: assignment.workDate,
        dateLabel: assignment.dateLabel,
        noShift: noShiftDates.has(assignment.workDate),
        assignments: [],
      };

    current.assignments.push(assignment);
    groups.set(assignment.workDate, current);
  });

  return Array.from(groups.values());
}

function buildDisplayNoShiftDates(
  noShiftDates: Set<string>,
  assignments: DutyAssignmentItem[],
): Set<string> {
  const assignmentDates = new Set(assignments.map((item) => item.workDate));
  return new Set(Array.from(noShiftDates).filter((date) => !assignmentDates.has(date)));
}

function buildCalendarDays(
  start: Date,
  end: Date,
  monthKey: string,
  selectedDate: string,
  assignmentCountByDate: Map<string, number>,
  noShiftDates: Set<string>,
): DutyCalendarDay[] {
  const { gridStart, gridEnd } = getMonthGridBounds(start, end);
  const days: DutyCalendarDay[] = [];
  const todayKey = toLocalDate(new Date());
  const cursor = new Date(gridStart);

  while (cursor <= gridEnd) {
    const dateKey = toLocalDate(cursor);
    days.push({
      date: dateKey,
      dayOfMonth: cursor.getDate(),
      weekday: getWeekdayByDateText(dateKey),
      inCurrentMonth: dateKey.startsWith(`${monthKey}-`),
      isToday: dateKey === todayKey,
      isSelected: dateKey === selectedDate,
      hasAssignments: (assignmentCountByDate.get(dateKey) ?? 0) > 0,
      assignmentCount: assignmentCountByDate.get(dateKey) ?? 0,
      noShift: noShiftDates.has(dateKey),
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

async function listNoShiftDates(
  executor: Pool | PoolConnection,
  dateFrom: string,
  dateTo: string,
): Promise<Set<string>> {
  const [rows] = await executor.query<OverrideRow[]>(
    `
      SELECT DATE_FORMAT(work_date, '%Y-%m-%d') AS work_date, override_type
      FROM workday_overrides
      WHERE work_date BETWEEN ? AND ?
        AND override_type = 'no_shift'
    `,
    [dateFrom, dateTo],
  );

  return new Set(rows.map((row) => row.work_date));
}

async function listSwapTargetOptions(executor: Pool | PoolConnection, userId: number): Promise<SwapPeerOption[]> {
  const [rows] = await executor.query<PeerOptionRow[]>(
    `
      SELECT user_id, name, student_id
      FROM users
      WHERE account_status = 'active'
        AND user_id <> ?
      ORDER BY role DESC, student_id ASC
    `,
    [userId],
  );

  return rows.map((row) => ({
    userId: row.user_id,
    name: row.name,
    studentId: row.student_id,
  }));
}

function mapSwapRequest(row: SwapRequestRow): SwapRequestView {
  return {
    swapRequestId: row.swap_request_id,
    requesterId: row.requester_id,
    requesterName: row.requester_name,
    requesterStudentId: row.requester_student_id,
    targetUserId: row.target_user_id,
    targetUserName: row.target_user_name,
    targetUserStudentId: row.target_user_student_id,
    originalAssignmentId: row.original_assignment_id,
    originalWorkDate: toLocalDate(row.original_work_date),
    originalShiftLabel: row.original_shift_name,
    originalTimeRange: `${normalizeTime(row.original_start_time)} - ${normalizeTime(row.original_end_time)}`,
    reason: row.reason,
    status: row.status,
    peerConfirmedAt: toLocalDateTime(row.peer_confirmed_at),
    reviewedAt: toLocalDateTime(row.reviewed_at),
    reviewNote: row.review_note,
    createdAt: toLocalDateTime(row.created_at) ?? '',
  };
}

async function listSwapRequests(
  executor: Pool | PoolConnection,
  whereClause: string,
  params: Array<string | number>,
): Promise<SwapRequestView[]> {
  const [rows] = await executor.query<SwapRequestRow[]>(
    `
      SELECT
        sr.swap_request_id,
        sr.requester_id,
        requester.name AS requester_name,
        requester.student_id AS requester_student_id,
        sr.target_user_id,
        target.name AS target_user_name,
        target.student_id AS target_user_student_id,
        sr.original_assignment_id,
        sa.work_date AS original_work_date,
        st.name AS original_shift_name,
        st.start_time AS original_start_time,
        st.end_time AS original_end_time,
        sr.reason,
        sr.status,
        sr.peer_confirmed_at,
        sr.reviewed_at,
        sr.review_note,
        sr.created_at
      FROM swap_requests sr
      INNER JOIN users requester ON requester.user_id = sr.requester_id
      LEFT JOIN users target ON target.user_id = sr.target_user_id
      INNER JOIN schedule_assignments sa ON sa.assignment_id = sr.original_assignment_id
      INNER JOIN shift_templates st ON st.shift_template_id = sa.shift_template_id
      ${whereClause}
      ORDER BY sr.created_at DESC
    `,
    params,
  );

  return rows.map(mapSwapRequest);
}

function mapOvertimeRecord(row: OvertimeRow): OvertimeRecordView {
  return {
    overtimeId: row.overtime_id,
    userId: row.user_id,
    userName: row.user_name,
    userStudentId: row.user_student_id,
    assignmentId: row.assignment_id,
    workDate: toLocalDate(row.work_date),
    shiftLabel: row.shift_name,
    timeRange: `${normalizeTime(row.start_time)} - ${normalizeTime(row.end_time)}`,
    durationMinutes: row.duration_minutes,
    reason: row.reason,
    status: row.status,
    reviewedAt: toLocalDateTime(row.reviewed_at),
    reviewNote: row.review_note,
    createdAt: toLocalDateTime(row.created_at) ?? '',
  };
}

async function listOvertimeRecords(
  executor: Pool | PoolConnection,
  whereClause: string,
  params: Array<string | number>,
): Promise<OvertimeRecordView[]> {
  const [rows] = await executor.query<OvertimeRow[]>(
    `
      SELECT
        o.overtime_id,
        o.user_id,
        u.name AS user_name,
        u.student_id AS user_student_id,
        o.assignment_id,
        sa.work_date,
        st.name AS shift_name,
        st.start_time,
        st.end_time,
        o.duration_minutes,
        o.reason,
        o.status,
        o.reviewed_at,
        o.review_note,
        o.created_at
      FROM overtime_records o
      INNER JOIN users u ON u.user_id = o.user_id
      INNER JOIN schedule_assignments sa ON sa.assignment_id = o.assignment_id
      INNER JOIN shift_templates st ON st.shift_template_id = sa.shift_template_id
      ${whereClause}
      ORDER BY o.created_at DESC
    `,
    params,
  );

  return rows.map(mapOvertimeRecord);
}

async function buildMonthlySummary(
  executor: Pool | PoolConnection,
  month: string,
  dateFrom: string,
  dateTo: string,
  userId: number | null,
  scope: DutyOverviewScope,
): Promise<DutyMonthlySummary> {
  const userFilter = userId !== null && scope === 'me' ? 'AND sa.user_id = ?' : '';
  const summaryParams = userId !== null && scope === 'me' ? [dateFrom, dateTo, userId] : [dateFrom, dateTo];
  const overtimeParams = userId !== null && scope === 'me' ? [dateFrom, dateTo, userId] : [dateFrom, dateTo];

  const [summaryRows] = await executor.query<SummaryRow[]>(
    `
      SELECT
        COUNT(DISTINCT sa.assignment_id) AS total_count,
        SUM(TIMESTAMPDIFF(MINUTE, st.start_time, st.end_time)) AS scheduled_minutes
      FROM schedule_assignments sa
      INNER JOIN schedules s ON s.schedule_id = sa.schedule_id
      INNER JOIN shift_templates st ON st.shift_template_id = sa.shift_template_id
      WHERE s.status IN ('published', 'adjusted')
        AND sa.work_date BETWEEN ? AND ?
        ${userFilter}
    `,
    summaryParams,
  );

  const [overtimeRows] = await executor.query<OvertimeSummaryRow[]>(
    `
      SELECT
        SUM(o.duration_minutes) AS approved_overtime_minutes
      FROM overtime_records o
      INNER JOIN schedule_assignments sa ON sa.assignment_id = o.assignment_id
      INNER JOIN schedules s ON s.schedule_id = sa.schedule_id
      WHERE o.status = 'approved'
        AND sa.work_date BETWEEN ? AND ?
        ${userFilter}
    `,
    overtimeParams,
  );

  const scheduledMinutes = summaryRows[0]?.scheduled_minutes ?? 0;
  const approvedOvertimeMinutes = overtimeRows[0]?.approved_overtime_minutes ?? 0;

  return {
    month,
    publishedShiftCount: summaryRows[0]?.total_count ?? 0,
    scheduledMinutes,
    approvedOvertimeMinutes,
    totalWorkingMinutes: scheduledMinutes + approvedOvertimeMinutes,
  };
}

export async function getAssistantDutyOverview(
  pool: Pool,
  userId: number,
  monthInput: string | null,
  selectedDateInput: string | null,
): Promise<AssistantDutyOverviewPayload> {
  const monthRange = parseMonthInput(monthInput);
  const selectedDate = parseSelectedDate(selectedDateInput, monthRange);
  const today = new Date();
  const todayKey = toLocalDate(today);
  const futureTo = new Date(today);
  futureTo.setDate(futureTo.getDate() + 14);
  const futureToKey = toLocalDate(futureTo);

  const [semester, monthAssignments, futureAssignmentsRows, noShiftDates, swapTargetOptions, pendingPeerSwapRequests, mySwapRequests, myOvertimeRecords, monthlySummary] =
    await Promise.all([
      getCurrentSemester(pool),
      listAssignmentsBetween(pool, toLocalDate(monthRange.start), toLocalDate(monthRange.end)),
      listAssignmentsBetween(pool, todayKey, futureToKey),
      listNoShiftDates(pool, toLocalDate(monthRange.start), toLocalDate(monthRange.end)),
      listSwapTargetOptions(pool, userId),
      listSwapRequests(pool, 'WHERE sr.target_user_id = ? AND sr.status = \'pending_peer\'', [userId]),
      listSwapRequests(pool, 'WHERE sr.requester_id = ?', [userId]),
      listOvertimeRecords(pool, 'WHERE o.user_id = ?', [userId]),
      buildMonthlySummary(pool, monthRange.key, toLocalDate(monthRange.start), toLocalDate(monthRange.end), userId, 'me'),
    ]);

  const monthSlotGroups = buildSlotGroups(monthAssignments);
  const futureSlotGroups = buildSlotGroups(futureAssignmentsRows);
  const assignmentCountByDate = new Map<string, number>();
  const assistantMonthAssignments = monthSlotGroups.map((group) =>
    toDayRosterAssignment(group, userId, todayKey),
  );

  assistantMonthAssignments.forEach((assignment) => {
    assignmentCountByDate.set(
      assignment.workDate,
      (assignmentCountByDate.get(assignment.workDate) ?? 0) + 1,
    );
  });

  const currentDayAssignments = assistantMonthAssignments.filter(
    (assignment) => assignment.workDate === selectedDate,
  );
  const upcomingAssignments = futureSlotGroups
    .map((group) => toOwnAssignment(group, userId, todayKey))
    .filter((item): item is DutyAssignmentItem => item !== null)
    .filter((assignment) => assignment.workDate >= todayKey);
  const displayNoShiftDates = buildDisplayNoShiftDates(
    noShiftDates,
    assistantMonthAssignments.concat(upcomingAssignments),
  );

  return {
    monthLabel: monthRange.label,
    month: monthRange.key,
    teachingWeekLabel: buildTeachingWeekLabel(
      semester?.firstWeekStartDate ?? null,
      semester?.totalWeeks ?? null,
      selectedDate,
    ),
    selectedDate,
    calendarDays: buildCalendarDays(
      monthRange.start,
      monthRange.end,
      monthRange.key,
      selectedDate,
      assignmentCountByDate,
      displayNoShiftDates,
    ),
    currentDayAssignments,
    upcomingScheduleDays: buildScheduleDays(upcomingAssignments, displayNoShiftDates),
    monthlySummary,
    swapTargetOptions,
    pendingPeerSwapRequests,
    mySwapRequests,
    myOvertimeRecords,
  };
}

export async function getAdminDutyOverview(
  pool: Pool,
  userId: number,
  monthInput: string | null,
  selectedDateInput: string | null,
  scope: DutyOverviewScope,
): Promise<AdminDutyOverviewPayload> {
  const monthRange = parseMonthInput(monthInput);
  const selectedDate = parseSelectedDate(selectedDateInput, monthRange);
  const today = new Date();
  const todayKey = toLocalDate(today);
  const futureTo = new Date(today);
  futureTo.setDate(futureTo.getDate() + 14);
  const futureToKey = toLocalDate(futureTo);

  const [semester, monthAssignments, futureAssignmentsRows, noShiftDates, swapTargetOptions, pendingSwapRequests, pendingOvertimeRecords, monthlySummary] =
    await Promise.all([
      getCurrentSemester(pool),
      listAssignmentsBetween(pool, toLocalDate(monthRange.start), toLocalDate(monthRange.end)),
      listAssignmentsBetween(pool, todayKey, futureToKey),
      listNoShiftDates(pool, toLocalDate(monthRange.start), toLocalDate(monthRange.end)),
      listSwapTargetOptions(pool, userId),
      listSwapRequests(pool, 'WHERE sr.status = \'pending_admin\'', []),
      listOvertimeRecords(pool, 'WHERE o.status = \'pending\'', []),
      buildMonthlySummary(
        pool,
        monthRange.key,
        toLocalDate(monthRange.start),
        toLocalDate(monthRange.end),
        userId,
        scope,
      ),
    ]);

  const assignmentCountByDate = new Map<string, number>();
  const monthSlotGroups = buildSlotGroups(monthAssignments);
  const futureSlotGroups = buildSlotGroups(futureAssignmentsRows);
  const monthVisibleAssignments = monthSlotGroups
    .map((group) => {
      if (scope === 'me' && !group.members.some((member) => member.userId === userId)) {
        return null;
      }

      return toDayRosterAssignment(group, userId, todayKey);
    })
    .filter((item): item is DutyAssignmentItem => item !== null);

  monthVisibleAssignments.forEach((assignment) => {
    assignmentCountByDate.set(
      assignment.workDate,
      (assignmentCountByDate.get(assignment.workDate) ?? 0) + 1,
    );
  });

  const currentDayAssignments = monthVisibleAssignments.filter(
    (assignment) => assignment.workDate === selectedDate,
  );
  const upcomingAssignments = futureSlotGroups
    .map((group) => toOwnAssignment(group, userId, todayKey))
    .filter((item): item is DutyAssignmentItem => item !== null)
    .filter((assignment) => assignment.workDate >= todayKey);
  const displayNoShiftDates = buildDisplayNoShiftDates(
    noShiftDates,
    monthVisibleAssignments.concat(upcomingAssignments),
  );

  return {
    monthLabel: monthRange.label,
    month: monthRange.key,
    teachingWeekLabel: buildTeachingWeekLabel(
      semester?.firstWeekStartDate ?? null,
      semester?.totalWeeks ?? null,
      selectedDate,
    ),
    selectedDate,
    scope,
    calendarDays: buildCalendarDays(
      monthRange.start,
      monthRange.end,
      monthRange.key,
      selectedDate,
      assignmentCountByDate,
      displayNoShiftDates,
    ),
    currentDayAssignments,
    upcomingScheduleDays: buildScheduleDays(upcomingAssignments, displayNoShiftDates),
    monthlySummary,
    noShiftEnabled: noShiftDates.has(selectedDate),
    swapTargetOptions,
    pendingSwapRequests,
    pendingOvertimeRecords,
  };
}

async function findOwnAssignment(executor: Pool | PoolConnection, assignmentId: number, userId: number): Promise<AssignmentMemberRow | null> {
  const [rows] = await executor.query<AssignmentMemberRow[]>(
    `
      SELECT
        sa.assignment_id,
        sa.schedule_id,
        s.status AS schedule_status,
        sa.work_date,
        sa.shift_template_id,
        st.name AS shift_name,
        st.start_time,
        st.end_time,
        u.user_id,
        u.name AS user_name,
        u.student_id
      FROM schedule_assignments sa
      INNER JOIN schedules s ON s.schedule_id = sa.schedule_id
      INNER JOIN shift_templates st ON st.shift_template_id = sa.shift_template_id
      INNER JOIN users u ON u.user_id = sa.user_id
      WHERE sa.assignment_id = ?
        AND sa.user_id = ?
        AND s.status IN ('published', 'adjusted')
      LIMIT 1
    `,
    [assignmentId, userId],
  );

  return rows[0] ?? null;
}

async function findAssignmentById(executor: Pool | PoolConnection, assignmentId: number): Promise<AssignmentMemberRow | null> {
  const [rows] = await executor.query<AssignmentMemberRow[]>(
    `
      SELECT
        sa.assignment_id,
        sa.schedule_id,
        s.status AS schedule_status,
        sa.work_date,
        sa.shift_template_id,
        st.name AS shift_name,
        st.start_time,
        st.end_time,
        u.user_id,
        u.name AS user_name,
        u.student_id
      FROM schedule_assignments sa
      INNER JOIN schedules s ON s.schedule_id = sa.schedule_id
      INNER JOIN shift_templates st ON st.shift_template_id = sa.shift_template_id
      INNER JOIN users u ON u.user_id = sa.user_id
      WHERE sa.assignment_id = ?
      LIMIT 1
    `,
    [assignmentId],
  );

  return rows[0] ?? null;
}

export async function createSwapRequest(
  pool: Pool,
  requesterId: number,
  input: CreateSwapRequestInput,
): Promise<SwapRequestView> {
  const assignment = await findOwnAssignment(pool, input.originalAssignmentId, requesterId);

  if (!assignment) {
    throw new AppError(404, 'ASSIGNMENT_NOT_FOUND', 'The selected assignment does not belong to the current user.');
  }

  if (toLocalDate(assignment.work_date) <= toLocalDate(new Date())) {
    throw new AppError(409, 'SWAP_NOT_ALLOWED', 'Only future assignments can request a swap.');
  }

  if (input.targetUserId === requesterId) {
    throw new AppError(400, 'VALIDATION_ERROR', 'targetUserId cannot be the requester.');
  }

  const [result] = await pool.query<ResultSetHeader>(
    `
      INSERT INTO swap_requests (
        requester_id,
        original_assignment_id,
        target_user_id,
        reason,
        status
      ) VALUES (?, ?, ?, ?, 'pending_peer')
    `,
    [requesterId, input.originalAssignmentId, input.targetUserId, input.reason],
  );

  const requests = await listSwapRequests(pool, 'WHERE sr.swap_request_id = ?', [result.insertId]);
  return requests[0];
}

export async function peerReviewSwapRequest(
  pool: Pool,
  targetUserId: number,
  swapRequestId: number,
  input: PeerReviewSwapInput,
): Promise<SwapRequestView> {
  const [rows] = await pool.query<Array<RowDataPacket & { target_user_id: number | null; status: string }>>(
    `
      SELECT target_user_id, status
      FROM swap_requests
      WHERE swap_request_id = ?
      LIMIT 1
    `,
    [swapRequestId],
  );
  const current = rows[0];

  if (!current || current.target_user_id !== targetUserId) {
    throw new AppError(404, 'SWAP_REQUEST_NOT_FOUND', 'The swap request does not belong to the current user.');
  }

  if (current.status !== 'pending_peer') {
    throw new AppError(409, 'SWAP_REQUEST_NOT_PENDING_PEER', 'The swap request is not waiting for peer confirmation.');
  }

  await pool.query(
    `
      UPDATE swap_requests
      SET
        status = ?,
        peer_confirmed_at = CASE WHEN ? = 'pending_admin' THEN CURRENT_TIMESTAMP ELSE NULL END,
        reviewed_at = CASE WHEN ? = 'rejected' THEN CURRENT_TIMESTAMP ELSE reviewed_at END
      WHERE swap_request_id = ?
    `,
    [input.decision === 'confirm' ? 'pending_admin' : 'rejected', input.decision === 'confirm' ? 'pending_admin' : 'rejected', input.decision === 'confirm' ? 'pending_admin' : 'rejected', swapRequestId],
  );

  const requests = await listSwapRequests(pool, 'WHERE sr.swap_request_id = ?', [swapRequestId]);
  return requests[0];
}

export async function adminReviewSwapRequest(
  pool: Pool,
  reviewerId: number,
  swapRequestId: number,
  input: AdminReviewSwapInput,
): Promise<SwapRequestView> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<Array<RowDataPacket & {
      requester_id: number;
      target_user_id: number | null;
      original_assignment_id: number;
      status: string;
    }>>(
      `
        SELECT requester_id, target_user_id, original_assignment_id, status
        FROM swap_requests
        WHERE swap_request_id = ?
        LIMIT 1
      `,
      [swapRequestId],
    );
    const current = rows[0];

    if (!current) {
      throw new AppError(404, 'SWAP_REQUEST_NOT_FOUND', 'The swap request does not exist.');
    }

    if (current.status !== 'pending_admin') {
      throw new AppError(409, 'SWAP_REQUEST_NOT_PENDING_ADMIN', 'The swap request is not waiting for admin review.');
    }

    if (input.decision === 'approve') {
      if (!current.target_user_id) {
        throw new AppError(409, 'SWAP_TARGET_MISSING', 'The swap request does not have a confirmed target user.');
      }

      const assignment = await findAssignmentById(connection, current.original_assignment_id);

      if (!assignment) {
        throw new AppError(404, 'ASSIGNMENT_NOT_FOUND', 'The original assignment no longer exists.');
      }

      const [conflicts] = await connection.query<Array<RowDataPacket & { conflict_count: number }>>(
        `
          SELECT COUNT(*) AS conflict_count
          FROM schedule_assignments
          WHERE schedule_id = ?
            AND work_date = ?
            AND shift_template_id = ?
            AND user_id = ?
        `,
        [assignment.schedule_id, toLocalDate(assignment.work_date), assignment.shift_template_id, current.target_user_id],
      );

      if ((conflicts[0]?.conflict_count ?? 0) > 0) {
        throw new AppError(409, 'SWAP_TARGET_CONFLICT', 'The target user is already assigned to the same slot.');
      }

      await connection.query(
        `
          UPDATE schedule_assignments
          SET
            user_id = ?,
            assignment_source = 'swap',
            notes = 'Approved swap request'
          WHERE assignment_id = ?
        `,
        [current.target_user_id, current.original_assignment_id],
      );
    }

    await connection.query(
      `
        UPDATE swap_requests
        SET
          status = ?,
          reviewed_by = ?,
          reviewed_at = CURRENT_TIMESTAMP,
          review_note = ?
        WHERE swap_request_id = ?
      `,
      [input.decision === 'approve' ? 'approved' : 'rejected', reviewerId, input.reviewNote, swapRequestId],
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const requests = await listSwapRequests(pool, 'WHERE sr.swap_request_id = ?', [swapRequestId]);
  return requests[0];
}

export async function createOvertimeRecord(
  pool: Pool,
  userId: number,
  input: CreateOvertimeInput,
): Promise<OvertimeRecordView> {
  const assignment = await findOwnAssignment(pool, input.assignmentId, userId);

  if (!assignment) {
    throw new AppError(404, 'ASSIGNMENT_NOT_FOUND', 'The selected assignment does not belong to the current user.');
  }

  if (toLocalDate(assignment.work_date) > toLocalDate(new Date())) {
    throw new AppError(409, 'OVERTIME_NOT_ALLOWED', 'Only current-day or completed assignments can submit overtime.');
  }

  const [result] = await pool.query<ResultSetHeader>(
    `
      INSERT INTO overtime_records (
        user_id,
        assignment_id,
        duration_minutes,
        reason,
        status
      ) VALUES (?, ?, ?, ?, 'pending')
    `,
    [userId, input.assignmentId, input.durationMinutes, input.reason],
  );

  const records = await listOvertimeRecords(pool, 'WHERE o.overtime_id = ?', [result.insertId]);
  return records[0];
}

export async function adminReviewOvertimeRecord(
  pool: Pool,
  reviewerId: number,
  overtimeId: number,
  input: AdminReviewOvertimeInput,
): Promise<OvertimeRecordView> {
  const [result] = await pool.query<ResultSetHeader>(
    `
      UPDATE overtime_records
      SET
        status = ?,
        reviewed_by = ?,
        reviewed_at = CURRENT_TIMESTAMP,
        review_note = ?
      WHERE overtime_id = ?
        AND status = 'pending'
    `,
    [input.decision === 'approve' ? 'approved' : 'rejected', reviewerId, input.reviewNote, overtimeId],
  );

  if (result.affectedRows === 0) {
    throw new AppError(404, 'OVERTIME_RECORD_NOT_FOUND', 'The overtime record does not exist or has already been reviewed.');
  }

  const records = await listOvertimeRecords(pool, 'WHERE o.overtime_id = ?', [overtimeId]);
  return records[0];
}

export async function updateNoShiftOverride(
  pool: Pool,
  actorUserId: number,
  input: UpdateNoShiftInput,
): Promise<void> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    if (input.enabled) {
      await connection.query(
        `
          INSERT INTO workday_overrides (
            work_date,
            override_type,
            reason,
            created_by
          ) VALUES (?, 'no_shift', ?, ?)
          ON DUPLICATE KEY UPDATE
            override_type = VALUES(override_type),
            reason = VALUES(reason),
            created_by = VALUES(created_by),
            updated_at = CURRENT_TIMESTAMP
        `,
        [input.workDate, input.reason, actorUserId],
      );

      const [affectedScheduleRows] = await connection.query<Array<RowDataPacket & { schedule_id: number }>>(
        `
          SELECT DISTINCT s.schedule_id
          FROM schedules s
          INNER JOIN schedule_assignments sa ON sa.schedule_id = s.schedule_id
          WHERE s.status IN ('published', 'adjusted')
            AND sa.work_date = ?
        `,
        [input.workDate],
      );

      await connection.query(
        `
          DELETE sa
          FROM schedule_assignments sa
          INNER JOIN schedules s ON s.schedule_id = sa.schedule_id
          WHERE s.status IN ('published', 'adjusted')
            AND sa.work_date = ?
        `,
        [input.workDate],
      );

      if (affectedScheduleRows.length > 0) {
        const affectedScheduleIds = affectedScheduleRows.map((row) => row.schedule_id);

        await connection.query(
          `
            UPDATE schedules
            SET
              status = CASE WHEN status = 'published' THEN 'adjusted' ELSE status END,
              confirmed_by = CASE WHEN status = 'published' THEN NULL ELSE confirmed_by END,
              confirmed_at = CASE WHEN status = 'published' THEN NULL ELSE confirmed_at END
            WHERE schedule_id IN (?)
          `,
          [affectedScheduleIds],
        );
      }
    } else {
      await connection.query(
        `
          DELETE FROM workday_overrides
          WHERE work_date = ?
            AND override_type = 'no_shift'
        `,
        [input.workDate],
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
