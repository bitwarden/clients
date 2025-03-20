import { Observable } from "rxjs";

import { AchievementEarnedEvent, AchievementProgressEvent, UserActionEvent } from "./types";

export abstract class EventStoreAbstraction {
  abstract events$: Observable<UserActionEvent | AchievementProgressEvent | AchievementEarnedEvent>;
  abstract addEvent(
    event: UserActionEvent | AchievementProgressEvent | AchievementEarnedEvent,
  ): boolean;
}
