import { Injectable, inject } from "@angular/core";
import { Observable, combineLatest, distinctUntilChanged, map, shareReplay, switchMap } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";

import { hasApprovalPrivileges } from "./approval-privileges";

/**
 * Whether the active user can act on other members' access requests (see
 * {@link hasApprovalPrivileges}). Bound root-level in `provide-pam.ts`, since the route guard
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
    // Several consumers subscribe separately; without this each rebuilds the combineLatest.
    shareReplay({ bufferSize: 1, refCount: true }),
  );
}
