import { earnedEvent, progressEvent } from "../achievement-events";
import { Type } from "../data";
import {
  AchievementId,
  AchievementProgressEvent,
  AchievementValidator,
  MetricId,
  UserActionEvent,
} from "../types";

export class ItemRemovedValidator implements AchievementValidator {
  base: AchievementValidator;
  get achievement() {
    return "item-removed" as AchievementId;
  }
  get name() {
    return "1st item removed from vault";
  }
  // Threshold validator because we are only looking
  // for the action of removed and the threshold is 1
  get validator() {
    return Type.Threshold;
  }
  get active() {
    return this.base.active;
  }
  get hidden() {
    return false;
  }
  private metric = "item-removed-quantity" as MetricId;
  constructor() {
    this.base.active = {
      metric: this.metric,
      high: 1,
    };
  }

  trigger(item: UserActionEvent) {
    return item.action === "vault-item-removed";
  }

  measure(item: UserActionEvent, metrics: Map<MetricId, number>) {
    return [progressEvent(this.metric)];
  }

  award(_measured: AchievementProgressEvent[]) {
    return [earnedEvent(this.achievement)];
  }
}
