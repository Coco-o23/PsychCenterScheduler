import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type {
  AdminTeamFilters,
  AdminTeamMember,
  AssistantTeamMember,
  TeamMemberMutationInput,
  TeamSummary,
  UserRecord,
} from '../models/user';

interface UserRow extends RowDataPacket {
  user_id: number;
  openid: string | null;
  test_identity_key: string | null;
  student_id: string;
  name: string;
  avatar_url: string | null;
  gender: UserRecord['gender'];
  college: string;
  grade: string;
  member_type: UserRecord['memberType'];
  role: UserRecord['role'];
  account_status: UserRecord['accountStatus'];
  can_solo_shift: 0 | 1;
  reliability_tag: 0 | 1;
  created_at: Date;
  updated_at: Date;
}

interface TeamMemberRow extends RowDataPacket {
  user_id: number;
  student_id: string;
  name: string;
  avatar_url: string | null;
  gender: UserRecord['gender'];
  college: string;
  grade: string;
  member_type: UserRecord['memberType'];
  role: UserRecord['role'];
  account_status: UserRecord['accountStatus'];
  can_solo_shift: 0 | 1;
  reliability_tag: 0 | 1;
  test_identity_key: string | null;
  openid: string | null;
  monthly_shift_count: number;
}

interface TeamSummaryRow extends RowDataPacket {
  total_members: number;
  active_members: number;
  disabled_members: number;
  admin_members: number;
}

interface CountRow extends RowDataPacket {
  total_count: number;
}

function toIsoString(value: Date): string {
  return value.toISOString();
}

function toUserRecord(row: UserRow): UserRecord {
  return {
    userId: row.user_id,
    openid: row.openid,
    testIdentityKey: row.test_identity_key,
    studentId: row.student_id,
    name: row.name,
    avatarUrl: row.avatar_url,
    gender: row.gender,
    college: row.college,
    grade: row.grade,
    memberType: row.member_type,
    role: row.role,
    accountStatus: row.account_status,
    canSoloShift: row.can_solo_shift === 1,
    reliabilityTag: row.reliability_tag === 1,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function toAssistantTeamMember(row: TeamMemberRow): AssistantTeamMember {
  return {
    userId: row.user_id,
    studentId: row.student_id,
    name: row.name,
    avatarUrl: row.avatar_url,
    gender: row.gender,
    college: row.college,
    grade: row.grade,
    role: row.role,
    memberType: row.member_type,
    monthlyShiftCount: row.monthly_shift_count,
  };
}

function toAdminTeamMember(row: TeamMemberRow): AdminTeamMember {
  return {
    userId: row.user_id,
    studentId: row.student_id,
    name: row.name,
    avatarUrl: row.avatar_url,
    gender: row.gender,
    college: row.college,
    grade: row.grade,
    role: row.role,
    memberType: row.member_type,
    accountStatus: row.account_status,
    canSoloShift: row.can_solo_shift === 1,
    reliabilityTag: row.reliability_tag === 1,
    testIdentityKey: row.test_identity_key,
    openidBound: row.openid !== null,
    monthlyShiftCount: row.monthly_shift_count,
  };
}

function createTeamMemberSelectSql(filters: AdminTeamFilters = {}): {
  sql: string;
  values: Array<number | string>;
} {
  const conditions: string[] = [];
  const values: Array<number | string> = [];

  if (filters.keyword) {
    conditions.push('(u.student_id LIKE ? OR u.name LIKE ? OR u.college LIKE ?)');
    const keyword = `%${filters.keyword}%`;
    values.push(keyword, keyword, keyword);
  }

  if (filters.role) {
    conditions.push('u.role = ?');
    values.push(filters.role);
  }

  if (filters.accountStatus) {
    conditions.push('u.account_status = ?');
    values.push(filters.accountStatus);
  }

  if (filters.memberType) {
    conditions.push('u.member_type = ?');
    values.push(filters.memberType);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT
      u.user_id,
      u.student_id,
      u.name,
      u.avatar_url,
      u.gender,
      u.college,
      u.grade,
      u.member_type,
      u.role,
      u.account_status,
      u.can_solo_shift,
      u.reliability_tag,
      u.test_identity_key,
      u.openid,
      COUNT(DISTINCT CASE WHEN s.status IN ('published', 'adjusted') THEN sa.assignment_id END) AS monthly_shift_count
    FROM users u
    LEFT JOIN schedule_assignments sa ON sa.user_id = u.user_id
    LEFT JOIN schedules s ON s.schedule_id = sa.schedule_id
    ${whereClause}
    GROUP BY
      u.user_id,
      u.student_id,
      u.name,
      u.avatar_url,
      u.gender,
      u.college,
      u.grade,
      u.member_type,
      u.role,
      u.account_status,
      u.can_solo_shift,
      u.reliability_tag,
      u.test_identity_key,
      u.openid
    ORDER BY
      FIELD(u.role, 'super_admin', 'admin', 'assistant') ASC,
      FIELD(u.account_status, 'active', 'pending', 'rejected', 'disabled') ASC,
      u.student_id ASC
  `;

  return { sql, values };
}

export async function findUserByTestIdentityKey(
  pool: Pool,
  testIdentityKey: string,
): Promise<UserRecord | null> {
  const [rows] = await pool.query<UserRow[]>(
    `
      SELECT
        user_id,
        openid,
        test_identity_key,
        student_id,
        name,
        avatar_url,
        gender,
        college,
        grade,
        member_type,
        role,
        account_status,
        can_solo_shift,
        reliability_tag,
        created_at,
        updated_at
      FROM users
      WHERE test_identity_key = ?
      LIMIT 1
    `,
    [testIdentityKey],
  );

  if (rows.length === 0) {
    return null;
  }

  return toUserRecord(rows[0]);
}

export async function findUserById(pool: Pool, userId: number): Promise<UserRecord | null> {
  const [rows] = await pool.query<UserRow[]>(
    `
      SELECT
        user_id,
        openid,
        test_identity_key,
        student_id,
        name,
        avatar_url,
        gender,
        college,
        grade,
        member_type,
        role,
        account_status,
        can_solo_shift,
        reliability_tag,
        created_at,
        updated_at
      FROM users
      WHERE user_id = ?
      LIMIT 1
    `,
    [userId],
  );

  if (rows.length === 0) {
    return null;
  }

  return toUserRecord(rows[0]);
}

export async function listTeamMembersForAssistant(pool: Pool): Promise<AssistantTeamMember[]> {
  const { sql, values } = createTeamMemberSelectSql({
    accountStatus: 'active',
  });
  const [rows] = await pool.query<TeamMemberRow[]>(sql, values);

  return rows.map(toAssistantTeamMember);
}

export async function listTeamMembersForAdmin(
  pool: Pool,
  filters: AdminTeamFilters = {},
): Promise<AdminTeamMember[]> {
  const { sql, values } = createTeamMemberSelectSql(filters);
  const [rows] = await pool.query<TeamMemberRow[]>(sql, values);

  return rows.map(toAdminTeamMember);
}

export async function getAdminTeamMemberById(
  pool: Pool,
  userId: number,
): Promise<AdminTeamMember | null> {
  const [rows] = await pool.query<TeamMemberRow[]>(
    `
      SELECT
        u.user_id,
        u.student_id,
        u.name,
        u.avatar_url,
        u.gender,
        u.college,
        u.grade,
        u.member_type,
        u.role,
        u.account_status,
        u.can_solo_shift,
        u.reliability_tag,
        u.test_identity_key,
        u.openid,
        COUNT(DISTINCT CASE WHEN s.status IN ('published', 'adjusted') THEN sa.assignment_id END) AS monthly_shift_count
      FROM users u
      LEFT JOIN schedule_assignments sa ON sa.user_id = u.user_id
      LEFT JOIN schedules s ON s.schedule_id = sa.schedule_id
      WHERE u.user_id = ?
      GROUP BY
        u.user_id,
        u.student_id,
        u.name,
        u.avatar_url,
        u.gender,
        u.college,
        u.grade,
        u.member_type,
        u.role,
        u.account_status,
        u.can_solo_shift,
        u.reliability_tag,
        u.test_identity_key,
        u.openid
      LIMIT 1
    `,
    [userId],
  );

  if (rows.length === 0) {
    return null;
  }

  return toAdminTeamMember(rows[0]);
}

export async function getTeamSummary(pool: Pool): Promise<TeamSummary> {
  const [rows] = await pool.query<TeamSummaryRow[]>(
    `
      SELECT
        COUNT(*) AS total_members,
        SUM(CASE WHEN account_status = 'active' THEN 1 ELSE 0 END) AS active_members,
        SUM(CASE WHEN account_status = 'disabled' THEN 1 ELSE 0 END) AS disabled_members,
        SUM(CASE WHEN role IN ('admin', 'super_admin') THEN 1 ELSE 0 END) AS admin_members
      FROM users
    `,
  );

  const row = rows[0];

  return {
    totalMembers: row?.total_members ?? 0,
    activeMembers: row?.active_members ?? 0,
    disabledMembers: row?.disabled_members ?? 0,
    adminMembers: row?.admin_members ?? 0,
  };
}

export async function countActiveAdminUsers(
  pool: Pool,
  excludeUserId?: number,
): Promise<number> {
  const conditions = ["role IN ('admin', 'super_admin')", "account_status = 'active'"];
  const values: number[] = [];

  if (excludeUserId !== undefined) {
    conditions.push('user_id <> ?');
    values.push(excludeUserId);
  }

  const [rows] = await pool.query<CountRow[]>(
    `
      SELECT COUNT(*) AS total_count
      FROM users
      WHERE ${conditions.join(' AND ')}
    `,
    values,
  );

  return rows[0]?.total_count ?? 0;
}

export async function createTeamMember(
  pool: Pool,
  input: TeamMemberMutationInput,
): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `
      INSERT INTO users (
        openid,
        test_identity_key,
        student_id,
        name,
        avatar_url,
        gender,
        college,
        grade,
        member_type,
        role,
        account_status,
        can_solo_shift,
        reliability_tag
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      null,
      input.testIdentityKey,
      input.studentId,
      input.name,
      input.avatarUrl,
      input.gender,
      input.college,
      input.grade,
      input.memberType,
      input.role,
      input.accountStatus,
      input.canSoloShift ? 1 : 0,
      input.reliabilityTag ? 1 : 0,
    ],
  );

  return result.insertId;
}

export async function updateTeamMember(
  pool: Pool,
  userId: number,
  input: TeamMemberMutationInput,
): Promise<void> {
  await pool.execute(
    `
      UPDATE users
      SET
        test_identity_key = ?,
        student_id = ?,
        name = ?,
        avatar_url = ?,
        gender = ?,
        college = ?,
        grade = ?,
        member_type = ?,
        role = ?,
        account_status = ?,
        can_solo_shift = ?,
        reliability_tag = ?
      WHERE user_id = ?
    `,
    [
      input.testIdentityKey,
      input.studentId,
      input.name,
      input.avatarUrl,
      input.gender,
      input.college,
      input.grade,
      input.memberType,
      input.role,
      input.accountStatus,
      input.canSoloShift ? 1 : 0,
      input.reliabilityTag ? 1 : 0,
      userId,
    ],
  );
}

export async function deleteTeamMember(pool: Pool, userId: number): Promise<void> {
  await pool.execute(
    `
      DELETE FROM users
      WHERE user_id = ?
    `,
    [userId],
  );
}
