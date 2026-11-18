import { Observable, merge, share } from "rxjs";

import { AccessEventService } from "@bitwarden/bit-pam";

/**
 * The server's access pushes, plus one tick each time connectivity comes back, since pushes sent
 * while offline were never heard. Every surface that re-reads on a push (My requests, the approver
 * inbox, the nav badge, system notifications, and through `AccessRefreshService` each open item's
 * access state and held reveal) re-reads on reconnect too. It is a re-read only: nothing a user
 * asked for is replayed.
 *
 * Only {@link accessChanged$} carries the reconnect tick; surfaces that listen to both streams
 * would otherwise read twice.
 */
export class DesktopAccessEventService implements AccessEventService {
  private readonly changed$: Observable<void>;

  constructor(
    private readonly inner: AccessEventService,
    reconnected$: Observable<void>,
  ) {
    this.changed$ = merge(inner.accessChanged$(), reconnected$).pipe(share());
  }

  accessChanged$(): Observable<void> {
    return this.changed$;
  }

  approverInboxChanged$(): Observable<void> {
    return this.inner.approverInboxChanged$();
  }
}
