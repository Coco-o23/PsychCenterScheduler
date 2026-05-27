import assert from 'node:assert/strict';
import type {
  CandidateUser,
  ScheduleRuleConfig,
  ShiftSlot,
} from '../models/schedule';
import { generateSchedulePlans } from './schedule-planner';

const DEFAULT_RULE_CONFIG: ScheduleRuleConfig = {
  preferCrossCollege: true,
  preferCrossGrade: true,
  preferGenderBalance: true,
  preferSeniorNewPair: true,
  prioritizeReliability: true,
};

function createUser(
  userId: number,
  slotIds: string[],
  options: Partial<CandidateUser> = {},
): CandidateUser {
  return {
    userId,
    name: `助理${userId}`,
    studentId: `A${String(userId).padStart(4, '0')}`,
    gender: userId % 2 === 0 ? 'female' : 'male',
    college: `学院${(userId % 3) + 1}`,
    grade: `${2023 + (userId % 3)}`,
    role: 'assistant',
    memberType: userId % 4 === 0 ? 'senior_assistant' : 'new_assistant',
    canSoloShift: userId % 4 === 0,
    reliabilityTag: userId % 5 !== 0,
    isManualAdded: false,
    maxWeeklyShifts: 2,
    assignedCount: 0,
    availableSlotIds: slotIds,
    userScarcityValue: 0,
    ...options,
  };
}

function createSlot(
  slotId: string,
  candidateUsers: CandidateUser[],
  options: Partial<ShiftSlot> = {},
): ShiftSlot {
  const [date, shiftTemplateIdText] = slotId.split('-slot-');

  return {
    slotId,
    date,
    weekday: Number(options.weekday ?? 1),
    dateLabel: options.dateLabel ?? date,
    shiftTemplateId: Number(shiftTemplateIdText),
    shiftLabel: options.shiftLabel ?? '上午班',
    startTime: options.startTime ?? '08:30',
    endTime: options.endTime ?? '13:00',
    requiredCount: options.requiredCount ?? 2,
    minCount: options.minCount ?? 1,
    allowSingle: options.allowSingle ?? true,
    candidates: candidateUsers,
  };
}

export const SCHEDULE_PLANNER_CASES = {
  enoughPeople(): void {
    const users = [
      createUser(1, ['2026-05-19-slot-1', '2026-05-20-slot-1']),
      createUser(2, ['2026-05-19-slot-1', '2026-05-20-slot-1']),
      createUser(3, ['2026-05-19-slot-1', '2026-05-20-slot-1']),
      createUser(4, ['2026-05-19-slot-1', '2026-05-20-slot-1'], { memberType: 'senior_assistant', canSoloShift: true }),
    ];
    const slots = [
      createSlot('2026-05-19-slot-1', users, { weekday: 2 }),
      createSlot('2026-05-20-slot-1', users, { weekday: 3 }),
    ];
    const result = generateSchedulePlans({ slots, users, ruleConfig: DEFAULT_RULE_CONFIG });

    assert.equal(result.plans.length, 3);
    assert.ok(result.plans.every((plan) => plan.summary.coveredSlots === 2));
  },

  scarceThursdayFriday(): void {
    const common = [
      createUser(1, ['2026-05-19-slot-1', '2026-05-20-slot-1', '2026-05-22-slot-1', '2026-05-23-slot-1']),
      createUser(2, ['2026-05-19-slot-1', '2026-05-20-slot-1', '2026-05-22-slot-1', '2026-05-23-slot-1']),
      createUser(3, ['2026-05-19-slot-1', '2026-05-20-slot-1']),
      createUser(4, ['2026-05-22-slot-1', '2026-05-23-slot-1'], { memberType: 'senior_assistant', canSoloShift: true }),
    ];
    const slots = [
      createSlot('2026-05-19-slot-1', common.slice(0, 3), { weekday: 2 }),
      createSlot('2026-05-20-slot-1', common.slice(0, 3), { weekday: 3 }),
      createSlot('2026-05-22-slot-1', [common[0], common[1], common[3]], { weekday: 5 }),
      createSlot('2026-05-23-slot-1', [common[0], common[1], common[3]], { weekday: 6 }),
    ];
    const result = generateSchedulePlans({ slots, users: common, ruleConfig: DEFAULT_RULE_CONFIG });
    const coveragePlan = result.plans.find((plan) => plan.strategyKey === 'coverage_first');

    assert.ok(coveragePlan);
    assert.ok((coveragePlan?.summary.emptySlots ?? 99) <= 1);
  },

  soloShiftUsesSoloCapable(): void {
    const users = [
      createUser(1, ['2026-05-19-slot-1'], { canSoloShift: false, memberType: 'new_assistant' }),
      createUser(2, ['2026-05-19-slot-1'], { canSoloShift: true, memberType: 'senior_assistant' }),
    ];
    const slots = [
      createSlot('2026-05-19-slot-1', users, {
        weekday: 2,
        requiredCount: 1,
        minCount: 1,
        allowSingle: true,
      }),
    ];
    const result = generateSchedulePlans({ slots, users, ruleConfig: DEFAULT_RULE_CONFIG });
    const plan = result.plans.find((item) => item.strategyKey === 'coverage_first');

    assert.ok(plan);
    assert.equal(plan?.slots[0].assignedMembers[0]?.userId, 2);
  },

  balancedFairnessShouldDiffer(): void {
    const users = [
      createUser(1, ['2026-05-19-slot-1', '2026-05-20-slot-1', '2026-05-21-slot-1']),
      createUser(2, ['2026-05-19-slot-1', '2026-05-20-slot-1', '2026-05-21-slot-1']),
      createUser(3, ['2026-05-19-slot-1', '2026-05-20-slot-1', '2026-05-21-slot-1']),
      createUser(4, ['2026-05-19-slot-1', '2026-05-20-slot-1', '2026-05-21-slot-1'], { memberType: 'senior_assistant', canSoloShift: true }),
    ];
    const slots = [
      createSlot('2026-05-19-slot-1', users, { weekday: 2 }),
      createSlot('2026-05-20-slot-1', users, { weekday: 3 }),
      createSlot('2026-05-21-slot-1', users, { weekday: 4 }),
    ];
    const result = generateSchedulePlans({ slots, users, ruleConfig: DEFAULT_RULE_CONFIG });
    const coverage = result.plans.find((plan) => plan.strategyKey === 'coverage_first');
    const balanced = result.plans.find((plan) => plan.strategyKey === 'balanced_fairness');

    assert.ok(coverage && balanced);
    assert.notDeepEqual(
      coverage?.slots.map((slot) => slot.assignedMembers.map((member) => member.userId)),
      balanced?.slots.map((slot) => slot.assignedMembers.map((member) => member.userId)),
    );
  },
};

export function runSchedulePlannerSelfChecks(): void {
  SCHEDULE_PLANNER_CASES.enoughPeople();
  SCHEDULE_PLANNER_CASES.scarceThursdayFriday();
  SCHEDULE_PLANNER_CASES.soloShiftUsesSoloCapable();
  SCHEDULE_PLANNER_CASES.balancedFairnessShouldDiffer();
}
