import { Injectable, inject } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom, lastValueFrom, map } from "rxjs";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { DialogService, ToastService } from "@bitwarden/components";
import {
  CipherFormConfig,
  DefaultCipherFormConfigService,
  PasswordRepromptService,
  VaultItemDialogComponent,
  VaultItemDialogMode,
  VaultItemDialogResult,
} from "@bitwarden/vault";

import { AssignCollectionsWebComponent } from "../components/assign-collections";

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

    await lastValueFrom(dialog.closed);
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

  private async reprompt(ciphers: CipherViewLike[]): Promise<boolean> {
    const anyProtected = ciphers.some((cipher) => cipher.reprompt !== CipherRepromptType.None);

    return !anyProtected || (await this.passwordRepromptService.showPasswordPrompt());
  }
}
