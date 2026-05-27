import type {
  Pool,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from 'mysql2/promise';
import { AppError } from '../errors/app-error';
import type {
  DefaultAvailabilityConfiguration,
  DefaultAvailabilitySlot,
  GradeUpdatePreviewItem,
  GradeUpdatePreviewSummary,
  SchedulerWorkSettings,
  SemesterConfiguration,
  ShiftTemplateConfiguration,
  UpdateSemesterInput,
  UpdateWorkSettingsInput,
  WorkdayOverrideConfiguration,
} from '../models/configuration';
import type { UserRecord } from '../models/user';
import { findUserById } from './user-repository';

interface SemesterRow extends RowDataPacket {
  semester_id: number;
  name: string;
  first_week_start_date: Date;
  total_weeks: number;
  grade_update_status: SemesterConfiguration['gradeUpdateStatus'];
  is_current: 0 | 1;
}

interface ShiftTemplateRow extends RowDataPacket {
  shift_template_id: number;
  name: string;
  start_time: string;
  end_time: string;
  default_required_count: number;
  min_count: number;
  allow_solo: 0 | 1;
  sort_order: number;
  is_active: 0 | 1;
}

interface WorkdayOverrideRow extends RowDataPacket {
  override_id: number;
  work_date: string;
  override_type: WorkdayOverrideConfiguration['overrideType'];
  reason: string | null;
}

interface SystemSettingRow extends RowDataPacket {
  setting_key: string;
  setting_value: string;
}

interface GradeUpdateRow extends RowDataPacket {
  user_id: number;
  student_id: string;
  name: string;
  grade: string;
}

const DEFAULT_WEEKLY_WORKDAYS = [1, 2, 3, 4, 5];
const DEFAULT_EXPORT_DIRECTORY = 'server/exports';
const WEEKDAY_NAME_TO_NUMBER: Record<string, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};

function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parseUtcDateOnly(dateText: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    return null;
  }

  const parsed = new Date(`${dateText}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeTime(value: string): string {
  return value.slice(0, 5);
}

function calculateCurrentTeachingWeek(
  firstWeekStartDate: string,
  totalWeeks: number,
  now = new Date(),
): number | null {
  const currentDate = new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const semesterStart = new Date(`${firstWeekStartDate}T00:00:00.000Z`);
  const diffDays = Math.floor((currentDate.getTime() - semesterStart.getTime()) / 86400000);

  if (diffDays < 0) {
    return null;
  }

  const teachingWeek = Math.floor(diffDays / 7) + 1;
  return teachingWeek <= totalWeeks ? teachingWeek : null;
}

function validateFirstWeekStartDate(firstWeekStartDate: string): void {
  const parsed = parseUtcDateOnly(firstWeekStartDate);

  if (!parsed) {
    throw new AppError(
      400,
      'INVALID_FIRST_WEEK_START_DATE',
      '第 1 教学周起始日期格式不正确，请使用 YYYY-MM-DD。',
    );
  }

  if (parsed.getUTCDay() !== 1) {
    throw new AppError(
      400,
      'FIRST_WEEK_START_DATE_MUST_BE_MONDAY',
      `第 1 教学周起始日期必须是周一，${firstWeekStartDate} 不是周一。`,
    );
  }
}

function normalizeStoredWorkdays(rawValue: string | null): number[] {
  if (!rawValue) {
    return DEFAULT_WEEKLY_WORKDAYS;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!Array.isArray(parsed)) {
      return DEFAULT_WEEKLY_WORKDAYS;
    }

    const normalized = parsed
      .map((item) => {
        if (typeof item === 'number' && item >= 1 && item <= 7) {
          return item;
        }

        if (typeof item === 'string') {
          const lowercase = item.trim().toLowerCase();

          if (/^[1-7]$/.test(lowercase)) {
            return Number(lowercase);
          }

          return WEEKDAY_NAME_TO_NUMBER[lowercase] ?? null;
        }

        return null;
      })
      .filter((item): item is number => item !== null);

    return normalized.length > 0 ? Array.from(new Set(normalized)).sort() : DEFAULT_WEEKLY_WORKDAYS;
  } catch {
    return DEFAULT_WEEKLY_WORKDAYS;
  }
}

function toSemesterConfiguration(row: SemesterRow): SemesterConfiguration {
  const firstWeekStartDate = formatDateOnly(row.first_week_start_date);

  return {
    semesterId: row.semester_id,
    name: row.name,
    firstWeekStartDate,
    totalWeeks: row.total_weeks,
    gradeUpdateStatus: row.grade_update_status,
    isCurrent: row.is_current === 1,
    currentTeachingWeek: calculateCurrentTeachingWeek(firstWeekStartDate, row.total_weeks),
  };
}

function toShiftTemplateConfiguration(row: ShiftTemplateRow): ShiftTemplateConfiguration {
  return {
    shiftTemplateId: row.shift_template_id,
    name: row.name,
    startTime: normalizeTime(row.start_time),
    endTime: normalizeTime(row.end_time),
    defaultRequiredCount: row.default_required_count,
    minCount: row.min_count,
    allowSolo: row.allow_solo === 1,
    sortOrder: row.sort_order,
    isActive: row.is_active === 1,
  };
}

function toWorkdayOverrideConfiguration(row: WorkdayOverrideRow): WorkdayOverrideConfiguration {
  return {
    overrideId: row.override_id,
    workDate: row.work_date,
    overrideType: row.override_type,
    reason: row.reason,
  };
}

function computeNextGrade(currentGrade: string): string {
  const normalized = currentGrade.trim();
  const directMap: Record<string, string> = {
    大一: '大二',
    大二: '大三',
    大三: '大四',
    大四: '大五',
    研一: '研二',
    研二: '研三',
    研三: '研四',
  };

  if (directMap[normalized]) {
    return directMap[normalized];
  }

  const numericMatch = normalized.match(/^(\d{4})(级)?$/);

  if (numericMatch) {
    const nextYear = String(Number(numericMatch[1]) + 1);
    return numericMatch[2] ? `${nextYear}${numericMatch[2]}` : nextYear;
  }

  return normalized;
}

function buildDefaultAvailabilitySettingKey(userId: number): string {
  return `default_availability_user_${userId}`;
}

function createFallbackDefaultAvailability(workSettings: SchedulerWorkSettings): DefaultAvailabilityConfiguration {
  const weekdays = workSettings.weeklyWorkdays.length > 0 ? workSettings.weeklyWorkdays : DEFAULT_WEEKLY_WORKDAYS;
  const selectedSlots: DefaultAvailabilitySlot[] = [];

  if (workSettings.shiftTemplates.length > 0) {
    [0, 2, 3].forEach((position) => {
      if (weekdays[position] !== undefined) {
        selectedSlots.push({
          shiftIndex: 0,
          weekday: weekdays[position],
        });
      }
    });
  }

  if (workSettings.shiftTemplates.length > 1) {
    [1, 4].forEach((position) => {
      if (weekdays[position] !== undefined) {
        selectedSlots.push({
          shiftIndex: 1,
          weekday: weekdays[position],
        });
      }
    });
  }

  return {
    selectedSlots,
  };
}

function normalizeDefaultAvailabilityValue(
  rawValue: string | null,
  workSettings: SchedulerWorkSettings,
): DefaultAvailabilityConfiguration {
  if (!rawValue) {
    return createFallbackDefaultAvailability(workSettings);
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!Array.isArray(parsed)) {
      return createFallbackDefaultAvailability(workSettings);
    }

    const maxShiftIndex = Math.max(workSettings.shiftTemplates.length - 1, 0);
    const selectedSlots = parsed
      .map((item) => {
        if (typeof item !== 'object' || item === null) {
          return null;
        }

        const row = item as Record<string, unknown>;
        const shiftIndex = typeof row.shiftIndex === 'number' ? row.shiftIndex : Number(row.shiftIndex);
        const weekday = typeof row.weekday === 'number' ? row.weekday : Number(row.weekday);

        if (
          !Number.isInteger(shiftIndex) ||
          !Number.isInteger(weekday) ||
          shiftIndex < 0 ||
          shiftIndex > maxShiftIndex ||
          weekday < 1 ||
          weekday > 7
        ) {
          return null;
        }

        return {
          shiftIndex,
          weekday,
        };
      })
      .filter((item): item is DefaultAvailabilitySlot => item !== null);

    return {
      selectedSlots,
    };
  } catch {
    return createFallbackDefaultAvailability(workSettings);
  }
}

async function readSystemSettingsMap(
  executor: Pool | PoolConnection,
  keys: string[],
): Promise<Record<string, string>> {
  if (keys.length === 0) {
    return {};
  }

  const placeholders = keys.map(() => '?').join(', ');
  const [rows] = await executor.query<SystemSettingRow[]>(
    `
      SELECT setting_key, setting_value
      FROM system_settings
      WHERE setting_key IN (${placeholders})
    `,
    keys,
  );

  return rows.reduce<Record<string, string>>((accumulator, row) => {
    accumulator[row.setting_key] = row.setting_value;
    return accumulator;
  }, {});
}

async function upsertSystemSetting(
  connection: PoolConnection,
  settingKey: string,
  settingValue: string,
  description: string,
  updatedBy: number,
): Promise<void> {
  await connection.query(
    `
      INSERT INTO system_settings (
        setting_key,
        setting_value,
        description,
        updated_by
      ) VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        setting_value = VALUES(setting_value),
        description = VALUES(description),
        updated_by = VALUES(updated_by)
    `,
    [settingKey, settingValue, description, updatedBy],
  );
}

export async function getCurrentSemester(
  pool: Pool | PoolConnection,
): Promise<SemesterConfiguration | null> {
  const [rows] = await pool.query<SemesterRow[]>(
    `
      SELECT
        semester_id,
        name,
        first_week_start_date,
        total_weeks,
        grade_update_status,
        is_current
      FROM semesters
      WHERE is_current = 1
      ORDER BY updated_at DESC
      LIMIT 1
    `,
  );

  if (rows.length === 0) {
    return null;
  }

  return toSemesterConfiguration(rows[0]);
}

export async function getShiftTemplates(
  pool: Pool | PoolConnection,
): Promise<ShiftTemplateConfiguration[]> {
  const [rows] = await pool.query<ShiftTemplateRow[]>(
    `
      SELECT
        shift_template_id,
        name,
        start_time,
        end_time,
        default_required_count,
        min_count,
        allow_solo,
        sort_order,
        is_active
      FROM shift_templates
      WHERE is_active = 1
      ORDER BY sort_order ASC, shift_template_id ASC
    `,
  );

  return rows.map(toShiftTemplateConfiguration);
}

export async function getWorkdayOverrides(
  pool: Pool | PoolConnection,
): Promise<WorkdayOverrideConfiguration[]> {
  const [rows] = await pool.query<WorkdayOverrideRow[]>(
    `
      SELECT
        override_id,
        DATE_FORMAT(work_date, '%Y-%m-%d') AS work_date,
        override_type,
        reason
      FROM workday_overrides
      ORDER BY work_date ASC, override_id ASC
    `,
  );

  return rows.map(toWorkdayOverrideConfiguration);
}

export async function getSchedulerWorkSettings(
  pool: Pool | PoolConnection,
): Promise<SchedulerWorkSettings> {
  const [settingsMap, shiftTemplates, overrides] = await Promise.all([
    readSystemSettingsMap(pool, ['default_workdays', 'max_weekly_shifts_limit', 'export_directory']),
    getShiftTemplates(pool),
    getWorkdayOverrides(pool),
  ]);

  return {
    weeklyWorkdays: normalizeStoredWorkdays(settingsMap.default_workdays ?? null),
    maxWeeklyShiftsLimit: Number(settingsMap.max_weekly_shifts_limit ?? '3') || 3,
    exportDirectory: settingsMap.export_directory?.trim() || DEFAULT_EXPORT_DIRECTORY,
    shiftTemplates,
    overrides,
  };
}

export async function getDefaultAvailabilityConfiguration(
  pool: Pool | PoolConnection,
  userId: number,
  workSettings: SchedulerWorkSettings,
): Promise<DefaultAvailabilityConfiguration> {
  const settingKey = buildDefaultAvailabilitySettingKey(userId);
  const settingsMap = await readSystemSettingsMap(pool, [settingKey]);

  return normalizeDefaultAvailabilityValue(settingsMap[settingKey] ?? null, workSettings);
}

export async function getProfileViewer(
  pool: Pool,
  userId: number,
): Promise<UserRecord | null> {
  return findUserById(pool, userId);
}

export async function saveCurrentSemester(
  pool: Pool,
  input: UpdateSemesterInput,
): Promise<SemesterConfiguration> {
  validateFirstWeekStartDate(input.firstWeekStartDate);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const currentSemester = await getCurrentSemester(connection);

    if (currentSemester) {
      await connection.query(
        `
          UPDATE semesters
          SET
            name = ?,
            first_week_start_date = ?,
            total_weeks = ?,
            is_current = 1
          WHERE semester_id = ?
        `,
        [
          input.name,
          input.firstWeekStartDate,
          input.totalWeeks,
          currentSemester.semesterId,
        ],
      );
    } else {
      await connection.query<ResultSetHeader>(
        `
          INSERT INTO semesters (
            name,
            first_week_start_date,
            total_weeks,
            grade_update_status,
            is_current
          ) VALUES (?, ?, ?, 'pending', 1)
        `,
        [input.name, input.firstWeekStartDate, input.totalWeeks],
      );
    }

    await connection.query(
      `
        UPDATE semesters
        SET is_current = CASE WHEN name = ? THEN 1 ELSE 0 END
      `,
      [input.name],
    );

    await connection.commit();

    const updatedSemester = await getCurrentSemester(pool);

    if (!updatedSemester) {
      throw new Error('Current semester was not available after save.');
    }

    return updatedSemester;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function previewGradeUpdates(
  pool: Pool | PoolConnection,
): Promise<GradeUpdatePreviewSummary> {
  const [rows] = await pool.query<GradeUpdateRow[]>(
    `
      SELECT
        user_id,
        student_id,
        name,
        grade
      FROM users
      ORDER BY student_id ASC
    `,
  );

  const items = rows.map<GradeUpdatePreviewItem>((row) => {
    const nextGrade = computeNextGrade(row.grade);

    return {
      userId: row.user_id,
      studentId: row.student_id,
      name: row.name,
      currentGrade: row.grade,
      nextGrade,
      willChange: nextGrade !== row.grade,
    };
  });

  const changedUsers = items.filter((item) => item.willChange).length;

  return {
    totalUsers: items.length,
    changedUsers,
    unchangedUsers: items.length - changedUsers,
    items,
  };
}

export async function confirmGradeUpdates(
  pool: Pool,
): Promise<GradeUpdatePreviewSummary> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const preview = await previewGradeUpdates(connection);

    for (const item of preview.items) {
      if (!item.willChange) {
        continue;
      }

      await connection.query(
        `
          UPDATE users
          SET grade = ?
          WHERE user_id = ?
        `,
        [item.nextGrade, item.userId],
      );
    }

    const currentSemester = await getCurrentSemester(connection);

    if (currentSemester) {
      await connection.query(
        `
          UPDATE semesters
          SET grade_update_status = 'confirmed'
          WHERE semester_id = ?
        `,
        [currentSemester.semesterId],
      );
    }

    await connection.commit();
    return preview;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function saveSchedulerWorkSettings(
  pool: Pool,
  input: UpdateWorkSettingsInput,
  updatedBy: number,
): Promise<SchedulerWorkSettings> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await upsertSystemSetting(
      connection,
      'default_workdays',
      JSON.stringify(input.weeklyWorkdays),
      '默认工作日配置，使用 1-7 表示周一到周日',
      updatedBy,
    );

    await upsertSystemSetting(
      connection,
      'export_directory',
      input.exportDirectory,
      'Excel export directory within the workspace',
      updatedBy,
    );

    if (input.shiftTemplates.length > 0) {
      await upsertSystemSetting(
        connection,
        'default_shift_required_count',
        String(input.shiftTemplates[0].defaultRequiredCount),
        '当前第一个默认班次的默认每班人数',
        updatedBy,
      );
    }

    await connection.query(
      `
        UPDATE shift_templates
        SET is_active = 0
        WHERE is_active = 1
      `,
    );

    for (const [index, shift] of input.shiftTemplates.entries()) {
      await connection.query<ResultSetHeader>(
        `
          INSERT INTO shift_templates (
            name,
            start_time,
            end_time,
            default_required_count,
            min_count,
            allow_solo,
            sort_order,
            is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
          ON DUPLICATE KEY UPDATE
            default_required_count = VALUES(default_required_count),
            min_count = VALUES(min_count),
            allow_solo = VALUES(allow_solo),
            sort_order = VALUES(sort_order),
            is_active = VALUES(is_active),
            updated_at = CURRENT_TIMESTAMP
        `,
        [
          shift.name,
          shift.startTime,
          shift.endTime,
          shift.defaultRequiredCount,
          shift.minCount,
          shift.allowSolo ? 1 : 0,
          index + 1,
        ],
      );
    }

    await connection.query('DELETE FROM workday_overrides');

    for (const override of input.overrides) {
      await connection.query<ResultSetHeader>(
        `
          INSERT INTO workday_overrides (
            work_date,
            override_type,
            reason,
            created_by
          ) VALUES (?, ?, ?, ?)
        `,
        [override.workDate, override.overrideType, override.reason, updatedBy],
      );
    }

    await connection.commit();
    return getSchedulerWorkSettings(pool);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function saveDefaultAvailabilityConfiguration(
  pool: Pool | PoolConnection,
  userId: number,
  configuration: DefaultAvailabilityConfiguration,
): Promise<DefaultAvailabilityConfiguration> {
  if ('getConnection' in pool) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      await upsertSystemSetting(
        connection,
        buildDefaultAvailabilitySettingKey(userId),
        JSON.stringify(configuration.selectedSlots),
        '用户个人页默认空闲时间配置，按当前默认班次顺序和 weekday 记录',
        userId,
      );
      await connection.commit();
      return configuration;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  await upsertSystemSetting(
    pool,
    buildDefaultAvailabilitySettingKey(userId),
    JSON.stringify(configuration.selectedSlots),
    '用户个人页默认空闲时间配置，按当前默认班次顺序和 weekday 记录',
    userId,
  );

  return configuration;
}
