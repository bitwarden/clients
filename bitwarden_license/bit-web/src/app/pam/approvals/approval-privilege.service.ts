import { Injectable, inject } from "@angular/core";
import { Observable, combineLatest, distinctUntilChanged, map, shareReplay, switchMap } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";

import { hasApprovalPrivileges } from "./approval-privileges";

/**
 * Whether the active user can act on other members' access requests — see
 * {@link hasApprovalPrivileges} for what the privilege is and why it isn't the access-rules one.
 *
 * One service, not a predicate each caller wires up: the tab and the route guard read one
 * stream and can't drift apart, and neither injects the three services the answer derives from.
 *
 * Bound root-level in `provide-pam.ts`, matching the rest of this module, since the route guard
 * resolves it before any route provider exists.
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
    // combineLatest.
    shareReplay({ bufferSize: 1, refCount: true }),
  );
}
