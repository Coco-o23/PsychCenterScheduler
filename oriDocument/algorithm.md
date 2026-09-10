# 排班算法说明

本文档对应当前项目中的排班规划器实现：

- `server/src/services/schedule-planner.ts`

当前系统不是三套彼此独立的排班器，而是**一套共享的贪心分配框架**，在同一套候选人评分机制上派生出三种策略：

1. `coverage_first`
2. `full_staffing_first`
3. `balanced_fairness`

## 1. 整体结构

入口函数是：

- `generateSchedulePlans(input)`

它会对三种 `strategyKey` 分别执行一次 `createStrategyPlan(...)`，得到三份 `AssignmentPlan`，然后按总分排序，选出 `recommendedStrategy`。

相关流程：

1. 为每个策略生成一份方案
2. 每份方案内部执行同一套“按槽位分配成员”的流程
3. 生成每个槽位的风险标签、风险等级、已分配成员
4. 汇总得到方案摘要 `summary`
5. 对整份方案打总分 `score`
6. 选择分数最高的方案作为推荐方案

## 2. 三个方案的定义

三个策略定义在 `STRATEGY_META`：

- `coverage_first`
  - 名称：覆盖优先
  - 分配轮次：`coverage -> min -> required`

- `full_staffing_first`
  - 名称：满员优先
  - 分配轮次：`required`

- `balanced_fairness`
  - 名称：均衡优先
  - 分配轮次：`coverage -> required`

这里的三个阶段含义如下：

- `coverage`
  - 目标是让班次至少有人，并尽量先达到 `max(minCount, 1)`
- `min`
  - 目标是补到最低需求人数 `minCount`
- `required`
  - 目标是补到默认需求人数 `requiredCount`

## 3. 三个方案分别怎么做

### 3.1 覆盖优先 `coverage_first`

目标：

- 尽量先避免空班
- 在人手不足时优先提高“被覆盖班次数”
- 满员不是第一目标

代码特征：

1. 分配轮次最完整：
   - 先 `coverage`
   - 再 `min`
   - 最后 `required`

2. 方案评分更偏向覆盖：
   - `summary.coveredSlots` 权重更高
   - `summary.fullStaffedSlots` 权重较低

3. 风险惩罚相对宽松：
   - 对 `UNDER_REQUIRED_COUNT`
   - 对 `SINGLE_SHIFT`
   相比“满员优先”处罚更轻

4. 候选人选择上，在某些只需单人的场景会偏向能单独值班的人：
   - `slot.requiredCount === 1`
   - `candidate.canSoloShift === true`

适用场景：

- 人手紧张
- 目标是尽量每个班都有人
- 接受部分班次不满员

### 3.2 满员优先 `full_staffing_first`

目标：

- 优先把班次尽量补满到 `requiredCount`
- 更重视满员率，不优先照顾“先全覆盖”

代码特征：

1. 分配轮次只有一轮：
   - 直接执行 `required`

2. 槽位排序更偏向“缺口大”的班次：
   - 在 `sortSlotsForStrategy(...)` 里优先比较：
     - `requiredCount - candidates.length`

3. 风险惩罚更重：
   - `UNDER_REQUIRED_COUNT`
   - `SINGLE_SHIFT`
   - `NO_CANDIDATE`
   在这个策略下扣分更明显

4. 总分更偏向满员结果：
   - `summary.fullStaffedSlots` 权重最高
   - `summary.coveredSlots` 其次

适用场景：

- 更在意“每班尽量配够人”
- 对关键班次满员有较强要求
- 可以接受部分次要班次被牺牲

### 3.3 均衡优先 `balanced_fairness`

目标：

- 在保证可排班的基础上，让排班分布更均衡
- 减少某些人排得过多、某些人排得过少
- 更关注成员搭配多样性

代码特征：

1. 分配轮次：
   - 先 `coverage`
   - 再 `required`

2. 候选人打分更重视公平性：
   - `candidate.assignedCount` 的影响更大
   - 已经排班较多的人更容易被排后

3. 对同质化搭配处罚更重：
   - `SAME_COLLEGE`
   - `SAME_GRADE`
   - `SAME_GENDER`
   在该策略下扣分比其他策略更高

4. 总分显式惩罚分配不均：
   - 使用 `fairnessGap = maxAssignedCount - minAssignedCount`
   - `score -= fairnessGap * 24`

适用场景：

- 候选人较充足
- 更关心排班公平性
- 更关心团队搭配质量

## 4. 三个方案共享的底层逻辑

### 4.1 用户状态初始化

每次生成某个策略方案时：

- `input.users` 会被 `cloneUser(...)` 复制为 `PlannerUserState`
- 记录动态状态：
  - `assignedCount`
  - `availableSlotIds`
  - `userScarcityValue`

其中 `userScarcityValue` 由 `buildUserScarcityMap(...)` 计算，用来表示某个成员对于稀缺时段的重要性。

### 4.2 槽位稀缺度计算

函数：

- `computeSlotScarcity(slot)`

它综合考虑：

- 候选人数是否少于 `requiredCount`
- 是否少于 `minCount`
- 候选人数是否为 0
- 候选人数是否为 1
- 能单独值班的人是否不足
- 高年级/资深成员是否不足

稀缺度越高，说明这个班次越难排，应越早处理。

### 4.3 槽位排序

函数：

- `sortSlotsForStrategy(slots, strategyKey)`

共同规则：

- 都会优先处理更稀缺的槽位

特殊规则：

- `full_staffing_first` 会额外优先处理“距离满员更远”的槽位

### 4.4 分阶段填充

函数：

- `getTargetCount(slot, stage)`

根据阶段返回本轮目标人数：

- `coverage`
  - 至少覆盖到 `max(minCount, 1)`，但不超过 `requiredCount`
- `min`
  - 补到 `minCount`
- `required`
  - 补到 `requiredCount`

### 4.5 候选人打分

函数：

- `scoreCandidateForSlot(...)`

分值越低，越优先被选中。

主要影响因素：

1. 已分配次数
   - `candidate.assignedCount`
   - 在 `balanced_fairness` 下惩罚更重

2. 成员稀缺度
   - `candidate.userScarcityValue`
   - 稀缺成员在某些班次会被保留，避免浪费在不紧缺位置

3. 是否超过个人最大排班数
   - `assignedCount >= maxWeeklyShifts`
   - 会被大幅加罚

4. 是否优先可靠成员
   - 当策略不是 `coverage_first` 且规则要求优先可靠成员时
   - 非可靠成员会被加罚

5. 是否允许单人值班
   - 如果槽位不允许单人且当前是第一个人
   - `canSoloShift` 不满足会被加罚

6. 新老助理搭配偏好
   - 新助理单独上首位会被加罚
   - 资深助理在需要带新人的时候可能被优先

7. 搭配多样性偏好
   - 同学院
   - 同年级
   - 同性别
   在均衡策略下惩罚更重

### 4.6 实际分配过程

在 `createStrategyPlan(...)` 里：

1. 先按策略得到排序后的槽位列表
2. 按策略定义的分配轮次循环
3. 对每个槽位：
   - 计算当前已分配成员
   - 从候选池中过滤未被该槽位选中过的人
   - 对候选人打分
   - 选择分数最低者加入
4. 直到该阶段目标人数达到，或者没有可选成员

这是一个**逐槽位、逐阶段、逐次选择当前最优候选人**的贪心算法，不是全局最优搜索，也不是回溯/整数规划。

## 5. 风险标签和风险等级

分配完成后，每个槽位都会调用：

- `computeAssignedMemberRiskTags(...)`

生成风险标签，例如：

- `NO_CANDIDATE`
- `UNDER_MIN_COUNT`
- `UNDER_REQUIRED_COUNT`
- `SINGLE_SHIFT`
- `NEW_ASSISTANT_ALONE`
- `NO_SENIOR_WITH_NEW`
- `SAME_COLLEGE`
- `SAME_GRADE`
- `SAME_GENDER`
- `OVER_MAX_WEEKLY_SHIFTS`

再通过：

- `toRiskPresentation(...)`

转换为前端展示使用的：

- `riskLevel`
- `riskLabel`

## 6. 方案摘要与总分

每份方案都会先汇总：

- `totalSlots`
- `fullStaffedSlots`
- `coveredSlots`
- `emptySlots`
- `singlePersonSlots`
- `underRequiredSlots`
- `averageAssignedCount`
- `maxAssignedCount`
- `minAssignedCount`
- `riskCount`

函数：

- `summarizePlan(...)`

然后再调用：

- `scorePlan(strategyKey, slots, summary)`

为整套方案打总分。

评分逻辑由两部分组成：

1. 风险扣分
   - 针对每个槽位的风险标签逐项扣分

2. 策略奖励
   - 覆盖优先：奖励 `coveredSlots`
   - 满员优先：奖励 `fullStaffedSlots`
   - 均衡优先：奖励覆盖与满员，同时处罚公平性差距

最终会做：

- `Math.round(score / 10)`
- 最低不小于 0

## 7. 推荐方案的产生

函数：

- `generateSchedulePlans(...)`

逻辑：

1. 生成三份方案：
   - `coverage_first`
   - `full_staffing_first`
   - `balanced_fairness`

2. 按 `plan.score` 降序排序

3. 取最高分的策略作为：
   - `recommendedStrategy`

因此，“推荐方案”不是写死某一种，而是运行时根据当前可用成员、班次配置和规则动态比较得出的。

## 8. 工程上的准确表述

为了避免误解，当前算法更准确的描述是：

- 它是一个**多策略贪心排班器**
- 不是机器学习算法
- 不是遗传算法
- 不是全局最优化求解器
- 不是带回溯的穷举搜索

它的优点是：

- 计算快
- 规则可解释
- 适合 MVP 阶段快速生成 3 个可比较方案

它的局限是：

- 不保证全局最优
- 对局部贪心顺序敏感
- 在极度稀缺的人手场景下，结果会比较依赖当前权重设计

## 9. 三种方案的一句话总结

- `coverage_first`
  - 先别空班

- `full_staffing_first`
  - 先尽量配满

- `balanced_fairness`
  - 先尽量排得均衡
