import { earnedEvent, progressEvent } from "../achievement-events";
import {
  AchievementProgressEvent,
  AchievementValidator,
  MetricId,
  UserActionEvent,
} from "../types";

import { SendItemCreatedCountConfig } from "./config/send-created-count-config";

export class SendItemCreatedCountValidator implements AchievementValidator {
  private sendItemCreatedProgress: MetricId;
  constructor(private config: SendItemCreatedCountConfig) {
    // All of the configs for created items must have a metric.
    // This checks the types to allow us to assign the metric.
    if (config.active === "until-earned") {
      throw new Error(
        `${config.achievement}: invalid configuration; 'active' must contain a metric`,
      );
    }

    this.sendItemCreatedProgress = config.active.metric;
  }

  base: AchievementValidator;
  get achievement() {
    return this.config.achievement;
  }
  get name() {
    return this.config.name;
  }
  get validator() {
    return this.config.validator;
  }
  get active() {
    return this.config.active;
  }
  get hidden() {
    return this.config.hidden;
  }

  trigger(item: UserActionEvent) {
    return item.action === "send-item-added";
  }

  measure(_item: UserActionEvent, progress: Map<MetricId, number>) {
    const value = 1 + (progress.get(this.sendItemCreatedProgress) ?? 0);
    return [progressEvent(this.sendItemCreatedProgress, value)];
  }

  award(_measured: AchievementProgressEvent[], progress: Map<MetricId, number>) {
    const value = progress.get(this.sendItemCreatedProgress) ?? 0;
    return value >= this.config.threshold ? [earnedEvent(this.achievement)] : [];
  }
}
