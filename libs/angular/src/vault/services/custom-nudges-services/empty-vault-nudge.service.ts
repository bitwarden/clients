import { inject, Injectable } from "@angular/core";
import { combineLatest, Observable, of, switchMap } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import { DefaultSingleNudgeService } from "../default-single-nudge.service";
import { NudgeStatus, NudgeType } from "../nudges.service";

/**
 * Custom Nudge Service Checking Nudge Status For Empty Vault
 */
@Injectable({
  providedIn: "root",
})
export class EmptyVaultNudgeService extends DefaultSingleNudgeService {
  cipherService = inject(CipherService);
  organizationService = inject(OrganizationService);
  collectionService = inject(CollectionService);

  nudgeStatus$(nudgeType: NudgeType, userId: UserId): Observable<NudgeStatus> {
    return combineLatest([
      this.getNudgeStatus$(nudgeType, userId),
      this.cipherService.cipherViews$(userId),
      this.organizationService.organizations$(userId),
      this.collectionService.decryptedCollections$,
    ]).pipe(
      switchMap(([nudgeStatus, ciphers, orgs, collections]) => {
        const filteredCiphers = ciphers?.filter((cipher) => {
          return cipher.deletedDate == null;
        });
        const vaultHasContents = !(filteredCiphers == null || filteredCiphers.length === 0);
        if (orgs == null || orgs.length === 0) {
          return nudgeStatus.hasBadgeDismissed || nudgeStatus.hasSpotlightDismissed
            ? of(nudgeStatus)
            : of({
                hasSpotlightDismissed: vaultHasContents,
                hasBadgeDismissed: vaultHasContents,
              });
        }
        const orgIds = new Set(orgs.map((org) => org.id));
        const canCreateCollections = orgs.some((org) => org.canCreateNewCollections);
        const hasManageCollections = collections.some(
          (c) => c.manage && orgIds.has(c.organizationId),
        );
        // Do not show nudge when
        // user has previously dismissed nudge
        // OR
        // user belongs to an organization and cannot create collections || manage collections
        if (
          nudgeStatus.hasBadgeDismissed ||
          nudgeStatus.hasSpotlightDismissed ||
          hasManageCollections ||
          canCreateCollections
        ) {
          return of(nudgeStatus);
        }
        return of({
          hasSpotlightDismissed: vaultHasContents,
          hasBadgeDismissed: vaultHasContents,
        });
      }),
    );
  }
}
