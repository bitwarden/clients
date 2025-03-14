import { isProgressEvent } from "./meta";
import { AchievementEvent } from "./types";

export function mapProgressByName(status: AchievementEvent[]) {
  return new Map(
    status.filter(isProgressEvent).map((e) => [e.achievement.name, e.achievement.value] as const),
  );
}
