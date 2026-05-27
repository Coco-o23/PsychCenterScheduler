export type UserRole = 'assistant' | 'admin' | 'super_admin';
export type AccountStatus = 'pending' | 'active' | 'rejected' | 'disabled';
export type UserGender = 'male' | 'female';
export type MemberType =
  | 'new_assistant'
  | 'senior_assistant'
  | 'intern_assistant'
  | 'manager_assistant';

export interface UserRecord {
  userId: number;
  openid: string | null;
  testIdentityKey: string | null;
  studentId: string;
  name: string;
  avatarUrl: string | null;
  gender: UserGender;
  college: string;
  grade: string;
  memberType: MemberType;
  role: UserRole;
  accountStatus: AccountStatus;
  canSoloShift: boolean;
  reliabilityTag: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMemberBase {
  userId: number;
  studentId: string;
  name: string;
  avatarUrl: string | null;
  gender: UserGender;
  college: string;
  grade: string;
  role: UserRole;
}

export interface AssistantTeamMember extends TeamMemberBase {
  memberType: MemberType;
  monthlyShiftCount: number;
}

export interface AdminTeamMember extends TeamMemberBase {
  memberType: MemberType;
  accountStatus: AccountStatus;
  canSoloShift: boolean;
  reliabilityTag: boolean;
  testIdentityKey: string | null;
  openidBound: boolean;
  monthlyShiftCount: number;
}

export interface AdminTeamFilters {
  keyword?: string;
  role?: UserRole;
  accountStatus?: AccountStatus;
  memberType?: MemberType;
}

export interface TeamSummary {
  totalMembers: number;
  activeMembers: number;
  disabledMembers: number;
  adminMembers: number;
}

export interface TeamMemberMutationInput {
  studentId: string;
  name: string;
  avatarUrl: string | null;
  gender: UserGender;
  college: string;
  grade: string;
  memberType: MemberType;
  role: UserRole;
  accountStatus: AccountStatus;
  canSoloShift: boolean;
  reliabilityTag: boolean;
  testIdentityKey: string | null;
}
