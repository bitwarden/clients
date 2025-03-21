import { UserId } from "../../types/guid";

import { AchievementEarnedEvent, AchievementId, AchievementProgressEvent, MetricId } from "./types";

// FIXME: see <./types.ts> AchievementValidator
export function progressEvent(name: MetricId, value: number = 1): AchievementProgressEvent {
  return {
    "@timestamp": Date.now(),
    event: {
      kind: "metric",
      category: "session",
    },
    achievement: { type: "progress", name, value },
    service: {
      name: "extension",
      type: "client",
      node: {
        name: "an-installation-identifier-for-this-client-instance",
      },
      version: "2025.3.1-innovation-sprint",
    },
    user: {
      id: "some-guid" as UserId,
    },
  };
}

// FIXME: see <./types.ts> AchievementValidator
export function earnedEvent(name: AchievementId): AchievementEarnedEvent {
  return {
    "@timestamp": Date.now(),
    event: {
      kind: "alert",
      category: "session",
    },
    achievement: { type: "earned", name },
    service: {
      name: "extension",
      type: "client",
      node: {
        name: "an-installation-identifier-for-this-client-instance",
      },
      version: "2025.3.1-innovation-sprint",
    },
    user: {
      id: "some-guid" as UserId,
    },
  };
}
