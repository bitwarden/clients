import { Params } from "@angular/router";
import { Observable, concatMap, distinctUntilChanged, switchMap } from "rxjs";

import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";

/** Organization for the route's `organizationId`, de-duped by id + enabled. `undefined` if not found. */
export function organizationForRoute$(
  params$: Observable<Params>,
  accountService: AccountService,
  organizationService: OrganizationService,
): Observable<Organization | undefined> {
  return params$.pipe(
    concatMap((params) =>
      getUserId(accountService.activeAccount$).pipe(
        switchMap((userId) =>
          organizationService
            .organizations$(userId)
            .pipe(getOrganizationById(params.organizationId)),
        ),
      ),
    ),
    distinctUntilChanged((a, b) => a?.id === b?.id && a?.enabled === b?.enabled),
  );
}
