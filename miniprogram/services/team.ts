import type { AccountStatus, UserRole } from '../state/app-state';
import type { ApiRequestResult } from './request';
import { requestApi } from './request';

export type MemberType =
  | 'new_assistant'
  | 'senior_assistant'
  | 'intern_assistant'
  | 'manager_assistant';

export type UserGender = 'male' | 'female';

export interface AssistantTeamMember {
  userId: number;
  studentId: string;
  name: string;
  avatarUrl: string | null;
  gender: UserGender;
  college: string;
  grade: string;
  role: UserRole;
  memberType: MemberType;
  monthlyShiftCount: number;
}

export interface AdminTeamMember extends AssistantTeamMember {
  memberType: MemberType;
  accountStatus: AccountStatus;
  canSoloShift: boolean;
  reliabilityTag: boolean;
  testIdentityKey: string | null;
  openidBound: boolean;
}

export interface TeamSummary {
  totalMembers: number;
  activeMembers: number;
  disabledMembers: number;
  adminMembers: number;
}

export interface AssistantTeamResponse {
  scope: 'assistant' | 'admin';
  members: AssistantTeamMember[];
}

export interface AdminTeamFilters {
  keyword?: string;
  role?: UserRole;
  accountStatus?: AccountStatus;
  memberType?: MemberType;
}

export interface AdminTeamResponse {
  filters: AdminTeamFilters;
  members: AdminTeamMember[];
  summary: TeamSummary;
}

export interface TeamMemberMutationPayload {
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

export interface TeamMemberMutationResponse {
  member: AdminTeamMember | null;
}

function createQueryString(filters: AdminTeamFilters): string {
  const parts: string[] = [];

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  });

  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

export function fetchAssistantTeamMembers(): Promise<ApiRequestResult<AssistantTeamResponse>> {
  return requestApi<AssistantTeamResponse>({
    path: '/team/members',
    method: 'GET',
  });
}

export function fetchAdminTeamMembers(
  filters: AdminTeamFilters,
): Promise<ApiRequestResult<AdminTeamResponse>> {
  return requestApi<AdminTeamResponse>({
    path: `/admin/team/members${createQueryString(filters)}`,
    method: 'GET',
  });
}

export function createAdminTeamMember(
  payload: TeamMemberMutationPayload,
): Promise<ApiRequestResult<TeamMemberMutationResponse>> {
  return requestApi<TeamMemberMutationResponse, TeamMemberMutationPayload>({
    path: '/admin/team/members',
    method: 'POST',
    data: payload,
  });
}

export function updateAdminTeamMember(
  userId: number,
  payload: TeamMemberMutationPayload,
): Promise<ApiRequestResult<TeamMemberMutationResponse>> {
  return requestApi<TeamMemberMutationResponse, TeamMemberMutationPayload>({
    path: `/admin/team/members/${userId}`,
    method: 'PATCH',
    data: payload,
  });
}

export function deleteAdminTeamMember(
  userId: number,
): Promise<ApiRequestResult<{ deletedUserId: number }>> {
  return requestApi<{ deletedUserId: number }>({
    path: `/admin/team/members/${userId}`,
    method: 'DELETE',
  });
}
