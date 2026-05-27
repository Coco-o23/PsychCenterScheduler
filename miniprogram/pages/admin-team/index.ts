import type { ShiftSchedulerApp } from '../../app';
import type { AccountStatus, UserRole } from '../../state/app-state';
import {
  createAdminTeamMember,
  deleteAdminTeamMember,
  fetchAdminTeamMembers,
  type AdminTeamMember,
  type MemberType,
  type TeamMemberMutationPayload,
  type TeamSummary,
  type UserGender,
  updateAdminTeamMember,
} from '../../services/team';
import {
  ensurePageAccess,
  returnToTestEntry,
  type GuardState,
} from '../../utils/route-guard';

interface NavItem {
  key: string;
  label: string;
  icon: string;
}

interface OptionItem<TValue extends string> {
  label: string;
  value: TValue;
}

interface TeamMemberForm extends TeamMemberMutationPayload {}

interface AdminTeamDisplayMember extends AdminTeamMember {
  avatarText: string;
  genderLabel: string;
  roleLabel: string;
  memberTypeLabel: string;
  accountStatusLabel: string;
  bindingLabel: string;
  accentTone: 'primary' | 'secondary';
  expanded: boolean;
}

interface AdminTeamData {
  guardState: GuardState;
  guardTitle: string;
  guardDescription: string;
  requestState: 'loading' | 'ready' | 'empty' | 'error';
  userName: string;
  summary: TeamSummary;
  keywordDraft: string;
  filterPanelVisible: boolean;
  memberManageMode: boolean;
  allMembers: AdminTeamDisplayMember[];
  members: AdminTeamDisplayMember[];
  expandedMemberIds: number[];
  filters: {
    role: UserRole | 'all';
    accountStatus: AccountStatus | 'all';
    memberType: MemberType | 'all';
  };
  roleFilterOptions: OptionItem<UserRole | 'all'>[];
  statusFilterOptions: OptionItem<AccountStatus | 'all'>[];
  memberTypeFilterOptions: OptionItem<MemberType | 'all'>[];
  roleOptions: OptionItem<UserRole>[];
  statusOptions: OptionItem<AccountStatus>[];
  memberTypeOptions: OptionItem<MemberType>[];
  genderOptions: OptionItem<UserGender>[];
  editorVisible: boolean;
  editorMode: 'create' | 'edit';
  editingUserId: number | null;
  form: TeamMemberForm;
  deleteDialogVisible: boolean;
  pendingDeleteUserId: number | null;
  pendingDeleteName: string;
  navItems: NavItem[];
  activeNavKey: string;
}

const DEFAULT_SUMMARY: TeamSummary = {
  totalMembers: 0,
  activeMembers: 0,
  disabledMembers: 0,
  adminMembers: 0,
};

function createEmptyForm(): TeamMemberForm {
  return {
    studentId: '',
    name: '',
    avatarUrl: null,
    gender: 'female',
    college: '',
    grade: '',
    memberType: 'new_assistant',
    role: 'assistant',
    accountStatus: 'active',
    canSoloShift: false,
    reliabilityTag: false,
    testIdentityKey: null,
  };
}

function createAvatarText(name: string): string {
  const normalized = name.trim();
  return normalized ? normalized.slice(-1) : '?';
}

function toGenderLabel(gender: UserGender): string {
  return gender === 'male' ? '\u7537' : '\u5973';
}

function toRoleLabel(role: UserRole): string {
  if (role === 'super_admin') {
    return '\u8d85\u7ea7\u7ba1\u7406\u5458';
  }

  if (role === 'admin') {
    return '\u7ba1\u7406\u5458';
  }

  return '\u52a9\u7406';
}

function toMemberTypeLabel(memberType: MemberType): string {
  const labels: Record<MemberType, string> = {
    new_assistant: '\u65b0\u52a9\u7406',
    senior_assistant: '\u8001\u52a9\u7406',
    intern_assistant: '\u5b9e\u4e60\u52a9\u7406',
    manager_assistant: '\u7ba1\u7406\u52a9\u7406',
  };

  return labels[memberType];
}

function toAccountStatusLabel(accountStatus: AccountStatus): string {
  const labels: Record<AccountStatus, string> = {
    pending: '\u5f85\u5904\u7406',
    active: '\u6b63\u5e38',
    rejected: '\u5df2\u9a73\u56de',
    disabled: '\u5df2\u505c\u7528',
  };

  return labels[accountStatus];
}

function toDisplayMember(member: AdminTeamMember): AdminTeamDisplayMember {
  return {
    ...member,
    avatarText: createAvatarText(member.name),
    genderLabel: toGenderLabel(member.gender),
    roleLabel: toRoleLabel(member.role),
    memberTypeLabel: toMemberTypeLabel(member.memberType),
    accountStatusLabel: toAccountStatusLabel(member.accountStatus),
    bindingLabel: member.openidBound ? '\u5df2\u7ed1\u5b9a' : '\u672a\u7ed1\u5b9a',
    accentTone: member.memberType === 'senior_assistant' ? 'secondary' : 'primary',
    expanded: false,
  };
}

function createFormFromMember(member: AdminTeamMember): TeamMemberForm {
  return {
    studentId: member.studentId,
    name: member.name,
    avatarUrl: member.avatarUrl,
    gender: member.gender,
    college: member.college,
    grade: member.grade,
    memberType: member.memberType,
    role: member.role,
    accountStatus: member.accountStatus,
    canSoloShift: member.canSoloShift,
    reliabilityTag: member.reliabilityTag,
    testIdentityKey: member.testIdentityKey,
  };
}

function filterMembers(
  members: AdminTeamDisplayMember[],
  keyword: string,
  filters: AdminTeamData['filters'],
  expandedMemberIds: number[],
): AdminTeamDisplayMember[] {
  const normalizedKeyword = keyword.trim().toLowerCase();

  return members
    .filter((member) => {
      if (filters.role !== 'all' && member.role !== filters.role) {
        return false;
      }

      if (
        filters.accountStatus !== 'all' &&
        member.accountStatus !== filters.accountStatus
      ) {
        return false;
      }

      if (
        filters.memberType !== 'all' &&
        member.memberType !== filters.memberType
      ) {
        return false;
      }

      if (!normalizedKeyword) {
        return true;
      }

      return [member.name, member.studentId, member.college]
        .join(' ')
        .toLowerCase()
        .includes(normalizedKeyword);
    })
    .map((member) => ({
      ...member,
      expanded: expandedMemberIds.includes(member.userId),
    }));
}

Page<{
  data: AdminTeamData;
  onShow: () => void;
  loadMembers: () => Promise<void>;
  syncVisibleMembers: () => void;
  handleNavChange: (event: { detail?: { key?: string } }) => void;
  handleKeywordInput: (event: { detail?: { value?: string } }) => void;
  handleToggleFilterPanel: () => void;
  handleFilterSelect: (event: { currentTarget: { dataset: { field?: string; value?: string } } }) => void;
  handleToggleMember: (event: { currentTarget: { dataset: { userId?: number } } }) => void;
  handlePrimaryManageAction: () => void;
  handleToggleManageMode: () => void;
  handleOpenCreate: () => void;
  handleEditMember: (event: { currentTarget: { dataset: { userId?: number } } }) => void;
  handleCloseEditor: () => void;
  handleFieldInput: (event: { currentTarget: { dataset: { field?: string } }; detail?: { value?: string } }) => void;
  handleOptionSelect: (event: { currentTarget: { dataset: { field?: string; value?: string } } }) => void;
  handleToggleBoolean: (event: { currentTarget: { dataset: { field?: string } }; detail?: { value?: boolean } }) => void;
  handleSubmitMember: () => Promise<void>;
  handleRequestDelete: (event: { currentTarget: { dataset: { userId?: number } } }) => void;
  handleCancelDelete: () => void;
  handleConfirmDelete: () => Promise<void>;
  handleRetry: () => void;
  handleReturnToEntry: () => void;
}>({
  data: {
    guardState: 'checking',
    guardTitle: '\u68c0\u67e5\u4e2d',
    guardDescription: '\u6b63\u5728\u786e\u8ba4\u7ba1\u7406\u7aef\u56e2\u961f\u9875\u8bbf\u95ee\u6743\u9650\u3002',
    requestState: 'loading',
    userName: '',
    summary: DEFAULT_SUMMARY,
    keywordDraft: '',
    filterPanelVisible: false,
    memberManageMode: false,
    allMembers: [],
    members: [],
    expandedMemberIds: [],
    filters: {
      role: 'all',
      accountStatus: 'all',
      memberType: 'all',
    },
    roleFilterOptions: [
      { label: '\u5168\u90e8\u89d2\u8272', value: 'all' },
      { label: '\u52a9\u7406', value: 'assistant' },
      { label: '\u7ba1\u7406\u5458', value: 'admin' },
      { label: '\u8d85\u7ea7\u7ba1\u7406\u5458', value: 'super_admin' },
    ],
    statusFilterOptions: [
      { label: '\u5168\u90e8\u72b6\u6001', value: 'all' },
      { label: '\u6b63\u5e38', value: 'active' },
      { label: '\u5f85\u5904\u7406', value: 'pending' },
      { label: '\u5df2\u9a73\u56de', value: 'rejected' },
      { label: '\u5df2\u505c\u7528', value: 'disabled' },
    ],
    memberTypeFilterOptions: [
      { label: '\u5168\u90e8\u6210\u5458\u7c7b\u578b', value: 'all' },
      { label: '\u65b0\u52a9\u7406', value: 'new_assistant' },
      { label: '\u8001\u52a9\u7406', value: 'senior_assistant' },
      { label: '\u5b9e\u4e60\u52a9\u7406', value: 'intern_assistant' },
      { label: '\u7ba1\u7406\u52a9\u7406', value: 'manager_assistant' },
    ],
    roleOptions: [
      { label: '\u52a9\u7406', value: 'assistant' },
      { label: '\u7ba1\u7406\u5458', value: 'admin' },
      { label: '\u8d85\u7ea7\u7ba1\u7406\u5458', value: 'super_admin' },
    ],
    statusOptions: [
      { label: '\u6b63\u5e38', value: 'active' },
      { label: '\u5f85\u5904\u7406', value: 'pending' },
      { label: '\u5df2\u9a73\u56de', value: 'rejected' },
      { label: '\u5df2\u505c\u7528', value: 'disabled' },
    ],
    memberTypeOptions: [
      { label: '\u65b0\u52a9\u7406', value: 'new_assistant' },
      { label: '\u8001\u52a9\u7406', value: 'senior_assistant' },
      { label: '\u5b9e\u4e60\u52a9\u7406', value: 'intern_assistant' },
      { label: '\u7ba1\u7406\u52a9\u7406', value: 'manager_assistant' },
    ],
    genderOptions: [
      { label: '\u7537', value: 'male' },
      { label: '\u5973', value: 'female' },
    ],
    editorVisible: false,
    editorMode: 'create',
    editingUserId: null,
    form: createEmptyForm(),
    deleteDialogVisible: false,
    pendingDeleteUserId: null,
    pendingDeleteName: '',
    navItems: [
      { key: 'schedule', label: '\u6392\u73ed', icon: '\u6392' },
      { key: 'duty', label: '\u65e5\u7a0b', icon: '\u73ed' },
      { key: 'team', label: '\u56e2\u961f', icon: '\u4eba' },
      { key: 'profile', label: '\u4e2a\u4eba', icon: '\u6211' },
    ],
    activeNavKey: 'team',
  },

  onShow(): void {
    const allowed = ensurePageAccess(this, {
      allowedRoles: ['admin', 'super_admin'],
    });

    if (!allowed) {
      return;
    }

    const app = getApp<ShiftSchedulerApp>();

    this.setData({
      userName: app.getGlobalState().currentUser?.name ?? '',
    });

    void this.loadMembers();
  },

  async loadMembers(): Promise<void> {
    this.setData({
      requestState: 'loading',
    });

    const result = await fetchAdminTeamMembers({});

    if (!result.ok || !result.data) {
      this.setData({
        requestState: 'error',
      });
      return;
    }

    const allMembers = result.data.members.map(toDisplayMember);

    this.setData({
      requestState: allMembers.length > 0 ? 'ready' : 'empty',
      allMembers,
      summary: result.data.summary,
    });

    this.syncVisibleMembers();
  },

  syncVisibleMembers(): void {
    this.setData({
      members: filterMembers(
        this.data.allMembers,
        this.data.keywordDraft,
        this.data.filters,
        this.data.expandedMemberIds,
      ),
    });
  },

  handleNavChange(event): void {
    const targetKey = event.detail?.key ?? '';

    this.setData({
      activeNavKey: targetKey || 'team',
    });

    if (targetKey === 'schedule') {
      wx.redirectTo({
        url: '/pages/admin-main/index',
      });
      return;
    }

    if (targetKey === 'duty') {
      wx.redirectTo({
        url: '/pages/admin-duty/index',
      });
      return;
    }

    if (targetKey === 'profile') {
      wx.redirectTo({
        url: '/pages/admin-profile/index',
      });
      return;
    }
  },

  handleKeywordInput(event): void {
    this.setData({
      keywordDraft: event.detail?.value ?? '',
    });

    this.syncVisibleMembers();
  },

  handleToggleFilterPanel(): void {
    this.setData({
      filterPanelVisible: !this.data.filterPanelVisible,
    });
  },

  handleFilterSelect(event): void {
    const field = event.currentTarget.dataset.field ?? '';
    const value = event.currentTarget.dataset.value ?? 'all';

    if (!field) {
      return;
    }

    this.setData({
      [`filters.${field}`]: value,
    });

    this.syncVisibleMembers();
  },

  handleToggleMember(event): void {
    const userId = Number(event.currentTarget.dataset.userId);

    if (!Number.isFinite(userId)) {
      return;
    }

    const expandedMemberIds = this.data.expandedMemberIds.includes(userId)
      ? this.data.expandedMemberIds.filter((id) => id !== userId)
      : [...this.data.expandedMemberIds, userId];

    this.setData({
      expandedMemberIds,
    });

    this.syncVisibleMembers();
  },

  handlePrimaryManageAction(): void {
    if (!this.data.memberManageMode) {
      this.setData({
        memberManageMode: true,
      });
      return;
    }

    this.handleOpenCreate();
  },

  handleToggleManageMode(): void {
    this.setData({
      memberManageMode: false,
      editorVisible: false,
      editingUserId: null,
      form: createEmptyForm(),
      deleteDialogVisible: false,
      pendingDeleteUserId: null,
      pendingDeleteName: '',
    });
  },

  handleOpenCreate(): void {
    this.setData({
      editorVisible: true,
      editorMode: 'create',
      editingUserId: null,
      form: createEmptyForm(),
    });
  },

  handleEditMember(event): void {
    const userId = Number(event.currentTarget.dataset.userId);
    const member = this.data.allMembers.find((item) => item.userId === userId);

    if (!member) {
      wx.showToast({
        title: '\u6ca1\u627e\u5230\u8981\u7f16\u8f91\u7684\u6210\u5458',
        icon: 'none',
      });
      return;
    }

    this.setData({
      memberManageMode: true,
      editorVisible: true,
      editorMode: 'edit',
      editingUserId: userId,
      form: createFormFromMember(member),
    });
  },

  handleCloseEditor(): void {
    this.setData({
      editorVisible: false,
      editingUserId: null,
      form: createEmptyForm(),
    });
  },

  handleFieldInput(event): void {
    const field = event.currentTarget.dataset.field ?? '';

    if (!field) {
      return;
    }

    this.setData({
      [`form.${field}`]: event.detail?.value ?? '',
    });
  },

  handleOptionSelect(event): void {
    const field = event.currentTarget.dataset.field ?? '';
    const value = event.currentTarget.dataset.value ?? '';

    if (!field) {
      return;
    }

    this.setData({
      [`form.${field}`]: value,
    });
  },

  handleToggleBoolean(event): void {
    const field = event.currentTarget.dataset.field ?? '';

    if (!field) {
      return;
    }

    this.setData({
      [`form.${field}`]: Boolean(event.detail?.value),
    });
  },

  async handleSubmitMember(): Promise<void> {
    const form = this.data.form;

    if (
      !form.studentId.trim() ||
      !form.name.trim() ||
      !form.college.trim() ||
      !form.grade.trim()
    ) {
      wx.showToast({
        title: '\u8bf7\u5148\u586b\u5199\u5b8c\u6574\u7684\u6210\u5458\u4fe1\u606f',
        icon: 'none',
      });
      return;
    }

    const payload: TeamMemberMutationPayload = {
      ...form,
      studentId: form.studentId.trim(),
      name: form.name.trim(),
      college: form.college.trim(),
      grade: form.grade.trim(),
      avatarUrl: form.avatarUrl ? form.avatarUrl.trim() || null : null,
      testIdentityKey: form.testIdentityKey
        ? form.testIdentityKey.trim() || null
        : null,
    };

    const result =
      this.data.editorMode === 'create' || this.data.editingUserId === null
        ? await createAdminTeamMember(payload)
        : await updateAdminTeamMember(this.data.editingUserId, payload);

    if (!result.ok) {
      return;
    }

    wx.showToast({
      title:
        this.data.editorMode === 'create'
          ? '\u6210\u5458\u5df2\u65b0\u589e'
          : '\u6210\u5458\u4fe1\u606f\u5df2\u66f4\u65b0',
      icon: 'success',
    });

    this.handleCloseEditor();
    await this.loadMembers();
  },

  handleRequestDelete(event): void {
    const userId = Number(event.currentTarget.dataset.userId);
    const member = this.data.allMembers.find((item) => item.userId === userId);

    if (!member) {
      return;
    }

    this.setData({
      deleteDialogVisible: true,
      pendingDeleteUserId: userId,
      pendingDeleteName: member.name,
    });
  },

  handleCancelDelete(): void {
    this.setData({
      deleteDialogVisible: false,
      pendingDeleteUserId: null,
      pendingDeleteName: '',
    });
  },

  async handleConfirmDelete(): Promise<void> {
    if (this.data.pendingDeleteUserId === null) {
      return;
    }

    const deletingUserId = this.data.pendingDeleteUserId;
    const result = await deleteAdminTeamMember(deletingUserId);

    if (!result.ok) {
      return;
    }

    wx.showToast({
      title: '\u6210\u5458\u5df2\u5220\u9664',
      icon: 'success',
    });

    this.handleCancelDelete();

    if (this.data.editingUserId === deletingUserId) {
      this.handleCloseEditor();
    }

    await this.loadMembers();
  },

  handleRetry(): void {
    void this.loadMembers();
  },

  handleReturnToEntry(): void {
    returnToTestEntry(true);
  },
});
