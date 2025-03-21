import { Type } from "../../data";
import { Achievement, AchievementId, MetricId } from "../../types";

/**
 * Send items added in it's own achievement. Right now only count achievements
 * are included. There might be the need to create count achievements for
 * different send types. Keeping send logic in it's own validator makes sense
 * for readability.
 */
export class SendItemCreatedCountConfig implements Achievement {
  // Define send count achievements here
  static readonly AllConfigs: SendItemCreatedCountConfig[] = [
    new SendItemCreatedCountConfig("send-item-created", "1st send item created", 1),
    new SendItemCreatedCountConfig("send-item-created-10", "10 send items created", 10),
    new SendItemCreatedCountConfig("send-item-created-50", "50 send items created", 50),
    new SendItemCreatedCountConfig("send-item-created-100", "100 send items created", 100),
  ];

  base: Omit<Achievement, "validator" | "hidden">;

  get achievement() {
    return this.base.achievement;
  }

  get name() {
    return this.base.name;
  }

  get validator() {
    return Type.Threshold;
  }

  get active() {
    return this.base.active;
  }

  get hidden() {
    return false;
  }
  threshold: number;
  private constructor(key: string, name: string, threshold: number) {
    this.threshold = threshold;
    this.base = {
      achievement: key as AchievementId,
      name: name,
      active: {
        metric: "send-item-quantity" as MetricId,
        low: threshold - 1,
        high: threshold,
      },
    };
  }
}
