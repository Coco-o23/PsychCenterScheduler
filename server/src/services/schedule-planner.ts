import type {
  AssignmentPlan,
  CandidateUser,
  GenerateSchedulePlansResult,
  ScheduleAssignedMember,
  SchedulePlanSummary,
  ScheduleRiskTag,
  ScheduleRuleConfig,
  ScheduleSlotPayload,
  ScheduleStrategyKey,
  ShiftSlot,
} from '../models/schedule';

const STRATEGY_META: Record<
  ScheduleStrategyKey,
  { name: string; passTargets: Array<'coverage' | 'min' | 'required'> }
> = {
  coverage_first: {
    name: '覆盖优先',
    passTargets: ['coverage', 'min', 'required'],
  },
  full_staffing_first: {
    name: '满员优先',
    passTargets: ['required'],
  },
  balanced_fairness: {
    name: '均衡优先',
    passTargets: ['coverage', 'required'],
  },
};

interface PlannerInput {
  slots: ShiftSlot[];
  users: CandidateUser[];
  ruleConfig: ScheduleRuleConfig;
}

interface PlannerUserState extends CandidateUser {
  assignedCount: number;
}

interface SlotAssignmentState {
  slot: ShiftSlot;
  assignedUserIds: number[];
}

function cloneUser(input: CandidateUser): PlannerUserState {
  return {
    ...input,
    assignedCount: input.assignedCount,
    availableSlotIds: [...input.availableSlotIds],
  };
}

function isNewAssistant(memberType: CandidateUser['memberType']): boolean {
  return memberType === 'new_assistant' || memberType === 'intern_assistant';
}

function isSeniorAssistant(memberType: CandidateUser['memberType']): boolean {
  return memberType === 'senior_assistant' || memberType === 'manager_assistant';
}

function dedupeRiskTags(tags: ScheduleRiskTag[]): ScheduleRiskTag[] {
  return Array.from(new Set(tags));
}

function toRiskPresentation(tags: ScheduleRiskTag[]): {
  riskLevel: ScheduleSlotPayload['riskLevel'];
  riskLabel: string;
} {
  if (tags.includes('NO_CANDIDATE')) {
    return {
      riskLevel: 'critical',
      riskLabel: '无人可排',
    };
  }

  if (
    tags.includes('UNDER_MIN_COUNT') ||
    tags.includes('NEW_ASSISTANT_ALONE') ||
    tags.includes('SINGLE_SHIFT')
  ) {
    return {
      riskLevel: 'warning',
      riskLabel: '需人工调整',
    };
  }

  if (tags.length > 0) {
    return {
      riskLevel: 'warning',
      riskLabel: '存在偏好风险',
    };
  }

  return {
    riskLevel: 'none',
    riskLabel: '',
  };
}

function computeAssignedMemberRiskTags(
  slot: ShiftSlot,
  members: CandidateUser[],
  ruleConfig: ScheduleRuleConfig,
): ScheduleRiskTag[] {
  const tags: ScheduleRiskTag[] = [];

  if (members.length === 0) {
    tags.push('NO_CANDIDATE');
    tags.push('UNDER_MIN_COUNT');
    tags.push('UNDER_REQUIRED_COUNT');
    return dedupeRiskTags(tags);
  }

  if (members.length < slot.minCount) {
    tags.push('UNDER_MIN_COUNT');
  }

  if (members.length < slot.requiredCount) {
    tags.push('UNDER_REQUIRED_COUNT');
  }

  if (members.length === 1) {
    tags.push('SINGLE_SHIFT');

    if (isNewAssistant(members[0].memberType)) {
      tags.push('NEW_ASSISTANT_ALONE');
    }

    if (!slot.allowSingle || !members[0].canSoloShift) {
      tags.push('UNDER_REQUIRED_COUNT');
    }
  }

  const hasNew = members.some((member) => isNewAssistant(member.memberType));
  const hasSenior = members.some((member) => isSeniorAssistant(member.memberType));

  if (hasNew && !hasSenior) {
    tags.push('NO_SENIOR_WITH_NEW');
  }

  if (members.length >= 2) {
    const colleges = new Set(members.map((member) => member.college));
    const grades = new Set(members.map((member) => member.grade));
    const genders = new Set(members.map((member) => member.gender));

    if (ruleConfig.preferCrossCollege && colleges.size < 2) {
      tags.push('SAME_COLLEGE');
    }

    if (ruleConfig.preferCrossGrade && grades.size < 2) {
      tags.push('SAME_GRADE');
    }

    if (ruleConfig.preferGenderBalance && genders.size < 2) {
      tags.push('SAME_GENDER');
    }
  }

  members.forEach((member) => {
    if (member.assignedCount > member.maxWeeklyShifts) {
      tags.push('OVER_MAX_WEEKLY_SHIFTS');
    }
  });

  return dedupeRiskTags(tags);
}

function summarizePlan(slots: ScheduleSlotPayload[], users: PlannerUserState[]): SchedulePlanSummary {
  const totalAssignments = slots.reduce((sum, slot) => sum + slot.assignedCount, 0);
  const assignedCounts = users.map((user) => user.assignedCount);
  const averageAssignedCount = users.length > 0 ? totalAssignments / users.length : 0;

  return {
    totalSlots: slots.length,
    fullStaffedSlots: slots.filter((slot) => slot.assignedCount >= slot.defaultRequiredCount).length,
    coveredSlots: slots.filter((slot) => slot.assignedCount > 0).length,
    emptySlots: slots.filter((slot) => slot.assignedCount === 0).length,
    singlePersonSlots: slots.filter((slot) => slot.assignedCount === 1).length,
    underRequiredSlots: slots.filter((slot) => slot.assignedCount < slot.defaultRequiredCount).length,
    averageAssignedCount: Number(averageAssignedCount.toFixed(2)),
    maxAssignedCount: assignedCounts.length > 0 ? Math.max(...assignedCounts) : 0,
    minAssignedCount: assignedCounts.length > 0 ? Math.min(...assignedCounts) : 0,
    riskCount: slots.reduce((sum, slot) => sum + slot.riskTags.length, 0),
  };
}

function scorePlan(
  strategyKey: ScheduleStrategyKey,
  slots: ScheduleSlotPayload[],
  summary: SchedulePlanSummary,
): number {
  let score = 1000;

  for (const slot of slots) {
    if (slot.riskTags.includes('NO_CANDIDATE')) {
      score -= strategyKey === 'coverage_first' ? 220 : 260;
    }

    if (slot.riskTags.includes('UNDER_MIN_COUNT')) {
      score -= 160;
    }

    if (slot.riskTags.includes('UNDER_REQUIRED_COUNT')) {
      score -= strategyKey === 'full_staffing_first' ? 90 : 60;
    }

    if (slot.riskTags.includes('SINGLE_SHIFT')) {
      score -= strategyKey === 'full_staffing_first' ? 80 : 45;
    }

    if (slot.riskTags.includes('NEW_ASSISTANT_ALONE')) {
      score -= 140;
    }

    if (slot.riskTags.includes('NO_SENIOR_WITH_NEW')) {
      score -= 80;
    }

    if (slot.riskTags.includes('SAME_COLLEGE')) {
      score -= strategyKey === 'balanced_fairness' ? 30 : 12;
    }

    if (slot.riskTags.includes('SAME_GRADE')) {
      score -= strategyKey === 'balanced_fairness' ? 30 : 12;
    }

    if (slot.riskTags.includes('SAME_GENDER')) {
      score -= strategyKey === 'balanced_fairness' ? 24 : 10;
    }

    if (slot.riskTags.includes('OVER_MAX_WEEKLY_SHIFTS')) {
      score -= 200;
    }
  }

  if (strategyKey === 'coverage_first') {
    score += summary.coveredSlots * 24;
    score += summary.fullStaffedSlots * 8;
  } else if (strategyKey === 'full_staffing_first') {
    score += summary.fullStaffedSlots * 26;
    score += summary.coveredSlots * 14;
  } else {
    const fairnessGap = summary.maxAssignedCount - summary.minAssignedCount;
    score += summary.fullStaffedSlots * 18;
    score += summary.coveredSlots * 16;
    score -= fairnessGap * 24;
  }

  return Math.max(0, Math.round(score / 10));
}

function computeSlotScarcity(slot: ShiftSlot): number {
  const candidateCount = slot.candidates.length;
  const shortage = slot.requiredCount - candidateCount;
  const soloCapableCount = slot.candidates.filter((candidate) => candidate.canSoloShift).length;
  const seniorCount = slot.candidates.filter((candidate) => isSeniorAssistant(candidate.memberType)).length;

  return (
    Math.max(0, shortage) * 1000 +
    Math.max(0, slot.minCount - candidateCount) * 1500 +
    (candidateCount === 0 ? 3000 : 0) +
    (candidateCount === 1 ? 1800 : 0) +
    Math.max(0, 4 - candidateCount) * 200 +
    Math.max(0, 2 - soloCapableCount) * 60 +
    Math.max(0, 2 - seniorCount) * 50
  );
}

function buildUserScarcityMap(slots: ShiftSlot[], users: PlannerUserState[]): Map<number, number> {
  const slotCandidateCountMap = new Map(slots.map((slot) => [slot.slotId, slot.candidates.length]));
  const result = new Map<number, number>();

  users.forEach((user) => {
    const coverageWeight = user.availableSlotIds.reduce((sum, slotId) => {
      const count = slotCandidateCountMap.get(slotId) ?? 1;
      return sum + 100 / Math.max(1, count);
    }, 0);
    const availabilityPenalty = 200 / Math.max(1, user.availableSlotIds.length);
    result.set(user.userId, Number((coverageWeight + availabilityPenalty).toFixed(2)));
  });

  return result;
}

function getTargetCount(slot: ShiftSlot, stage: 'coverage' | 'min' | 'required'): number {
  if (stage === 'coverage') {
    return Math.min(Math.max(slot.minCount, 1), slot.requiredCount);
  }

  if (stage === 'min') {
    return Math.max(slot.minCount, 1);
  }

  return slot.requiredCount;
}

function sortSlotsForStrategy(slots: ShiftSlot[], strategyKey: ScheduleStrategyKey): ShiftSlot[] {
  return [...slots].sort((left, right) => {
    const leftScarcity = computeSlotScarcity(left);
    const rightScarcity = computeSlotScarcity(right);

    if (strategyKey === 'full_staffing_first') {
      const leftShortage = left.requiredCount - left.candidates.length;
      const rightShortage = right.requiredCount - right.candidates.length;

      if (rightShortage !== leftShortage) {
        return rightShortage - leftShortage;
      }
    }

    if (rightScarcity !== leftScarcity) {
      return rightScarcity - leftScarcity;
    }

    if (left.candidates.length !== right.candidates.length) {
      return left.candidates.length - right.candidates.length;
    }

    return left.slotId.localeCompare(right.slotId);
  });
}

function buildAssignedMemberSnapshot(user: PlannerUserState): ScheduleAssignedMember {
  return {
    userId: user.userId,
    studentId: user.studentId,
    name: user.name,
    gender: user.gender,
    college: user.college,
    grade: user.grade,
    role: user.role,
    memberType: user.memberType,
    canSoloShift: user.canSoloShift,
    reliabilityTag: user.reliabilityTag,
    isManualAdded: user.isManualAdded,
    assignmentId: null,
    assignmentSource: 'auto',
    riskTags: [],
    notes: null,
    maxWeeklyShifts: user.maxWeeklyShifts,
  };
}

function scoreCandidateForSlot(params: {
  strategyKey: ScheduleStrategyKey;
  slot: ShiftSlot;
  candidate: PlannerUserState;
  assignedMembers: PlannerUserState[];
  ruleConfig: ScheduleRuleConfig;
  slotScarcity: number;
}): number {
  const { strategyKey, slot, candidate, assignedMembers, ruleConfig, slotScarcity } = params;
  let score = 0;
  const abundancePenalty = Math.max(0, 320 - slotScarcity) / 32;

  score += candidate.assignedCount * (strategyKey === 'balanced_fairness' ? 28 : 18);
  score += candidate.userScarcityValue * abundancePenalty;

  if (candidate.assignedCount >= candidate.maxWeeklyShifts) {
    score += 10000;
  }

  if (strategyKey !== 'coverage_first' && ruleConfig.prioritizeReliability && !candidate.reliabilityTag) {
    score += 6;
  }

  if (!slot.allowSingle && assignedMembers.length === 0 && !candidate.canSoloShift) {
    score += 6;
  }

  if (assignedMembers.length === 0 && isNewAssistant(candidate.memberType)) {
    score += 20;
  }

  if (assignedMembers.length === 0 && isSeniorAssistant(candidate.memberType)) {
    score -= 8;
  }

  const currentColleges = new Set(assignedMembers.map((member) => member.college));
  const currentGrades = new Set(assignedMembers.map((member) => member.grade));
  const currentGenders = new Set(assignedMembers.map((member) => member.gender));
  const hasNew = assignedMembers.some((member) => isNewAssistant(member.memberType));
  const hasSenior = assignedMembers.some((member) => isSeniorAssistant(member.memberType));

  if (ruleConfig.preferCrossCollege && currentColleges.has(candidate.college)) {
    score += strategyKey === 'balanced_fairness' ? 20 : 8;
  }

  if (ruleConfig.preferCrossGrade && currentGrades.has(candidate.grade)) {
    score += strategyKey === 'balanced_fairness' ? 18 : 8;
  }

  if (ruleConfig.preferGenderBalance && currentGenders.has(candidate.gender)) {
    score += strategyKey === 'balanced_fairness' ? 16 : 6;
  }

  if (ruleConfig.preferSeniorNewPair) {
    if (hasNew && !isSeniorAssistant(candidate.memberType)) {
      score += 28;
    }

    if (hasSenior && !isNewAssistant(candidate.memberType)) {
      score += 12;
    }

    if (hasNew && isSeniorAssistant(candidate.memberType)) {
      score -= 24;
    }
  }

  if (
    strategyKey === 'coverage_first' &&
    assignedMembers.length === 0 &&
    slot.requiredCount === 1 &&
    candidate.canSoloShift
  ) {
    score -= 18;
  }

  return score;
}

function createStrategyPlan(
  input: PlannerInput,
  strategyKey: ScheduleStrategyKey,
): AssignmentPlan {
  const users = input.users.map(cloneUser);
  const usersById = new Map(users.map((user) => [user.userId, user]));
  const scarcityMap = buildUserScarcityMap(input.slots, users);

  users.forEach((user) => {
    user.userScarcityValue = scarcityMap.get(user.userId) ?? 0;
  });

  const assignments = new Map<string, SlotAssignmentState>(
    input.slots.map((slot) => [
      slot.slotId,
      {
        slot,
        assignedUserIds: [],
      },
    ]),
  );
  const orderedSlots = sortSlotsForStrategy(input.slots, strategyKey);

  for (const stage of STRATEGY_META[strategyKey].passTargets) {
    for (const slot of orderedSlots) {
      const state = assignments.get(slot.slotId);

      if (!state) {
        continue;
      }

      const targetCount = getTargetCount(slot, stage);

      while (state.assignedUserIds.length < targetCount) {
        const assignedMembers = state.assignedUserIds
          .map((userId) => usersById.get(userId) ?? null)
          .filter((item): item is PlannerUserState => item !== null);
        const slotScarcity = computeSlotScarcity(slot);
        const candidate = slot.candidates
          .map((candidateMember) => usersById.get(candidateMember.userId) ?? null)
          .filter((item): item is PlannerUserState => item !== null)
          .filter((candidateUser) => !state.assignedUserIds.includes(candidateUser.userId))
          .sort(
            (left, right) =>
              scoreCandidateForSlot({
                strategyKey,
                slot,
                candidate: left,
                assignedMembers,
                ruleConfig: input.ruleConfig,
                slotScarcity,
              }) -
              scoreCandidateForSlot({
                strategyKey,
                slot,
                candidate: right,
                assignedMembers,
                ruleConfig: input.ruleConfig,
                slotScarcity,
              }),
          )[0];

        if (!candidate) {
          break;
        }

        state.assignedUserIds.push(candidate.userId);
        candidate.assignedCount += 1;
      }
    }
  }

  const slots = input.slots.map((slot) => {
    const state = assignments.get(slot.slotId);
    const assignedMembers = (state?.assignedUserIds ?? [])
      .map((userId) => usersById.get(userId) ?? null)
      .filter((item): item is PlannerUserState => item !== null);
    const riskTags = computeAssignedMemberRiskTags(slot, assignedMembers, input.ruleConfig);
    const riskPresentation = toRiskPresentation(riskTags);

    return {
      slotId: slot.slotId,
      workDate: slot.date,
      weekday: slot.weekday,
      dateLabel: slot.dateLabel,
      shiftTemplateId: slot.shiftTemplateId,
      shiftLabel: slot.shiftLabel,
      startTime: slot.startTime,
      endTime: slot.endTime,
      defaultRequiredCount: slot.requiredCount,
      minCount: slot.minCount,
      allowSolo: slot.allowSingle,
      assignedCount: assignedMembers.length,
      riskLevel: riskPresentation.riskLevel,
      riskLabel: riskPresentation.riskLabel,
      riskTags,
      assignedMembers: assignedMembers.map((member) => ({
        ...buildAssignedMemberSnapshot(member),
        riskTags,
      })),
    } satisfies ScheduleSlotPayload;
  });

  const summary = summarizePlan(slots, users);
  const score = scorePlan(strategyKey, slots, summary);

  return {
    strategyKey,
    strategyName: STRATEGY_META[strategyKey].name,
    score,
    summary,
    slots,
  };
}

export function generateSchedulePlans(input: PlannerInput): GenerateSchedulePlansResult {
  const plans = (Object.keys(STRATEGY_META) as ScheduleStrategyKey[]).map((strategyKey) =>
    createStrategyPlan(input, strategyKey),
  );
  const recommendedStrategy =
    [...plans].sort((left, right) => right.score - left.score)[0]?.strategyKey ?? 'coverage_first';

  return {
    plans,
    recommendedStrategy,
  };
}
