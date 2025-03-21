import { Observable } from "rxjs";

import { Account } from "../../auth/abstractions/account.service";

import {
  Achievement,
  AchievementEarnedEvent,
  AchievementId,
  AchievementProgressEvent,
  MetricId,
} from "./types";

export abstract class AchievementService {
  abstract achievementMap: () => Map<AchievementId, Achievement>;

  abstract earnedStream$: (account: Account, all?: boolean) => Observable<AchievementEarnedEvent>;

  abstract earnedMap$: (account: Account) => Observable<Map<AchievementId, AchievementEarnedEvent>>;

  abstract progressStream$: (
    account: Account,
    all?: boolean,
  ) => Observable<AchievementProgressEvent>;

  abstract metricsMap$: (account: Account) => Observable<Map<MetricId, AchievementProgressEvent>>;
}
