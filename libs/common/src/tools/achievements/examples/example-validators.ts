import { earnedEvent, progressEvent } from "../achievement-events";
import { Type } from "../data";
import { AchievementId, MetricId, AchievementValidator } from "../types";

const ItemCreatedProgress = "item-quantity" as MetricId;
const CredentialGeneratedProgress = "credential-generated" as MetricId;

const TotallyAttachedAchievement = "totally-attached" as AchievementId;
const ItemCreatedMetric = "item-created-metric" as AchievementId;
const UnboundItemCreatedMetric = "unbound-item-created-metric" as AchievementId;
const ItemCreatedAchievement = "item-created" as AchievementId;
const ThreeItemsCreatedAchievement = "three-vault-items-created" as AchievementId;
const FiveItemsCreatedAchievement = "five-vault-items-created" as AchievementId;

const TotallyAttachedValidator = {
  achievement: TotallyAttachedAchievement,
  name: "Attachment theory",
  description: "Added an attachment to a vault item",
  validator: Type.HasTag,
  active: "until-earned",
  hidden: false,
  trigger(item) {
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
  validator: Type.Threshold,
  active: { metric: ItemCreatedProgress, high: 1 },
  hidden: true,
  trigger(item) {
    return item.action === "vault-item-added";
  },
  measure(item, progress) {
    const value = 1 + (progress.get(ItemCreatedProgress) ?? 0);
    return [progressEvent(ItemCreatedProgress, value)];
  },
} satisfies AchievementValidator;

const UnboundItemCreatedTracker = {
  achievement: UnboundItemCreatedMetric,
  name: `[TRACKER] ${ItemCreatedProgress}`,
  description: `Measures ${ItemCreatedProgress}`,
  validator: Type.Threshold,
  active: { metric: ItemCreatedProgress, low: 1 },
  hidden: true,
  trigger(item) {
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
  description: "Add an item to your vault",
  validator: Type.Threshold,
  active: { metric: ItemCreatedProgress, high: 1 },
  hidden: false,
  trigger(item) {
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
  validator: Type.Threshold,
  active: { metric: ItemCreatedProgress, low: 1, high: 3 },
  hidden: false,
  trigger(item) {
    return item.action === "vault-item-added";
  },
  measure(_item, progress) {
    const value = 1 + (progress.get(ItemCreatedProgress) ?? 0);
    return [progressEvent(ItemCreatedProgress, value)];
  },
  award(_measured, progress) {
    const value = progress.get(ItemCreatedProgress);
    return value === 3 ? [earnedEvent(ThreeItemsCreatedAchievement)] : [];
  },
} satisfies AchievementValidator;

const FiveItemsCreatedValidator = {
  achievement: FiveItemsCreatedAchievement,
  name: "fiiivvve GoOoOoOolllllllD RIIIIIINGS!!!!!!",
  description: "Add five items to your vault",
  validator: Type.Threshold,
  active: { metric: ItemCreatedProgress, low: 3, high: 6 },
  hidden: false,
  trigger(item) {
    return item.action === "vault-item-added";
  },
  measure(_item, progress) {
    const value = 1 + (progress.get(ItemCreatedProgress) ?? 0);
    return [progressEvent(ItemCreatedProgress, value)];
  },
  award(_measured, progress) {
    const value = progress.get(ItemCreatedProgress);
    return value === 5 ? [earnedEvent(FiveItemsCreatedAchievement)] : [];
  },
} satisfies AchievementValidator;

export {
  TotallyAttachedAchievement,
  TotallyAttachedValidator,
  ItemCreatedMetric,
  ItemCreatedTracker,
  UnboundItemCreatedMetric,
  UnboundItemCreatedTracker,
  ItemCreatedProgress,
  ItemCreatedAchievement,
  ItemCreatedValidator,
  ThreeItemsCreatedAchievement,
  ThreeItemsCreatedValidator,
  FiveItemsCreatedAchievement,
  FiveItemsCreatedValidator,
  CredentialGeneratedProgress,
};
