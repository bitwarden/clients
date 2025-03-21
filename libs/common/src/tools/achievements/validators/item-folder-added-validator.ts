import { earnedEvent } from "../achievement-events";
import { Type } from "../data";
import {
  AchievementId,
  AchievementProgressEvent,
  AchievementValidator,
  UserActionEvent,
} from "../types";

export class ItemFolderAddedValidator implements AchievementValidator {
  base: Pick<AchievementValidator, "active">;
  get achievement() {
    return "item-folder-added" as AchievementId;
  }
  get name() {
    return "1st item added to folder";
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
    this.base = { active: "until-earned" };
  }

  trigger(item: UserActionEvent) {
    return item.tags?.includes("with-folder") ?? false;
  }

  award(_measured: AchievementProgressEvent[]) {
    return [earnedEvent(this.achievement)];
  }
}
