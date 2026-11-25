import { inject, Injectable } from "@angular/core";
import {
  catchError,
  defer,
  filter,
  map,
  merge,
  Observable,
  of,
  share,
  Subject,
  takeUntil,
} from "rxjs";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { OrganizationUserStatusType } from "@bitwarden/common/admin-console/enums";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

type CountUpdate = { organizationId: string; count: number };

/**
 * The number of members in an organization who've accepted their invitation and are waiting for an
 * admin to confirm them. The admin console's Members nav item shows it, and the Members page
 * reports a new count after each load, so confirming a member updates the nav item right away.
 */
@Injectable({ providedIn: "root" })
export class NeedsConfirmationCountService {
  private readonly organizationUserApiService = inject(OrganizationUserApiService);
  private readonly logService = inject(LogService);

  private readonly updates = new Subject<CountUpdate>();

  /**
   * Fetches the count once, then follows the Members page's updates. An update that arrives first
   * wins over the fetch, so a slower fetch can't overwrite a newer count.
   */
  count$(organizationId: string): Observable<number> {
    const updates$ = this.updates.pipe(
      filter((update) => update.organizationId === organizationId),
      map((update) => update.count),
      share(),
    );
    const fetched$ = defer(() =>
      this.organizationUserApiService.getAllMiniUserDetails(organizationId),
    ).pipe(
      map(
        (response) =>
          response.data.filter((member) => member.status === OrganizationUserStatusType.Accepted)
            .length,
      ),
      // The count is a hint, so a failed fetch hides the berry rather than breaking the nav.
      catchError((error: unknown) => {
        this.logService.error(error);
        return of(0);
      }),
      takeUntil(updates$),
    );
    return merge(fetched$, updates$);
  }

  /** Reports the organization's current count, e.g. after the Members page loads its members. */
  update(organizationId: string, count: number): void {
    this.updates.next({ organizationId, count });
  }
}
