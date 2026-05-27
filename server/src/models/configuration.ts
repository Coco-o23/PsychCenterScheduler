export type GradeUpdateStatus = 'pending' | 'confirmed' | 'skipped';
export type WorkdayOverrideType = 'workday' | 'non_workday' | 'no_shift';

export interface SemesterConfiguration {
  semesterId: number;
  name: string;
  firstWeekStartDate: string;
  totalWeeks: number;
  gradeUpdateStatus: GradeUpdateStatus;
  isCurrent: boolean;
  currentTeachingWeek: number | null;
}

export interface ShiftTemplateConfiguration {
  shiftTemplateId: number;
  name: string;
  startTime: string;
  endTime: string;
  defaultRequiredCount: number;
  minCount: number;
  allowSolo: boolean;
  sortOrder: number;
  isActive: boolean;
}

export interface WorkdayOverrideConfiguration {
  overrideId: number;
  workDate: string;
  overrideType: WorkdayOverrideType;
  reason: string | null;
}

export interface DefaultAvailabilitySlot {
  shiftIndex: number;
  weekday: number;
}

export interface DefaultAvailabilityConfiguration {
  selectedSlots: DefaultAvailabilitySlot[];
}

export interface SchedulerWorkSettings {
  weeklyWorkdays: number[];
  maxWeeklyShiftsLimit: number;
  exportDirectory: string;
  shiftTemplates: ShiftTemplateConfiguration[];
  overrides: WorkdayOverrideConfiguration[];
}

export interface UpdateSemesterInput {
  name: string;
  firstWeekStartDate: string;
  totalWeeks: number;
}

export interface GradeUpdatePreviewItem {
  userId: number;
  studentId: string;
  name: string;
  currentGrade: string;
  nextGrade: string;
  willChange: boolean;
}

export interface GradeUpdatePreviewSummary {
  totalUsers: number;
  changedUsers: number;
  unchangedUsers: number;
  items: GradeUpdatePreviewItem[];
}

export interface ShiftTemplateInput {
  name: string;
  startTime: string;
  endTime: string;
  defaultRequiredCount: number;
  minCount: number;
  allowSolo: boolean;
}

export interface WorkdayOverrideInput {
  workDate: string;
  overrideType: WorkdayOverrideType;
  reason: string | null;
}

export interface UpdateWorkSettingsInput {
  weeklyWorkdays: number[];
  exportDirectory: string;
  shiftTemplates: ShiftTemplateInput[];
  overrides: WorkdayOverrideInput[];
}
