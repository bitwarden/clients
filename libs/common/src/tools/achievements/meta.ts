import { AchievementEarnedEvent, AchievementEvent, AchievementProgressEvent } from "./types";

function isProgressEvent(event: AchievementEvent): event is AchievementProgressEvent {
  return event.achievement.type === "progress" && "value" in event.achievement;
}

function isEarnedEvent(event: AchievementEvent): event is AchievementEarnedEvent {
  return event.achievement.type === "earned";
}

export { isProgressEvent, isEarnedEvent };
