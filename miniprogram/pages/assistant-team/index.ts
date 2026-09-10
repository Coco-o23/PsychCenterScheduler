import type { ShiftSchedulerApp } from '../../app';
import {
  fetchAssistantTeamMembers,
  type AssistantTeamMember,
  type MemberType,
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

interface AssistantTeamDisplayMember extends AssistantTeamMember {
  avatarText: string;
  genderLabel: string;
  roleLabel: string;
  memberTypeLabel: string;
  accentTone: 'primary' | 'secondary';
  expanded: boolean;
}

interface AssistantTeamData {
  guardState: GuardState;
  guardTitle: string;
  guardDescription: string;
  requestState: 'loading' | 'ready' | 'empty' | 'error';
  userName: string;
  totalMembers: number;
  keywordDraft: string;
  filterPanelVisible: boolean;
  memberTypeFilter: 'all' | 'new_assistant' | 'senior_assistant';
  memberTypeOptions: OptionItem<'all' | 'new_assistant' | 'senior_assistant'>[];
  members: AssistantTeamDisplayMember[];
  allMembers: AssistantTeamDisplayMember[];
  expandedMemberIds: number[];
  navItems: NavItem[];
  activeNavKey: string;
}

function createAvatarText(name: string): string {
  const normalized = name.trim();
  return normalized ? normalized.slice(-1) : '?';
}

function toGenderLabel(gender: AssistantTeamMember['gender']): string {
  return gender === 'male' ? '\u7537' : '\u5973';
}

function toRoleLabel(role: AssistantTeamMember['role']): string {
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

function toDisplayMember(member: AssistantTeamMember): AssistantTeamDisplayMember {
  return {
    ...member,
    avatarText: createAvatarText(member.name),
    genderLabel: toGenderLabel(member.gender),
    roleLabel: toRoleLabel(member.role),
    memberTypeLabel: toMemberTypeLabel(member.memberType),
    accentTone: member.memberType === 'senior_assistant' ? 'secondary' : 'primary',
    expanded: false,
  };
}

function applyMemberFilters(
  members: AssistantTeamDisplayMember[],
  keyword: string,
  memberTypeFilter: AssistantTeamData['memberTypeFilter'],
  expandedMemberIds: number[],
): AssistantTeamDisplayMember[] {
  const normalizedKeyword = keyword.trim().toLowerCase();

  return members
    .filter((member) => {
      if (
        memberTypeFilter !== 'all' &&
        member.memberType !== memberTypeFilter
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
  data: AssistantTeamData;
  onShow: () => void;
  loadMembers: () => Promise<void>;
  syncVisibleMembers: () => void;
  handleNavChange: (event: { detail?: { key?: string } }) => void;
  handleKeywordInput: (event: { detail?: { value?: string } }) => void;
  handleToggleFilterPanel: () => void;
  handleSelectMemberType: (event: { currentTarget: { dataset: { value?: string } } }) => void;
  handleToggleMember: (event: { currentTarget: { dataset: { userId?: number } } }) => void;
  handleRetry: () => void;
  handleReturnToEntry: () => void;
}>({
  data: {
    guardState: 'checking',
    guardTitle: '\u68c0\u67e5\u4e2d',
    guardDescription: '\u6b63\u5728\u786e\u8ba4\u56e2\u961f\u9875\u8bbf\u95ee\u6743\u9650\u3002',
    requestState: 'loading',
    userName: '',
    totalMembers: 0,
    keywordDraft: '',
    filterPanelVisible: false,
    memberTypeFilter: 'all',
    memberTypeOptions: [
      { label: '\u5168\u90e8', value: 'all' },
      { label: '\u65b0\u52a9\u7406', value: 'new_assistant' },
      { label: '\u8001\u52a9\u7406', value: 'senior_assistant' },
    ],
    members: [],
    allMembers: [],
    expandedMemberIds: [],
    navItems: [
      { key: 'availability', label: '\u586b\u62a5', icon: 'edit_note' },
      { key: 'schedule', label: '\u65e5\u7a0b', icon: 'calendar_month' },
      { key: 'team', label: '\u56e2\u961f', icon: 'groups' },
      { key: 'profile', label: '\u4e2a\u4eba', icon: 'person' },
    ],
    activeNavKey: 'team',
  },

  onShow(): void {
    const allowed = ensurePageAccess(this, {
      allowedRoles: ['assistant', 'admin', 'super_admin'],
    });

    if (!allowed) {
      return;
    }

    const app = getApp<ShiftSchedulerApp>();
    const state = app.getGlobalState();

    this.setData({
      userName: state.currentUser?.name ?? '',
    });

    void this.loadMembers();
  },

  async loadMembers(): Promise<void> {
    this.setData({
      requestState: 'loading',
    });

    const result = await fetchAssistantTeamMembers();

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
      totalMembers: allMembers.length,
    });

    this.syncVisibleMembers();
  },

  syncVisibleMembers(): void {
    this.setData({
      members: applyMemberFilters(
        this.data.allMembers,
        this.data.keywordDraft,
        this.data.memberTypeFilter,
        this.data.expandedMemberIds,
      ),
    });
  },

  handleNavChange(event): void {
    const targetKey = event.detail?.key ?? '';

    this.setData({
      activeNavKey: targetKey || 'team',
    });

    if (targetKey === 'availability') {
      wx.redirectTo({
        url: '/pages/assistant-main/index',
      });
      return;
    }

    if (targetKey === 'schedule') {
      wx.redirectTo({
        url: '/pages/assistant-duty/index',
      });
      return;
    }

    if (targetKey === 'profile') {
      wx.redirectTo({
        url: '/pages/assistant-profile/index',
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

  handleSelectMemberType(event): void {
    const nextValue = event.currentTarget.dataset.value;

    if (
      nextValue !== 'all' &&
      nextValue !== 'new_assistant' &&
      nextValue !== 'senior_assistant'
    ) {
      return;
    }

    this.setData({
      memberTypeFilter: nextValue,
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

  handleRetry(): void {
    void this.loadMembers();
  },

  handleReturnToEntry(): void {
    returnToTestEntry(true);
  },
});
