import { filter, map, merge, Observable, Subject } from "rxjs";

import { AccessEventService, AccessRefreshService } from "..";

/**
 * Default {@link AccessRefreshService}: merges two sources of "re-read this cipher's access state"
 * into one stream, so a change made here and a change made elsewhere drive the UI identically.
 *
 *  - a hot subject the mutating surfaces ping, which is what makes the local round-trip feel
 *    immediate instead of waiting for the server to tell us what we just did, and
 *  - the server push ({@link AccessEventService}), which carries no ids — an approver's decision says
 *    nothing about which item the caller has open — so it invalidates every subscriber.
 *
 * `undefined` on the subject means "every cipher", matching {@link notifyAccessChanged}'s optional
 * parameter rather than introducing a separate sentinel value.
 *
 * The merge happens per subscription rather than through a long-lived internal subscription, so a
 * client whose user never opens a gated item never attaches to the push channel at all, and there is
 * no teardown to get wrong.
 *
 * No replay: a re-read that fires with nobody watching has nothing to update, and replaying a stale
 * tick to a newly-opened item would make it re-read for no reason.
 */
export class DefaultAccessRefreshService implements AccessRefreshService {
  private readonly changed$ = new Subject<string | undefined>();

  constructor(private accessEventService: AccessEventService) {}

  accessChanged$(cipherId: string): Observable<void> {
    const local$ = this.changed$.pipe(
      filter((changed) => changed === undefined || changed === cipherId),
      // Annotated: the repo builds apps without `strictNullChecks`, where a bare `undefined` widens
      // to `any` and trips `noImplicitAny` on the inferred return type.
      map((): void => undefined),
    );
    return merge(local$, this.accessEventService.accessChanged$());
  }

  notifyAccessChanged(cipherId?: string): void {
    this.changed$.next(cipherId);
  }
}
