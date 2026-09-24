import { Injectable, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom, lastValueFrom, map } from "rxjs";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherId, CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { DialogService, ToastService } from "@bitwarden/components";
import {
  CipherFormConfig,
  DecryptionFailureDialogComponent,
  DefaultCipherFormConfigService,
  PasswordRepromptService,
  VaultItemDialogComponent,
  VaultItemDialogMode,
  VaultItemDialogResult,
} from "@bitwarden/vault";

import { AssignCollectionsWebComponent } from "../components/assign-collections";
import { ItemDeepLink, ItemDeepLinkAction } from "../utils/item-deep-link";

/**
 * The web individual vault's cipher actions that open a web-specific dialog.
 */
@Injectable()
export class WebVaultItemActionsService {
  private readonly accountService = inject(AccountService);
  private readonly cipherService = inject(CipherService);
  private readonly cipherFormConfigService = inject(DefaultCipherFormConfigService);
  private readonly dialogService = inject(DialogService);
  private readonly i18nService = inject(I18nService);
  private readonly passwordRepromptService = inject(PasswordRepromptService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  private readonly _itemDialogOpen = signal(false);
  readonly itemDialogOpen = this._itemDialogOpen.asReadonly();

  private get userId$() {
    return this.accountService.activeAccount$.pipe(getUserId);
  }

  /** Opens the item in the combined view/edit dialog, starting in read-only view mode. */
  async view(cipher: CipherViewLike): Promise<void> {
    const id = CipherViewLikeUtils.getId(cipher);
    if (id == null) {
      return;
    }

    if (CipherViewLikeUtils.decryptionFailure(cipher)) {
      await this.showDecryptionFailure(id);
      return;
    }

    await this.viewById(id);
  }

  /**
   * {@link view}, for an item named by id rather than by row — the `?itemId=&action=view` deep
   * link, which may name an item the table has no row for.
   */
  async viewById(id: CipherId): Promise<void> {
    const stored = await this.getCipherOrToast(id);
    if (stored == null) {
      return;
    }

    if (!(await this.reprompt(stored.reprompt))) {
      await this.clearItemQueryParams();
      return;
    }

    const formConfig = await this.cipherFormConfigService.buildConfig(
      stored.edit ? "edit" : "partial-edit",
      id,
      stored.type,
    );

    await this.openItemDialog("view", formConfig, {
      cipherId: id,
      action: ItemDeepLinkAction.View,
    });
  }

  /** Opens the item in the combined view/edit dialog, starting in the edit form. */
  async edit(cipher: CipherViewLike): Promise<void> {
    const id = CipherViewLikeUtils.getId(cipher);
    if (id == null) {
      return;
    }

    await this.editById(id);
  }

  /** {@link edit}, for an item named by id rather than by row — see {@link viewById}. */
  async editById(id: CipherId): Promise<void> {
    const stored = await this.getCipherOrToast(id);
    if (stored == null) {
      return;
    }

    await this.openForm(stored, id, "edit");
  }

  /**
   * Opens the add-item form, prefilled with the organization and shared folder in scope, when
   * supplied.
   */
  async add(
    cipherType?: CipherType,
    scope?: { organizationId?: OrganizationId; collectionId?: CollectionId },
  ): Promise<void> {
    const formConfig = await this.cipherFormConfigService.buildConfig("add", undefined, cipherType);

    if (scope?.organizationId) {
      formConfig.initialValues = {
        organizationId: scope.organizationId,
        collectionIds: scope.collectionId ? [scope.collectionId] : undefined,
      };
    }

    await this.openItemDialog("form", formConfig);
  }

  /**
   * Opens the clone form, warning first that passkeys are not carried over.
   */
  async clone(cipher: CipherViewLike): Promise<void> {
    const id = CipherViewLikeUtils.getId(cipher);
    if (id == null) {
      return;
    }

    await this.cloneById(id);
  }

  /** {@link clone}, for an item named by id rather than by row — see {@link viewById}. */
  async cloneById(id: CipherId): Promise<void> {
    const stored = await this.getCipherOrToast(id);
    if (stored == null) {
      return;
    }

    if (stored.login?.fido2Credentials?.length) {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "passkeyNotCopied" },
        content: { key: "passkeyNotCopiedAlert" },
        type: "info",
      });

      if (!confirmed) {
        await this.clearItemQueryParams();
        return;
      }
    }

    await this.openForm(stored, id, "clone");
  }

  /**
   * Reports that an item could not be decrypted, for {@link view} and for the item deep link. The
   * item query params are cleared so a reload does not reopen the dialog.
   */
  async showDecryptionFailure(id: CipherId): Promise<void> {
    DecryptionFailureDialogComponent.open(this.dialogService, { cipherIds: [id] });

    await this.clearItemQueryParams();
  }

  /**
   * Opens the assign-to-shared-folders dialog for a single item.
   *
   * A personal item has no organization yet, so the dialog is opened with no target organization
   * and no available shared folders; it lets the user pick the destination itself.
   */
  async assignToCollections(cipher: CipherViewLike, collections: CollectionView[]): Promise<void> {
    if (!(await this.reprompt(cipher.reprompt))) {
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

    await lastValueFrom(dialog.closed);
  }

  private async openForm(stored: Cipher, id: CipherId, mode: "edit" | "clone"): Promise<void> {
    if (!(await this.reprompt(stored.reprompt))) {
      await this.clearItemQueryParams();
      return;
    }

    const formConfig = await this.cipherFormConfigService.buildConfig(mode, id, stored.type);

    await this.openItemDialog("form", formConfig, {
      cipherId: id,
      action: mode === "clone" ? ItemDeepLinkAction.Clone : ItemDeepLinkAction.Edit,
    });
  }

  /**
   * Opens the item dialog, naming the item on the URL for the length of the dialog when the item
   * has an id — the add form has none.
   */
  private async openItemDialog(
    mode: VaultItemDialogMode,
    formConfig: CipherFormConfig,
    link?: ItemDeepLink,
  ): Promise<void> {
    this._itemDialogOpen.set(true);

    try {
      if (link != null) {
        await this.setItemQueryParams(link);
      }

      const dialogRef = VaultItemDialogComponent.open(this.dialogService, { mode, formConfig });
      const result = await lastValueFrom(dialogRef.closed);

      // The user is navigated to subscription settings elsewhere; leave the URL alone.
      if (result === VaultItemDialogResult.PremiumUpgrade) {
        return;
      }

      // Cleared before the flag drops, so the page does not read the params back as a new deep link.
      await this.clearItemQueryParams();
    } finally {
      this._itemDialogOpen.set(false);
    }
  }

  /**
   * Names the open item on the URL, so the URL is shareable and a reload reopens the item — see
   * {@link itemDeepLinkFrom}. `VaultItemDialogComponent` writes these params itself when the user
   * toggles between view and edit, but not when it opens.
   *
   * The write is made while {@link itemDialogOpen} is set, so the page does not read the params
   * back as a new deep link.
   */
  private async setItemQueryParams(link: ItemDeepLink): Promise<void> {
    await this.router.navigate([], {
      queryParams: { cipherId: null, itemId: link.cipherId, action: link.action },
      queryParamsHandling: "merge",
      replaceUrl: true,
    });
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
   * if it has gone away since the row was rendered — or, for a deep link, was never there.
   */
  private async getCipherOrToast(id: CipherId) {
    const userId = await firstValueFrom(this.userId$);
    const stored = await this.cipherService.get(id, userId);

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
    const cipherId = CipherViewLikeUtils.getId(cipher);
    return firstValueFrom(
      this.cipherService
        .cipherViews$(userId)
        .pipe(map((views) => views.find((v) => v.id === cipherId) as CipherView)),
    );
  }

  private async reprompt(reprompt: CipherRepromptType): Promise<boolean> {
    return (
      reprompt === CipherRepromptType.None ||
      (await this.passwordRepromptService.showPasswordPrompt())
    );
  }
}
