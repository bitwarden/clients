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
 * Custom Nudge Service for the vault settings import badge.
 */
@Injectable({
  providedIn: "root",
})
export class VaultSettingsImportNudgeService extends DefaultSingleNudgeService {
  cipherService = inject(CipherService);
  organizationService = inject(OrganizationService);
  collectionService = inject(CollectionService);

  nudgeStatus$(nudgeType: NudgeType, userId: UserId): Observable<NudgeStatus> {
    return combineLatest([
      this.getNudgeStatus$(nudgeType, userId),
      this.cipherService.cipherViews$(userId),
      this.organizationService.organizations$(userId),
      this.collectionService.decryptedCollections$(userId),
    ]).pipe(
      switchMap(([nudgeStatus, ciphers, orgs, collections]) => {
        const vaultHasMoreThanOneItem = (ciphers?.length ?? 0) > 1;
        const { hasBadgeDismissed, hasSpotlightDismissed } = nudgeStatus;

        // When the user has no organizations, return the nudge status directly
        if ((orgs?.length ?? 0) === 0) {
          return hasBadgeDismissed || hasSpotlightDismissed
            ? of(nudgeStatus)
            : of({
                hasSpotlightDismissed: vaultHasMoreThanOneItem,
                hasBadgeDismissed: vaultHasMoreThanOneItem,
              });
        }

        const orgIds = new Set(orgs.map((org) => org.id));
        const canCreateCollections = orgs.some((org) => org.canCreateNewCollections);
        const hasManageCollections = collections.some(
          (c) => c.manage && orgIds.has(c.organizationId!),
        );

        // When the user has dismissed the nudge or spotlight, return the nudge status directly
        if (hasBadgeDismissed || hasSpotlightDismissed) {
          return of(nudgeStatus);
        }

        // When the user belongs to an organization and cannot create collections or manage collections,
        // hide the nudge and spotlight
        if (!hasManageCollections && !canCreateCollections) {
          return of({
            hasSpotlightDismissed: true,
            hasBadgeDismissed: true,
          });
        }

        // Otherwise, return the nudge status based on the vault contents
        return of({
          hasSpotlightDismissed: vaultHasMoreThanOneItem,
          hasBadgeDismissed: vaultHasMoreThanOneItem,
        });
      }),
    );
  }
}
