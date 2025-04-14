import { inject, Injectable } from "@angular/core";
import { combineLatest, Observable, of, switchMap } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import { DefaultSingleNudgeService } from "../default-single-nudge.service";
import { VaultNudgeType } from "../vault-nudges.service";

/**
 * Custom Nudge Service Checking Nudge Status For Welcome Nudge For Empty Vault
 */
@Injectable({
  providedIn: "root",
})
export class EmptyVaultNudgeService extends DefaultSingleNudgeService {
  cipherService = inject(CipherService);
  organizationService = inject(OrganizationService);
  collectionService = inject(CollectionService);

  shouldShowNudge$(nudgeType: VaultNudgeType, userId: UserId): Observable<boolean> {
    return combineLatest([
      this.isDismissed$(nudgeType, userId),
      this.cipherService.cipherViews$(userId),
      this.organizationService.organizations$(userId),
      this.collectionService.decryptedCollections$,
    ]).pipe(
      switchMap(([dismissed, ciphers, orgs, collections]) => {
        const orgIds = new Set(orgs.map((org) => org.id));
        const canCreateCollections = orgs.filter((org) => {
          return org.canCreateNewCollections;
        });
        const managedCollections = collections.filter((collection) => {
          if (orgIds.has(collection.organizationId) && collection.manage) {
            return of(true);
          }
        });
        // Do not show nudge when
        // user has previously dismissed
        // user belongs to an organization and then cannot create collections || manage collections
        if (
          dismissed ||
          (orgs.length !== 0 &&
            (managedCollections.length === 0 || canCreateCollections.length === 0))
        ) {
          return of(false);
        }
        return of(ciphers == null || ciphers.length === 0);
      }),
    );
  }
}
