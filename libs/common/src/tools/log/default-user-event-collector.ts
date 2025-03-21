import { Observable, Subject } from "rxjs";

import { Account } from "../../auth/abstractions/account.service";
import { AppIdService } from "../../platform/abstractions/app-id.service";
import { PlatformUtilsService } from "../../platform/abstractions/platform-utils.service";
import { UserId } from "../../types/guid";
import { UserActionEvent } from "../achievements/types";

import { UserEventMonitor } from "./user-event-monitor";

export class DefaultUserEventCollector {
  private eventStreams = new Map<UserId, Subject<UserActionEvent>>();

  constructor(
    private idService: AppIdService,
    private utilService: PlatformUtilsService,
  ) {}

  private getStream(account: Account) {
    let events$ = this.eventStreams.get(account.id);
    if (!events$) {
      // FIXME: this should include a ring buffer and spool
      //   when the buffer is full so that user action events
      //   are not lost. Don't forget encryption...
      events$ = new Subject<UserActionEvent>();
      this.eventStreams.set(account.id, events$);
    }

    return events$;
  }

  monitor(account: Account): UserEventMonitor {
    const events$ = this.getStream(account);

    const logger = new UserEventMonitor(
      this.idService,
      this.utilService,
      account,
      Date.now,
      events$,
    );
    return logger;
  }

  events$(account: Account): Observable<UserActionEvent> {
    return this.getStream(account).asObservable();
  }
}
