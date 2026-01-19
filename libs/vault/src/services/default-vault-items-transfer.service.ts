import { Injectable } from "@angular/core";
import {
  firstValueFrom,
  switchMap,
  map,
  of,
  Observable,
  combineLatest,
  BehaviorSubject,
} from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { CollectionService, OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { EventType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { getById } from "@bitwarden/common/platform/misc";
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
import {
  TransferItemsDialogComponent,
  TransferItemsDialogResult,
  LeaveConfirmationDialogComponent,
  LeaveConfirmationDialogResult,
} from "../components/vault-items-transfer";

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
    private eventCollectionService: EventCollectionService,
    private configService: ConfigService,
    private organizationUserApiService: OrganizationUserApiService,
  ) {}

  private _transferInProgressSubject = new BehaviorSubject(false);

  transferInProgress$ = this._transferInProgressSubject.asObservable();

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
        return this.organizationService.organizations$(userId).pipe(getById(policy.organizationId));
      }),
    );
  }

  private personalCiphers$(userId: UserId): Observable<CipherView[]> {
    return this.cipherService.cipherViews$(userId).pipe(
      filterOutNullish(),
      map((ciphers) => ciphers.filter((c) => c.organizationId == null)),
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
          this.collectionService.defaultUserCollection$(userId, enforcingOrganization.id),
        ]).pipe(
          map(([personalCiphers, defaultCollection]): UserMigrationInfo => {
            return {
              requiresMigration: personalCiphers.length > 0,
              enforcingOrganization,
              defaultCollectionId: defaultCollection?.id,
            };
          }),
        );
      }),
    );
  }

  /**
   * Prompts the user to accept or decline the vault items transfer.
   * If declined, shows a leave confirmation dialog with option to go back.
   * @returns true if user accepts transfer, false if user confirms leaving
   */
  private async promptUserForTransfer(organizationName: string): Promise<boolean> {
    const confirmDialogRef = TransferItemsDialogComponent.open(this.dialogService, {
      data: { organizationName },
    });

    const confirmResult = await firstValueFrom(confirmDialogRef.closed);

    if (confirmResult === TransferItemsDialogResult.Accepted) {
      return true;
    }

    const leaveDialogRef = LeaveConfirmationDialogComponent.open(this.dialogService, {
      data: { organizationName },
    });

    const leaveResult = await firstValueFrom(leaveDialogRef.closed);

    if (leaveResult === LeaveConfirmationDialogResult.Back) {
      return this.promptUserForTransfer(organizationName);
    }

    return false;
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

    const userAcceptedTransfer = await this.promptUserForTransfer(
      migrationInfo.enforcingOrganization.name,
    );

    if (!userAcceptedTransfer) {
      await this.organizationUserApiService.revokeSelf(migrationInfo.enforcingOrganization.id);

      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("leftOrganization"),
      });

      await this.eventCollectionService.collect(
        EventType.Organization_ItemOrganization_Declined,
        undefined,
        undefined,
        migrationInfo.enforcingOrganization.id,
      );
      return;
    }

    try {
      this._transferInProgressSubject.next(true);
      await this.transferPersonalItems(
        userId,
        migrationInfo.enforcingOrganization.id,
        migrationInfo.defaultCollectionId,
      );
      this._transferInProgressSubject.next(false);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("itemsTransferred"),
      });

      await this.eventCollectionService.collect(
        EventType.Organization_ItemOrganization_Accepted,
        undefined,
        undefined,
        migrationInfo.enforcingOrganization.id,
      );
    } catch (error) {
      this._transferInProgressSubject.next(false);
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
