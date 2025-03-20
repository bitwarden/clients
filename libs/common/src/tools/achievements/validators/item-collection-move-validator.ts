import { earnedEvent } from "../achievement-events";
import { Type } from "../data";
import {
  AchievementId,
  AchievementProgressEvent,
  AchievementValidator,
  UserActionEvent,
} from "../types";

export class ItemCollectionMoveValidator implements AchievementValidator {
  base: AchievementValidator;
  get achievement() {
    return "item-collection-move" as AchievementId;
  }
  get name() {
    return "1st item moved to a collection";
  }
  get validator() {
    return Type.HasTag;
  }
  get active() {
    return this.base.active;
  }
  get hidden() {
    return false;
  }

  constructor() {
    this.base.active = "until-earned";
  }

  trigger(item: UserActionEvent) {
    // This achievement is specific to moving an item into a collection.
    // If there is ever an achievement for creating a vault item in a collection
    // this class can be renamed and reused to define a move or create achievement.
    return item.action === "vault-item-moved" && (item.tags?.includes("collection") ?? false);
  }

  award(_measured: AchievementProgressEvent[]) {
    return [earnedEvent(this.achievement)];
  }
}
