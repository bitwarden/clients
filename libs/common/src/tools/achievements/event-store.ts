import { Observable, Subject } from "rxjs";

import { EventStoreAbstraction } from "./event-store.abstraction.service";
import { AchievementEarnedEvent, AchievementProgressEvent } from "./types";

// Will be replaced by the achievementHub
export class EventStore implements EventStoreAbstraction {
  private _events = new Subject<AchievementProgressEvent | AchievementEarnedEvent>();

  events$: Observable<AchievementProgressEvent | AchievementEarnedEvent> =
    this._events.asObservable();

  constructor() {}

  addEvent(event: AchievementProgressEvent | AchievementEarnedEvent): boolean {
    // FIXME Collapse existing of same metric/higher count AchievementProgressEvents
    //eslint-disable-next-line no-console
    console.log("EventStore.addEvent", event);
    this._events.next(event);
    return true;
  }
}
