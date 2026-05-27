import type { AvailabilityRiskLevel, CollectionDetailMember } from './availability';

export type ScheduleStatus = 'none' | 'draft' | 'published' | 'adjusted';
export type SchedulePreferenceKey =
  | 'preferCrossCollege'
  | 'preferCrossGrade'
  | 'preferGenderBalance'
  | 'preferSeniorNewPair'
  | 'prioritizeReliability';

export type ScheduleStrategyKey =
  | 'coverage_first'
  | 'full_staffing_first'
  | 'balanced_fairness';

export type ScheduleRiskTag =
  | 'NO_CANDIDATE'
  | 'UNDER_MIN_COUNT'
  | 'UNDER_REQUIRED_COUNT'
  | 'SINGLE_SHIFT'
  | 'NEW_ASSISTANT_ALONE'
  | 'NO_SENIOR_WITH_NEW'
  | 'SAME_COLLEGE'
  | 'SAME_GRADE'
  | 'SAME_GENDER'
  | 'OVER_MAX_WEEKLY_SHIFTS';

export interface ScheduleRuleConfig {
  preferCrossCollege: boolean;
  preferCrossGrade: boolean;
  preferGenderBalance: boolean;
  preferSeniorNewPair: boolean;
  prioritizeReliability: boolean;
}

export interface ShiftSlot {
  slotId: string;
  date: string;
  weekday: number;
  dateLabel: string;
  shiftTemplateId: number;
  shiftLabel: string;
  startTime: string;
  endTime: string;
  requiredCount: number;
  minCount: number;
  allowSingle: boolean;
  candidates: CollectionDetailMember[];
}

export interface CandidateUser extends CollectionDetailMember {
  maxWeeklyShifts: number;
  assignedCount: number;
  availableSlotIds: string[];
  userScarcityValue: number;
}

export interface ScheduleAssignedMember extends CollectionDetailMember {
  assignmentId: number | null;
  assignmentSource: 'auto' | 'manual' | 'swap';
  riskTags: ScheduleRiskTag[];
  notes: string | null;
  maxWeeklyShifts: number;
}

export interface ScheduleSlotPayload {
  slotId: string;
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
  assignedCount: number;
  riskLevel: AvailabilityRiskLevel;
  riskLabel: string;
  riskTags: ScheduleRiskTag[];
  assignedMembers: ScheduleAssignedMember[];
}

export interface ScheduleCandidateMember extends CollectionDetailMember {
  recommended: boolean;
  summary: string;
}

export interface SchedulePlanSummary {
  totalSlots: number;
  fullStaffedSlots: number;
  coveredSlots: number;
  emptySlots: number;
  singlePersonSlots: number;
  underRequiredSlots: number;
  averageAssignedCount: number;
  maxAssignedCount: number;
  minAssignedCount: number;
  riskCount: number;
}

export interface AssignmentPlan {
  strategyKey: ScheduleStrategyKey;
  strategyName: string;
  score: number;
  summary: SchedulePlanSummary;
  slots: ScheduleSlotPayload[];
}

export interface ScheduleWorkspacePayload {
  collectionId: number;
  title: string;
  teachingWeek: number | null;
  weekLabel: string;
  collectionStatus: 'pending' | 'active' | 'completed';
  totalUsers: number;
  submittedUsers: number;
  progressPercent: number;
  scheduleId: number | null;
  scheduleStatus: ScheduleStatus;
  confirmedAt: string | null;
  ruleConfig: ScheduleRuleConfig;
  plans: AssignmentPlan[];
  recommendedStrategy: ScheduleStrategyKey | null;
  selectedStrategyKey: ScheduleStrategyKey | null;
  candidateMembers: ScheduleCandidateMember[];
}

export interface StoredScheduleDraft {
  ruleConfig: ScheduleRuleConfig;
  recommendedStrategy: ScheduleStrategyKey | null;
  selectedStrategyKey: ScheduleStrategyKey | null;
  plans: AssignmentPlan[];
}

export interface GenerateSchedulePlansResult {
  plans: AssignmentPlan[];
  recommendedStrategy: ScheduleStrategyKey;
}

export interface SaveScheduleRulesInput extends ScheduleRuleConfig {}

export interface ManualScheduleAssignmentInput {
  action: 'add' | 'remove';
  strategyKey: ScheduleStrategyKey;
  workDate: string;
  shiftTemplateId: number;
  userId: number;
}

export interface PublishScheduleInput {
  strategyKey: ScheduleStrategyKey;
}
