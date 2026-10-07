import { filter, map, merge, Observable, Subject } from "rxjs";

import { AccessEventService, AccessRefreshService } from "..";

/**
 * Merges local mutations with the server push, per subscription, so a client that never opens a
 * gated item never attaches to the push channel. `undefined` on the subject means every cipher.
 */
export class DefaultAccessRefreshService implements AccessRefreshService {
  private readonly changed$ = new Subject<string | undefined>();

  constructor(private accessEventService: AccessEventService) {}

  accessChanged$(cipherId?: string): Observable<void> {
    const local$ = this.changed$.pipe(
      filter((changed) => cipherId === undefined || changed === undefined || changed === cipherId),
      // Annotated, since without `strictNullChecks` a bare `undefined` widens to `any` and trips
      // `noImplicitAny`.
      map((): void => undefined),
    );
    return merge(local$, this.accessEventService.accessChanged$());
  }

  notifyAccessChanged(cipherId?: string): void {
    this.changed$.next(cipherId);
  }
}
