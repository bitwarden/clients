import { Observable } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";

import { Achievement, AchievementEarnedEvent, AchievementProgressEvent } from "./types";

export abstract class AchievementService {
  abstract achievementById$: (achievementId: string) => Observable<Achievement>;

  abstract achievementsEarned$: (userId: UserId) => Observable<AchievementEarnedEvent>;
  abstract achievementsInProgress$: (userId: UserId) => Observable<AchievementProgressEvent>;
}
