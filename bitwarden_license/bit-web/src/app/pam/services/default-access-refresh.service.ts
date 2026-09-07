import { filter, map, merge, Observable, Subject } from "rxjs";

import { AccessEventService, AccessRefreshService } from "..";

/**
 * Default {@link AccessRefreshService}: merges two sources of "re-read this cipher's access
 * state" into one stream, so a local change and a remote one drive the UI identically — a hot
 * subject the mutating surfaces ping, for an immediate local round-trip, and the server push
 * ({@link AccessEventService}), which carries no ids and so invalidates every subscriber.
 *
 * `undefined` on the subject means "every cipher", matching {@link notifyAccessChanged}'s
 * optional parameter.
 *
 * The merge happens per subscription, not through a long-lived internal one, so a client that
 * never opens a gated item never attaches to the push channel. No replay: a re-read with
 * nobody watching has nothing to update, and replaying a stale tick to a freshly-opened item
 * would re-read for no reason.
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
