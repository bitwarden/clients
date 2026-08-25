import { Injectable, inject } from "@angular/core";
import { Observable, combineLatest, distinctUntilChanged, map, shareReplay, switchMap } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";

import { hasApprovalPrivileges } from "./approval-privileges";

/**
 * Whether the active user can act on other members' access requests — see
 * {@link hasApprovalPrivileges} for what the privilege is and why it is not the access-rules one.
 *
 * One service rather than a predicate each caller wires up itself, so the tab (which decides whether
 * to render the inbox) and the route guard (which decides whether the route is reachable) read one
 * stream and cannot drift apart — and neither has to inject the three services the answer is derived
 * from just to pass them along.
 *
 * Bound root-level in `provide-pam.ts` rather than `providedIn: "root"`, matching the rest of this
 * module: the route guard resolves it before any route provider exists, so it cannot be
 * route-provided the way the page-level services are.
 */
@Injectable()
export class ApprovalPrivilegeService {
  private readonly accountService = inject(AccountService);
  private readonly organizationService = inject(OrganizationService);
  private readonly collectionService = inject(CollectionService);

  readonly canApprove$: Observable<boolean> = this.accountService.activeAccount$.pipe(
    getUserId,
    switchMap((userId) =>
      combineLatest([
        this.organizationService.organizations$(userId),
        this.collectionService.decryptedCollections$(userId),
      ]),
    ),
    map(([organizations, collections]) => hasApprovalPrivileges(organizations, collections)),
    distinctUntilChanged(),
    // The guard and both components subscribe separately; without this each rebuilds the whole
    // combineLatest and re-runs the predicate, which the class doc above claims they do not.
    shareReplay({ bufferSize: 1, refCount: true }),
  );
}
