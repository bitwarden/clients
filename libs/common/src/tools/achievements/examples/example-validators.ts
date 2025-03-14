import { earnedEvent, progressEvent } from "../achievement-events";
import { Type } from "../data";
import { AchievementId, MetricId, AchievementValidator } from "../types";

const ItemCreatedProgress = "item-quantity" as MetricId;

const TotallyAttachedAchievement = "totally-attached" as AchievementId;
const ItemCreatedMetric = "item-created-metric" as AchievementId;
const ItemCreatedAchievement = "item-created" as AchievementId;
const ThreeItemsCreatedAchievement = "three-vault-items-created" as AchievementId;
const FiveItemsCreatedAchievement = "five-vault-items-created" as AchievementId;

const TotallyAttachedValidator = {
  achievement: TotallyAttachedAchievement,
  name: "Totally attached <3",
  description: "Attached a file to a send or item",
  metric: ItemCreatedProgress,
  validator: Type.HasTag,
  trigger: "once",
  hidden: false,
  filter(item) {
    return item.tags?.includes("with-attachment") ?? false;
  },
  award(progress) {
    return [earnedEvent(TotallyAttachedAchievement)];
  },
} satisfies AchievementValidator;

// 🧠 this validator added to test `measure` in isolation, but
// the pattern of splitting trackers from validators is interesting.
//
// As-is, the design runs all measures before earnings so the logic
// should remain consistent so long as the trackers and validators
// don't emit conflicting logs. The processor's behavior in this
// situation is undefined.
const ItemCreatedTracker = {
  achievement: ItemCreatedMetric,
  name: `[TRACKER] ${ItemCreatedProgress}`,
  description: `Measures ${ItemCreatedProgress}`,
  metric: ItemCreatedProgress,
  validator: Type.Threshold,
  trigger: { high: 1 },
  hidden: true,
  filter(item) {
    return item.action === "vault-item-added";
  },
  measure(item, progress) {
    const value = 1 + (progress.get(ItemCreatedProgress) ?? 0);
    return [progressEvent(ItemCreatedProgress, value)];
  },
} satisfies AchievementValidator;

const ItemCreatedValidator = {
  achievement: ItemCreatedAchievement,
  name: "What an item!",
  metric: ItemCreatedProgress,
  description: "Add an item to your vault",
  validator: Type.Threshold,
  trigger: { high: 1 },
  hidden: false,
  filter(item) {
    return item.action === "vault-item-added";
  },
  measure(item, progress) {
    return [progressEvent(ItemCreatedProgress)];
  },
  award(progress) {
    return [earnedEvent(ItemCreatedAchievement)];
  },
} satisfies AchievementValidator;

const ThreeItemsCreatedValidator = {
  achievement: ThreeItemsCreatedAchievement,
  name: "Three times a charm",
  description: "Add three items to your vault",
  metric: ItemCreatedProgress,
  validator: Type.Threshold,
  trigger: { low: 2, high: 3 },
  hidden: false,
  filter(item) {
    return item.action === "vault-item-added";
  },
  measure(_item, progress) {
    const value = 1 + (progress.get(ItemCreatedProgress) ?? 0);
    return [progressEvent(ItemCreatedProgress, value)];
  },
  award(_measured, progress) {
    const value = progress.get(ItemCreatedProgress) ?? 0;
    return value >= 3 ? [earnedEvent(ItemCreatedAchievement)] : [];
  },
} satisfies AchievementValidator;

const FiveItemsCreatedValidator = {
  achievement: FiveItemsCreatedAchievement,
  name: "fiiivvve GoOoOoOolllllllD RIIIIIINGS!!!!!!",
  description: "Add five items to your vault",
  metric: ItemCreatedProgress,
  validator: Type.Threshold,
  trigger: { low: 4, high: 5 },
  hidden: false,
  filter(item) {
    return item.action === "vault-item-added";
  },
  measure(_item, progress) {
    const value = 1 + (progress.get(ItemCreatedProgress) ?? 0);
    return [progressEvent(ItemCreatedProgress, value)];
  },
  award(_measured, progress) {
    const value = progress.get(ItemCreatedProgress) ?? 0;
    return value >= 5 ? [earnedEvent(ItemCreatedAchievement)] : [];
  },
} satisfies AchievementValidator;

export {
  TotallyAttachedAchievement,
  TotallyAttachedValidator,
  ItemCreatedMetric,
  ItemCreatedTracker,
  ItemCreatedProgress,
  ItemCreatedAchievement,
  ItemCreatedValidator,
  ThreeItemsCreatedAchievement,
  ThreeItemsCreatedValidator,
  FiveItemsCreatedAchievement,
  FiveItemsCreatedValidator,
};
