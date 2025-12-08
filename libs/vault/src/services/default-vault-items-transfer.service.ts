import { Injectable } from "@angular/core";
import { firstValueFrom, switchMap, map, of, Observable, combineLatest } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId, CollectionId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";
import { DialogService, ToastService } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { UserId } from "@bitwarden/user-core";

import {
  VaultItemsTransferService,
  UserMigrationInfo,
} from "../abstractions/vault-items-transfer.service";

@Injectable()
export class DefaultVaultItemsTransferService implements VaultItemsTransferService {
  constructor(
    private cipherService: CipherService,
    private policyService: PolicyService,
    private organizationService: OrganizationService,
    private collectionService: CollectionService,
    private logService: LogService,
    private i18nService: I18nService,
    private dialogService: DialogService,
    private toastService: ToastService,
    private configService: ConfigService,
  ) {}

  private enforcingOrganization$(userId: UserId): Observable<Organization | undefined> {
    return this.policyService.policiesByType$(PolicyType.OrganizationDataOwnership, userId).pipe(
      map(
        (policies) =>
          policies.sort((a, b) => a.revisionDate.getTime() - b.revisionDate.getTime())?.[0],
      ),
      switchMap((policy) => {
        if (policy == null) {
          return of(undefined);
        }
        return this.organizationService
          .organizations$(userId)
          .pipe(map((orgs) => orgs.find((o) => policy.organizationId === o.id)));
      }),
    );
  }

  private personalCiphers$(userId: UserId): Observable<CipherView[]> {
    return this.cipherService.cipherViews$(userId).pipe(
      filterOutNullish(),
      map((ciphers) => ciphers.filter((c) => c.organizationId == null)),
    );
  }

  private defaultUserCollection$(
    userId: UserId,
    organizationId: OrganizationId,
  ): Observable<CollectionId | undefined> {
    return this.collectionService.decryptedCollections$(userId).pipe(
      map((collections) => {
        return collections.find((c) => c.isDefaultCollection && c.organizationId === organizationId)
          ?.id;
      }),
    );
  }

  userMigrationInfo$(userId: UserId): Observable<UserMigrationInfo> {
    return this.enforcingOrganization$(userId).pipe(
      switchMap((enforcingOrganization) => {
        if (enforcingOrganization == null) {
          return of<UserMigrationInfo>({
            requiresMigration: false,
          });
        }
        return combineLatest([
          this.personalCiphers$(userId),
          this.defaultUserCollection$(userId, enforcingOrganization.id),
        ]).pipe(
          map(([personalCiphers, defaultCollectionId]): UserMigrationInfo => {
            return {
              requiresMigration: personalCiphers.length > 0,
              enforcingOrganization,
              defaultCollectionId,
            };
          }),
        );
      }),
    );
  }

  async enforceOrganizationDataOwnership(userId: UserId): Promise<void> {
    const featureEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.MigrateMyVaultToMyItems,
    );

    if (!featureEnabled) {
      return;
    }

    const migrationInfo = await firstValueFrom(this.userMigrationInfo$(userId));

    if (!migrationInfo.requiresMigration) {
      return;
    }

    if (migrationInfo.defaultCollectionId == null) {
      // TODO: Handle creating the default collection if missing (to be handled by AC in future work)
      this.logService.warning(
        "Default collection is missing for user during organization data ownership enforcement",
      );
      return;
    }

    // Temporary confirmation dialog. Full implementation in PM-27663
    const confirmMigration = await this.dialogService.openSimpleDialog({
      title: "Requires migration",
      content: "You vault requires migration of personal items to your organization.",
      type: "warning",
    });

    if (!confirmMigration) {
      // TODO: Show secondary confirmation dialog in PM-27663, for now we just exit
      // TODO: Revoke user from organization if they decline migration PM-29465
      return;
    }

    try {
      await this.transferPersonalItems(
        userId,
        migrationInfo.enforcingOrganization.id,
        migrationInfo.defaultCollectionId,
      );
      this.toastService.showToast({
        variant: "success",
        message: "Items transferred",
      });
    } catch (error) {
      this.logService.error("Error transferring personal items to organization", error);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("errorOccurred"),
      });
    }
  }

  async transferPersonalItems(
    userId: UserId,
    organizationId: OrganizationId,
    defaultCollectionId: CollectionId,
  ): Promise<void> {
    let personalCiphers = await firstValueFrom(this.personalCiphers$(userId));

    if (personalCiphers.length === 0) {
      return;
    }

    const oldAttachmentCiphers = personalCiphers.filter((c) => c.hasOldAttachments);

    if (oldAttachmentCiphers.length > 0) {
      await this.upgradeOldAttachments(oldAttachmentCiphers, userId, organizationId);
      personalCiphers = await firstValueFrom(this.personalCiphers$(userId));

      // Sanity check to ensure all old attachments were upgraded, though upgradeOldAttachments should throw if any fail
      const remainingOldAttachments = personalCiphers.filter((c) => c.hasOldAttachments);
      if (remainingOldAttachments.length > 0) {
        throw new Error(
          `Failed to upgrade all old attachments. ${remainingOldAttachments.length} ciphers still have old attachments.`,
        );
      }
    }

    this.logService.info(
      `Starting transfer of ${personalCiphers.length} personal ciphers to organization ${organizationId} for user ${userId}`,
    );

    await this.cipherService.shareManyWithServer(
      personalCiphers,
      organizationId,
      [defaultCollectionId],
      userId,
    );
  }

  /**
   * Upgrades old attachments that don't have attachment keys.
   * Throws an error if any attachment fails to upgrade as it is not possible to share with an organization without a key.
   */
  private async upgradeOldAttachments(
    ciphers: CipherView[],
    userId: UserId,
    organizationId: OrganizationId,
  ): Promise<void> {
    this.logService.info(
      `Found ${ciphers.length} ciphers with old attachments needing upgrade during transfer to organization ${organizationId} for user ${userId}`,
    );

    for (const cipher of ciphers) {
      try {
        if (!cipher.hasOldAttachments) {
          continue;
        }

        const upgraded = await this.cipherService.upgradeOldCipherAttachments(cipher, userId);

        if (upgraded.hasOldAttachments) {
          this.logService.error(
            `Attachment upgrade did not complete successfully for cipher ${cipher.id} during transfer to organization ${organizationId} for user ${userId}`,
          );
          throw new Error(`Failed to upgrade old attachments for cipher ${cipher.id}`);
        }
      } catch (e) {
        this.logService.error(
          `Failed to upgrade old attachments for cipher ${cipher.id} during transfer to organization ${organizationId} for user ${userId}: ${e}`,
        );
        throw new Error(`Failed to upgrade old attachments for cipher ${cipher.id}`);
      }
    }

    this.logService.info(
      `Successfully upgraded ${ciphers.length} ciphers with old attachments during transfer to organization ${organizationId} for user ${userId}`,
    );
  }
}
