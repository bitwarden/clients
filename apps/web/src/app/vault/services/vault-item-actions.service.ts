import { Injectable, inject } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom, lastValueFrom, map } from "rxjs";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { DialogService, ToastService } from "@bitwarden/components";
import {
  AttachmentsV2Component,
  CipherFormConfig,
  DefaultCipherFormConfigService,
  PasswordRepromptService,
  VaultItemDialogComponent,
  VaultItemDialogMode,
  VaultItemDialogResult,
} from "@bitwarden/vault";

import { AssignCollectionsWebComponent } from "../components/assign-collections";

/**
 * The cipher actions the web individual vault offers, one method per row action.
 *
 * Every method takes what it needs as an argument rather than reading page state, so the caller
 * owns the filter/selection context. That is what lets {@link
 * apps/web/src/app/vault/individual-vault/vault-next.component.ts} drive them without the legacy
 * `RoutedVaultFilterService` machinery.
 *
 * There is deliberately no `refresh()` equivalent: the data feeding the table is composed from live
 * observables (`cipherService.cipherListViews$` and friends), so the list reflects a mutation as
 * soon as the service layer emits.
 */
@Injectable()
export class WebVaultItemActionsService {
  private readonly accountService = inject(AccountService);
  private readonly cipherService = inject(CipherService);
  private readonly cipherArchiveService = inject(CipherArchiveService);
  private readonly cipherFormConfigService = inject(DefaultCipherFormConfigService);
  private readonly dialogService = inject(DialogService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly messagingService = inject(MessagingService);
  private readonly passwordRepromptService = inject(PasswordRepromptService);
  private readonly premiumUpgradePromptService = inject(PremiumUpgradePromptService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  private get userId$() {
    return this.accountService.activeAccount$.pipe(getUserId);
  }

  /** Opens the item in the combined view/edit dialog, starting in read-only view mode. */
  async view(cipher: CipherViewLike): Promise<void> {
    if (!(await this.reprompt([cipher]))) {
      return;
    }

    const stored = await this.getCipherOrToast(cipher);
    if (stored == null) {
      return;
    }

    const formConfig = await this.cipherFormConfigService.buildConfig(
      stored.edit ? "edit" : "partial-edit",
      stored.id as CipherId,
      stored.type,
    );

    await this.openItemDialog("view", formConfig);
  }

  /** Opens the item in the combined view/edit dialog, starting in the edit form. */
  async edit(cipher: CipherViewLike): Promise<void> {
    await this.openForm(cipher, "edit");
  }

  /**
   * Opens the add-item form.
   *
   * No `initialValues` are seeded — deriving a default organization, shared folder, or folder from
   * the active filter arrives with the filter chip wiring.
   */
  async add(cipherType?: CipherType): Promise<void> {
    const formConfig = await this.cipherFormConfigService.buildConfig("add", undefined, cipherType);
    await this.openItemDialog("form", formConfig);
  }

  /**
   * Opens the clone form, warning first that passkeys are not carried over.
   */
  async clone(cipher: CipherViewLike): Promise<void> {
    if (CipherViewLikeUtils.hasFido2Credentials(cipher)) {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "passkeyNotCopied" },
        content: { key: "passkeyNotCopiedAlert" },
        type: "info",
      });

      if (!confirmed) {
        return;
      }
    }

    await this.openForm(cipher, "clone");
  }

  /**
   * Opens the attachments dialog, first checking that the user is entitled to attachments — file
   * storage is a premium feature for personal items, and an organization needs storage allocated.
   */
  async viewAttachments(
    cipher: CipherViewLike,
    canAccessPremium: boolean,
    organizations: Organization[],
  ): Promise<void> {
    if (!(await this.reprompt([cipher]))) {
      return;
    }

    if (cipher.organizationId == null) {
      if (!canAccessPremium) {
        await this.premiumUpgradePromptService.promptForPremium();
        return;
      }
    } else {
      const organization = organizations.find((o) => o.id === uuidAsString(cipher.organizationId));
      if (
        organization != null &&
        (organization.maxStorageGb == null || organization.maxStorageGb === 0)
      ) {
        this.messagingService.send("upgradeOrganization", {
          organizationId: cipher.organizationId,
        });
        return;
      }
    }

    const dialogRef = AttachmentsV2Component.open(this.dialogService, {
      cipherId: cipher.id as CipherId,
      organizationId: cipher.organizationId as OrganizationId,
      canEditCipher: cipher.edit,
    });

    // Uploads and removals are reflected by the live cipher streams; nothing to refresh.
    await lastValueFrom(dialogRef.closed);
  }

  /** Toggles the item's favorite flag and persists it. */
  async toggleFavorite(cipher: CipherViewLike): Promise<void> {
    const userId = await firstValueFrom(this.userId$);
    const fullView = await this.cipherService.getFullCipherView(cipher);
    fullView.favorite = !fullView.favorite;

    await this.cipherService.updateWithServer(fullView, userId);

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t(
        fullView.favorite ? "itemAddedToFavorites" : "itemRemovedFromFavorites",
      ),
    });
  }

  /**
   * Opens the assign-to-shared-folders dialog for a single item.
   *
   * A personal item has no organization yet, so the dialog is opened with no target organization
   * and no available shared folders; it lets the user pick the destination itself.
   */
  async assignToCollections(cipher: CipherViewLike, collections: CollectionView[]): Promise<void> {
    if (!(await this.reprompt([cipher]))) {
      return;
    }

    const organizationId = uuidAsString(cipher.organizationId);
    const availableCollections =
      organizationId == null ? [] : collections.filter((c) => c.organizationId === organizationId);

    const dialog = AssignCollectionsWebComponent.open(this.dialogService, {
      data: {
        ciphers: [await this.toCipherView(cipher)],
        organizationId: organizationId as OrganizationId,
        availableCollections,
        activeCollection: undefined,
      },
    });

    // Assignment changes are reflected by the live cipher streams; nothing to refresh.
    await lastValueFrom(dialog.closed);
  }

  /** Archives the item after confirmation. */
  async archive(cipher: CipherViewLike): Promise<void> {
    if (!(await this.reprompt([cipher]))) {
      return;
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "archiveItem" },
      content: { key: "archiveItemDialogContent" },
      acceptButtonText: { key: "archiveVerb" },
      type: "info",
    });

    if (!confirmed) {
      return;
    }

    const userId = await firstValueFrom(this.userId$);

    try {
      await this.cipherArchiveService.archiveWithServer(cipher.id as CipherId, userId);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("itemArchiveToast"),
      });
    } catch (e) {
      this.logService.error("Error archiving cipher", e);
      this.showUnexpectedError();
    }
  }

  /** Restores the item out of the archive. */
  async unarchive(cipher: CipherViewLike): Promise<void> {
    if (!(await this.reprompt([cipher]))) {
      return;
    }

    const userId = await firstValueFrom(this.userId$);

    try {
      await this.cipherArchiveService.unarchiveWithServer(cipher.id as CipherId, userId);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("itemUnarchivedToast"),
      });
    } catch (e) {
      this.logService.error("Error unarchiving cipher", e);
      this.showUnexpectedError();
    }
  }

  /** Restores a soft-deleted item out of the trash. */
  async restore(cipher: CipherViewLike): Promise<void> {
    if (!CipherViewLikeUtils.isDeleted(cipher)) {
      return;
    }

    if (!cipher.edit) {
      this.showMissingPermissionsError();
      return;
    }

    if (!(await this.reprompt([cipher]))) {
      return;
    }

    const userId = await firstValueFrom(this.userId$);

    try {
      await this.cipherService.restoreWithServer(uuidAsString(cipher.id), userId);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t(
          CipherViewLikeUtils.isArchived(cipher) ? "archivedItemRestored" : "restoredItem",
        ),
      });
    } catch (e) {
      this.logService.error(e);
    }
  }

  /**
   * Deletes the item after confirmation. An item already in the trash is deleted permanently.
   */
  async delete(cipher: CipherViewLike): Promise<void> {
    if (!(await this.reprompt([cipher]))) {
      return;
    }

    if (!cipher.edit) {
      this.showMissingPermissionsError();
      return;
    }

    const permanent = CipherViewLikeUtils.isDeleted(cipher);

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: permanent ? "permanentlyDeleteItem" : "deleteItem" },
      content: { key: permanent ? "permanentlyDeleteItemConfirmation" : "deleteItemConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }

    const userId = await firstValueFrom(this.userId$);

    try {
      await this.deleteWithServer(uuidAsString(cipher.id), userId, permanent);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t(permanent ? "permanentlyDeletedItem" : "deletedItem"),
      });
    } catch (e) {
      this.logService.error(e);
    }
  }

  private async openForm(cipher: CipherViewLike, mode: "edit" | "clone"): Promise<void> {
    if (!(await this.reprompt([cipher]))) {
      return;
    }

    const stored = await this.getCipherOrToast(cipher);
    if (stored == null) {
      return;
    }

    const formConfig = await this.cipherFormConfigService.buildConfig(
      mode,
      stored.id as CipherId,
      stored.type,
    );

    await this.openItemDialog("form", formConfig);
  }

  private async openItemDialog(
    mode: VaultItemDialogMode,
    formConfig: CipherFormConfig,
  ): Promise<void> {
    const dialogRef = VaultItemDialogComponent.open(this.dialogService, { mode, formConfig });
    const result = await lastValueFrom(dialogRef.closed);

    // The user is navigated to subscription settings elsewhere; leave the URL alone.
    if (result === VaultItemDialogResult.PremiumUpgrade) {
      return;
    }

    await this.clearItemQueryParams();
  }

  /**
   * Clears the item query params. `VaultItemDialogComponent` writes them itself when the user
   * toggles between view and edit, so they outlive the dialog unless cleared here.
   */
  private async clearItemQueryParams(): Promise<void> {
    await this.router.navigate([], {
      queryParams: { cipherId: null, itemId: null, action: null },
      queryParamsHandling: "merge",
      replaceUrl: true,
    });
  }

  /**
   * Reads the stored cipher so the dialog config is built from the full view, toasting and bailing
   * if it has gone away since the row was rendered.
   */
  private async getCipherOrToast(cipher: CipherViewLike) {
    const userId = await firstValueFrom(this.userId$);
    const stored = await this.cipherService.get(uuidAsString(cipher.id), userId);

    if (stored == null) {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("unknownCipher"),
      });
      await this.clearItemQueryParams();
      return undefined;
    }

    return stored;
  }

  /** `AssignCollectionsWebComponent` needs full `CipherView`s, which a list view is not. */
  private async toCipherView(cipher: CipherViewLike): Promise<CipherView> {
    if (!CipherViewLikeUtils.isCipherListView(cipher)) {
      return cipher;
    }

    const userId = await firstValueFrom(this.userId$);
    const cipherId = uuidAsString(cipher.id);
    return firstValueFrom(
      this.cipherService
        .cipherViews$(userId)
        .pipe(map((views) => views.find((v) => v.id === cipherId) as CipherView)),
    );
  }

  private deleteWithServer(id: string, userId: UserId, permanent: boolean) {
    return permanent
      ? this.cipherService.deleteWithServer(id, userId)
      : this.cipherService.softDeleteWithServer(id, userId);
  }

  private async reprompt(ciphers: CipherViewLike[]): Promise<boolean> {
    const anyProtected = ciphers.some((cipher) => cipher.reprompt !== CipherRepromptType.None);

    return !anyProtected || (await this.passwordRepromptService.showPasswordPrompt());
  }

  private showMissingPermissionsError() {
    this.toastService.showToast({
      variant: "error",
      message: this.i18nService.t("missingPermissions"),
    });
  }

  private showUnexpectedError() {
    this.toastService.showToast({
      variant: "error",
      message: this.i18nService.t("errorOccurred"),
    });
  }
}
