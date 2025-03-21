import { earnedEvent } from "../achievement-events";
import { Type } from "../data";
import {
  AchievementId,
  AchievementProgressEvent,
  AchievementValidator,
  UserActionEvent,
} from "../types";

export class ItemUriAddedValidator implements AchievementValidator {
  base: Pick<AchievementValidator, "active">;
  get achievement() {
    return "item-uri-added" as AchievementId;
  }
  get name() {
    return "1st time adding a uri to an item";
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

  constructor() {
    // If edit and the uri count is present the achievement is rewarded
    this.base = { active: "until-earned" };
  }

  trigger(item: UserActionEvent) {
    // The achievement states that the uri needs to be added
    // to vault item. Indicating an edit/update
    return (
      item.action === "vault-item-updated" &&
      Number.isNaN(item.labels?.["vault-item-uri-quantity"]) &&
      (item.labels?.["vault-item-uri-quantity"] as number) >= 1
    );
  }

  award(_measured: AchievementProgressEvent[]) {
    return [earnedEvent(this.achievement)];
  }
}
