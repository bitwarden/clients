import { filter, find, from, map, Observable } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";

import { AchievementHub } from "./achievement-hub";
import { AchievementService as AchievementServiceAbstraction } from "./achievement.service.abstraction";
import { EventStoreAbstraction } from "./event-store.abstraction.service";
import {
  VaultItems_1_Added_Achievement,
  VaultItems_10_Added_Achievement,
} from "./examples/achievements";
import { isEarnedEvent, isProgressEvent } from "./meta";
import {
  Achievement,
  AchievementEarnedEvent,
  AchievementEvent,
  AchievementId,
  AchievementProgressEvent,
} from "./types";

// Service might be deprecated in favor of the AchievmentHub
// The hub is currently missing a way of listing all achievements, finding by id, but that could be possibly done via the AchievementManager
export class DefaultAchievementService implements AchievementServiceAbstraction {
  private _achievements: Achievement[] = [
    VaultItems_1_Added_Achievement,
    VaultItems_10_Added_Achievement,
  ];

  private _achievementsSubject = from(this._achievements);

  achievementById$: (achievementId: string) => Observable<Achievement>;

  // Provided by the AchievementHub
  achievementsEarned$: (userId: UserId) => Observable<AchievementEarnedEvent>;

  // Provided by the AchievementHub
  earned$: Observable<AchievementEarnedEvent>;

  // Provided by the AchievementHub
  achievementsInProgress$: (userId: UserId) => Observable<AchievementProgressEvent>;

  // Provided by the AchievementHub
  inProgress$: Observable<AchievementProgressEvent>;

  constructor(protected eventStore: EventStoreAbstraction, protected achievementHub: AchievementHub) {
    this.achievementById$ = (achievementId: AchievementId) =>
      this._achievementsSubject.pipe(find((item: Achievement) => item.name === achievementId));

    this.achievementsEarned$ = (userId: UserId) => {
      return this.eventStore.events$.pipe(
        filter(
          (event): event is AchievementEarnedEvent =>
            isEarnedEvent(event as AchievementEvent) && event.user.id === userId,
        ),
      );
    };

    this.achievementsInProgress$ = (userId: UserId) => {
      return this.eventStore.events$.pipe(
        filter(
          (event): event is AchievementProgressEvent =>
            isProgressEvent(event as AchievementEvent) && event.user.id === userId,
        ),
      );
    };

    this.earned$ = this.achievementHub.new$().pipe(filter((event) => isEarnedEvent(event)), map((event) => {
      return event as AchievementEarnedEvent;
    }));
    
    this.inProgress$ = this.achievementHub.new$().pipe(filter((event) => isProgressEvent(event)), map((event) => {
      return event as AchievementProgressEvent;
    }));  

  }
}
