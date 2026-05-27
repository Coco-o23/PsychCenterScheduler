export type CollectionDashboardStatus = 'pending' | 'active' | 'completed' | 'missing_semester';
export type AvailabilitySlotStatus = 'available' | 'unavailable';
export type AvailabilityRiskLevel = 'none' | 'warning' | 'critical';

export interface CollectionWeekContext {
  teachingWeek: number;
  title: string;
  weekEndDate: string;
  weekLabel: string;
  weekStartDate: string;
}

export interface CollectionDashboardSummary {
  collectionId: number | null;
  status: CollectionDashboardStatus;
  title: string;
  teachingWeek: number | null;
  weekEndDate: string | null;
  weekLabel: string | null;
  weekStartDate: string | null;
  totalUsers: number;
  submittedUsers: number;
  progressPercent: number;
  publishedAt: string | null;
  completedAt: string | null;
  canPublish: boolean;
  hasSemesterConfiguration: boolean;
}

export interface CollectionDashboardPayload {
  summary: CollectionDashboardSummary;
  shiftTemplates: Array<{
    shiftTemplateId: number;
    name: string;
    startTime: string;
    endTime: string;
    defaultRequiredCount: number;
    minCount: number;
    allowSolo: boolean;
  }>;
  submittedMembersPreview: Array<{
    userId: number;
    name: string;
    studentId: string;
  }>;
  unsubmittedMembersPreview: Array<{
    userId: number;
    name: string;
    studentId: string;
  }>;
}

export interface CollectionFillDay {
  date: string;
  label: string;
  weekday: number;
}

export interface CollectionFillSlot {
  shiftTemplateId: number;
  shiftLabel: string;
  startTime: string;
  endTime: string;
}

export interface CurrentCollectionFillPayload {
  collectionId: number | null;
  collectionStatus: 'pending' | 'active' | 'completed' | 'none';
  collectionWorkflowState:
    | 'none'
    | 'collecting'
    | 'collection_completed'
    | 'schedule_draft'
    | 'schedule_published';
  title: string;
  teachingWeek: number | null;
  weekLabel: string | null;
  days: CollectionFillDay[];
  slots: CollectionFillSlot[];
  selectedKeys: string[];
  maxWeeklyShiftsLimit: number;
  selectedMaxWeeklyShifts: number;
  isWeekLeave: boolean;
  submittedAt: string | null;
  scheduleId: number | null;
  scheduleStatus: 'none' | 'draft' | 'published' | 'adjusted';
  schedulePublished: boolean;
}

export interface SaveCollectionSubmissionInput {
  saveAsDefault: boolean;
  selectedKeys: string[];
  selectedMaxWeeklyShifts: number;
  isWeekLeave: boolean;
}

export interface CollectionDetailMember {
  userId: number;
  studentId: string;
  name: string;
  gender: 'male' | 'female';
  college: string;
  grade: string;
  role: 'assistant' | 'admin' | 'super_admin';
  memberType: 'new_assistant' | 'senior_assistant' | 'intern_assistant' | 'manager_assistant';
  canSoloShift: boolean;
  reliabilityTag: boolean;
  isManualAdded: boolean;
}

export interface CollectionDetailSlot {
  workDate: string;
  weekday: number;
  dateLabel: string;
  shiftTemplateId: number;
  shiftLabel: string;
  startTime: string;
  endTime: string;
  defaultRequiredCount: number;
  minCount: number;
  allowSolo: boolean;
  availableCount: number;
  riskLevel: AvailabilityRiskLevel;
  riskLabel: string;
  members: CollectionDetailMember[];
}

export interface CollectionDetailPayload {
  collectionId: number;
  title: string;
  teachingWeek: number | null;
  weekLabel: string;
  status: 'pending' | 'active' | 'completed';
  totalUsers: number;
  submittedUsers: number;
  progressPercent: number;
  slots: CollectionDetailSlot[];
  candidateMembers: Array<{
    userId: number;
    studentId: string;
    name: string;
    gender: 'male' | 'female';
    college: string;
    grade: string;
    role: 'assistant' | 'admin' | 'super_admin';
    memberType: 'new_assistant' | 'senior_assistant' | 'intern_assistant' | 'manager_assistant';
  }>;
}

export interface ManualAvailabilityMutationInput {
  action: 'add' | 'remove';
  workDate: string;
  shiftTemplateId: number;
  userId: number;
}
