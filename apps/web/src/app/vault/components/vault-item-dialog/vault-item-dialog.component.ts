// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, ElementRef, Inject, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { firstValueFrom, Subject, switchMap } from "rxjs";
import { map } from "rxjs/operators";

import { CollectionView } from "@bitwarden/admin-console/common";
import { PremiumBadgeComponent } from "@bitwarden/angular/billing/components/premium-badge";
import { VaultViewPasswordHistoryService } from "@bitwarden/angular/services/view-password-history.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { EventType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { CipherId, CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { ViewPasswordHistoryService } from "@bitwarden/common/vault/abstractions/view-password-history.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import {
  DIALOG_DATA,
  DialogRef,
  AsyncActionsModule,
  ButtonModule,
  DialogModule,
  DialogService,
  ItemModule,
  ToastService,
} from "@bitwarden/components";
import {
  AttachmentDialogCloseResult,
  AttachmentDialogResult,
  AttachmentsV2Component,
  ChangeLoginPasswordService,
  CipherFormComponent,
  CipherFormConfig,
  CipherFormGenerationService,
  CipherFormModule,
  CipherViewComponent,
  DecryptionFailureDialogComponent,
  DefaultChangeLoginPasswordService,
} from "@bitwarden/vault";

import { SharedModule } from "../../../shared/shared.module";
import { WebVaultPremiumUpgradePromptService } from "../../../vault/services/web-premium-upgrade-prompt.service";
import { RoutedVaultFilterService } from "../../individual-vault/vault-filter/services/routed-vault-filter.service";
import { RoutedVaultFilterModel } from "../../individual-vault/vault-filter/shared/models/routed-vault-filter.model";
import { WebCipherFormGenerationService } from "../../services/web-cipher-form-generation.service";

export type VaultItemDialogMode = "view" | "form";

export interface VaultItemDialogParams {
  /**
   * The mode of the dialog.
   * - `view` is for viewing an existing cipher.
   * - `form` is for editing or creating a new cipher.
   */
  mode: VaultItemDialogMode;

  /**
   * The configuration object for the dialog and form.
   */
  formConfig: CipherFormConfig;

  /**
   * If true, the "edit" button will be disabled in the dialog.
   */
  disableForm?: boolean;

  /**
   * The ID of the active collection. This is know the collection filter selected by the user.
   */
  activeCollectionId?: CollectionId;

  /**
   * If true, the dialog is being opened from the admin console.
   */
  isAdminConsoleAction?: boolean;

  /**
   * Function to restore a cipher from the trash.
   */
  restore?: (c: CipherViewLike) => Promise<boolean>;
}

export const VaultItemDialogResult = {
  /**
   * A cipher was saved (created or updated).
   */
  Saved: "saved",

  /**
   * A cipher was deleted.
   */
  Deleted: "deleted",

  /**
   * The dialog was closed to navigate the user the premium upgrade page.
   */
  PremiumUpgrade: "premiumUpgrade",

  /**
   * A cipher was restored
   */
  Restored: "restored",
} as const;

export type VaultItemDialogResult = UnionOfValues<typeof VaultItemDialogResult>;

@Component({
  selector: "app-vault-item-dialog",
  templateUrl: "vault-item-dialog.component.html",
  imports: [
    ButtonModule,
    CipherViewComponent,
    DialogModule,
    CommonModule,
    SharedModule,
    CipherFormModule,
    AsyncActionsModule,
    ItemModule,
    PremiumBadgeComponent,
  ],
  providers: [
    { provide: PremiumUpgradePromptService, useClass: WebVaultPremiumUpgradePromptService },
    { provide: ViewPasswordHistoryService, useClass: VaultViewPasswordHistoryService },
    { provide: CipherFormGenerationService, useClass: WebCipherFormGenerationService },
    RoutedVaultFilterService,
    { provide: ChangeLoginPasswordService, useClass: DefaultChangeLoginPasswordService },
  ],
})
export class VaultItemDialogComponent implements OnInit, OnDestroy {
  /**
   * Reference to the dialog content element. Used to scroll to the top of the dialog when switching modes.
   * @protected
   */
  @ViewChild("dialogContent")
  protected dialogContent: ElementRef<HTMLElement>;

  @ViewChild(CipherFormComponent) cipherFormComponent!: CipherFormComponent;

  /**
   * Tracks if the cipher was ever modified while the dialog was open. Used to ensure the dialog emits the correct result
   * in case of closing with the X button or ESC key.
   * @private
   */
  private _cipherModified: boolean = false;

  /**
   * The original mode of the form when the dialog is first opened.
   * Used to determine if the form should switch to edit mode after successfully creating a new cipher.
   * @private
   */
  private _originalFormMode = this.params.formConfig.mode;

  /**
   * Subject to emit when the form is ready to be displayed.
   * @private
   */
  private _formReadySubject = new Subject<void>();

  /**
   * Tracks if the dialog is performing the initial load. Used to display a spinner while loading.
   * @private
   */
  protected performingInitialLoad: boolean = true;

  /**
   * The title of the dialog. Updates based on the dialog mode and cipher type.
   * @protected
   */
  protected title: string;

  /**
   * The current cipher being viewed. Undefined if creating a new cipher.
   * @protected
   */
  protected cipher?: CipherView;

  /**
   * The organization the current cipher belongs to. Undefined if creating a new cipher.
   * @protected
   */
  protected organization?: Organization;

  /**
   * The collections the current cipher is assigned to. Undefined if creating a new cipher.
   * @protected
   */
  protected collections?: CollectionView[];

  /**
   * Flag to indicate if the user has access to attachments via a premium subscription.
   * @protected
   */
  protected canAccessAttachments$ = this.accountService.activeAccount$.pipe(
    switchMap((account) =>
      this.billingAccountProfileStateService.hasPremiumFromAnySource$(account.id),
    ),
  );

  protected get isTrashFilter() {
    return this.filter?.type === "trash";
  }

  protected get showCancel() {
    return !this.isTrashFilter && !this.showCipherView;
  }

  protected get showClose() {
    return this.isTrashFilter && !this.showRestore;
  }

  /**
   * Determines if the user may restore the item.
   * A user may restore items if they have delete permissions and the item is in the trash.
   */
  protected async canUserRestore() {
    return this.isTrashFilter && this.cipher?.isDeleted && this.cipher?.permissions.restore;
  }

  protected showRestore: boolean;

  protected get loadingForm() {
    return this.loadForm && !this.formReady;
  }

  protected get disableEdit() {
    return this.params.disableForm;
  }

  protected get showEdit() {
    return this.showCipherView && !this.isTrashFilter && !this.showRestore;
  }

  protected get showDelete() {
    // Don't show the delete button when cloning a cipher
    if (this.params.mode == "form" && this.formConfig.mode === "clone") {
      return false;
    }
    // Never show the delete button for new ciphers
    return this.cipher != null;
  }

  protected get showCipherView() {
    return this.cipher != undefined && (this.params.mode === "view" || this.loadingForm);
  }

  /**
   * Flag to initialize/attach the form component.
   */
  protected loadForm = this.params.mode === "form";

  /**
   * Flag to indicate the form is ready to be displayed.
   */
  protected formReady = false;

  protected formConfig: CipherFormConfig = this.params.formConfig;

  protected filter: RoutedVaultFilterModel;

  protected canDelete = false;

  protected attachmentsButtonDisabled = false;

  protected confirmedPremiumUpgrade = false;

  constructor(
    @Inject(DIALOG_DATA) protected params: VaultItemDialogParams,
    private dialogRef: DialogRef<VaultItemDialogResult>,
    private dialogService: DialogService,
    private i18nService: I18nService,
    private toastService: ToastService,
    private messagingService: MessagingService,
    private logService: LogService,
    private cipherService: CipherService,
    private accountService: AccountService,
    private router: Router,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private premiumUpgradeService: PremiumUpgradePromptService,
    private cipherAuthorizationService: CipherAuthorizationService,
    private apiService: ApiService,
    private eventCollectionService: EventCollectionService,
    private routedVaultFilterService: RoutedVaultFilterService,
  ) {
    this.updateTitle();
    this.premiumUpgradeService.upgradeConfirmed$
      .pipe(
        map((c) => c && (this.confirmedPremiumUpgrade = true)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  async ngOnInit() {
    this.cipher = await this.getDecryptedCipherView(this.formConfig);

    if (this.cipher) {
      if (this.cipher.decryptionFailure) {
        this.dialogService.open(DecryptionFailureDialogComponent, {
          data: { cipherIds: [this.cipher.id] },
        });
        this.dialogRef.close();
        return;
      }

      this.collections = this.formConfig.collections.filter((c) =>
        this.cipher.collectionIds?.includes(c.id),
      );
      this.organization = this.formConfig.organizations.find(
        (o) => o.id === this.cipher.organizationId,
      );

      this.canDelete = await firstValueFrom(
        this.cipherAuthorizationService.canDeleteCipher$(
          this.cipher,
          this.params.isAdminConsoleAction,
        ),
      );

      await this.eventCollectionService.collect(
        EventType.Cipher_ClientViewed,
        this.cipher.id,
        false,
        this.cipher.organizationId,
      );
    }

    this.filter = await firstValueFrom(this.routedVaultFilterService.filter$);

    this.showRestore = await this.canUserRestore();
    this.performingInitialLoad = false;
  }

  ngOnDestroy() {
    // If the user already confirmed a premium upgrade, don't emit any other result as it will overwrite the premium upgrade result.
    if (this.confirmedPremiumUpgrade) {
      return;
    }
    // If the cipher was modified, be sure we emit the saved result in case the dialog was closed with the X button or ESC key.
    if (this._cipherModified) {
      this.dialogRef.close(VaultItemDialogResult.Saved);
    }
  }

  formStatusChanged(status: "disabled" | "enabled") {
    this.attachmentsButtonDisabled = status === "disabled";
  }

  /**
   * Called by the CipherFormComponent when the cipher is saved successfully.
   * @param cipherView - The newly saved cipher.
   */
  protected async onCipherSaved(cipherView: CipherView) {
    // We successfully saved the cipher, update the dialog state and switch to view mode.
    this.cipher = cipherView;
    this.collections = this.formConfig.collections.filter((c) =>
      cipherView.collectionIds?.includes(c.id),
    );

    // If the cipher was newly created (via add/clone), switch the form to edit for subsequent edits.
    if (this._originalFormMode === "add" || this._originalFormMode === "clone") {
      this.formConfig.mode = "edit";
      this.formConfig.initialValues = null;
    }
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    let cipher = await this.cipherService.get(cipherView.id, activeUserId);

    // When the form config is used within the Admin Console, retrieve the cipher from the admin endpoint (if not found in local state)
    if (this.formConfig.isAdminConsole && (cipher == null || this.formConfig.admin)) {
      const cipherResponse = await this.apiService.getCipherAdmin(cipherView.id);
      cipherResponse.edit = true;
      cipherResponse.viewPassword = true;

      const cipherData = new CipherData(cipherResponse);
      cipher = new Cipher(cipherData);

      // Update organizationUseTotp from server response
      this.cipher.organizationUseTotp = cipher.organizationUseTotp;
    }

    // Store the updated cipher so any following edits use the most up to date cipher
    this.formConfig.originalCipher = cipher;
    this._cipherModified = true;
    await this.changeMode("view");
  }

  /**
   * Called by the CipherFormComponent when the form is ready to be displayed.
   */
  protected onFormReady() {
    this.formReady = true;
    this._formReadySubject.next();
  }

  restore = async () => {
    await this.params.restore?.(this.cipher);
    this.dialogRef.close(VaultItemDialogResult.Restored);
  };

  delete = async () => {
    if (!this.cipher) {
      return;
    }
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteItem" },
      content: {
        key: this.cipher.isDeleted ? "permanentlyDeleteItemConfirmation" : "deleteItemConfirmation",
      },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }

    try {
      await this.deleteCipher();
      this.toastService.showToast({
        variant: "success",
        title: this.i18nService.t("success"),
        message: this.i18nService.t(
          this.cipher.isDeleted ? "permanentlyDeletedItem" : "deletedItem",
        ),
      });
      this.messagingService.send(
        this.cipher.isDeleted ? "permanentlyDeletedCipher" : "deletedCipher",
      );
    } catch (e) {
      this.logService.error(e);
    }
    this._cipherModified = false;
    this.dialogRef.close(VaultItemDialogResult.Deleted);
  };

  openAttachmentsDialog = async () => {
    const canAccessAttachments = await firstValueFrom(this.canAccessAttachments$);

    if (!canAccessAttachments) {
      await this.premiumUpgradeService.promptForPremium(this.cipher?.organizationId);
      return;
    }

    const dialogRef = this.dialogService.open<
      AttachmentDialogCloseResult,
      { cipherId: CipherId; organizationId?: OrganizationId }
    >(AttachmentsV2Component, {
      data: {
        cipherId: this.formConfig.originalCipher?.id as CipherId,
        organizationId: this.formConfig.originalCipher?.organizationId as OrganizationId,
      },
    });

    const result = await firstValueFrom(dialogRef.closed);

    if (
      result.action === AttachmentDialogResult.Removed ||
      result.action === AttachmentDialogResult.Uploaded
    ) {
      const activeUserId = await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((a) => a?.id)),
      );

      let updatedCipherView: CipherView;

      if (this.formConfig.admin) {
        const cipherResponse = await this.apiService.getCipherAdmin(
          this.formConfig.originalCipher?.id,
        );
        const cipherData = new CipherData(cipherResponse);
        const cipher = new Cipher(cipherData);

        updatedCipherView = await cipher.decrypt(
          await this.cipherService.getKeyForCipherKeyDecryption(cipher, activeUserId),
        );
      } else {
        const updatedCipher = await this.cipherService.get(
          this.formConfig.originalCipher?.id,
          activeUserId,
        );

        updatedCipherView = await this.cipherService.decrypt(updatedCipher, activeUserId);
      }

      this.cipherFormComponent.patchCipher((currentCipher) => {
        currentCipher.attachments = updatedCipherView.attachments;
        currentCipher.revisionDate = updatedCipherView.revisionDate;

        return currentCipher;
      });

      this._cipherModified = true;
    }
  };

  switchToEdit = async () => {
    if (!this.cipher) {
      return;
    }
    await this.changeMode("form");
  };

  cancel = async () => {
    // We're in View mode, we don't have a cipher, or we were cloning, close the dialog.
    if (this.params.mode === "view" || this.cipher == null || this.formConfig.mode === "clone") {
      this.dialogRef.close(this._cipherModified ? VaultItemDialogResult.Saved : undefined);
      return;
    }

    // We're in Form mode, and we have a cipher, switch back to View mode.
    await this.changeMode("view");
  };

  private async getDecryptedCipherView(config: CipherFormConfig) {
    if (config.originalCipher == null) {
      return;
    }
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return await this.cipherService.decrypt(config.originalCipher, activeUserId);
  }

  private updateTitle(): void {
    const translation: { [key: string]: { [key: number]: string } } = {
      view: {
        [CipherType.Login]: "viewItemHeaderLogin",
        [CipherType.Card]: "viewItemHeaderCard",
        [CipherType.Identity]: "viewItemHeaderIdentity",
        [CipherType.SecureNote]: "viewItemHeaderNote",
        [CipherType.SshKey]: "viewItemHeaderSshKey",
      },
      new: {
        [CipherType.Login]: "newItemHeaderLogin",
        [CipherType.Card]: "newItemHeaderCard",
        [CipherType.Identity]: "newItemHeaderIdentity",
        [CipherType.SecureNote]: "newItemHeaderNote",
        [CipherType.SshKey]: "newItemHeaderSshKey",
      },
      edit: {
        [CipherType.Login]: "editItemHeaderLogin",
        [CipherType.Card]: "editItemHeaderCard",
        [CipherType.Identity]: "editItemHeaderIdentity",
        [CipherType.SecureNote]: "editItemHeaderNote",
        [CipherType.SshKey]: "editItemHeaderSshKey",
      },
    };
    const type = this.cipher?.type ?? this.formConfig.cipherType;
    let mode: "view" | "edit" | "new" = "view";

    if (this.params.mode === "form") {
      mode =
        this.formConfig.mode === "edit" || this.formConfig.mode === "partial-edit" ? "edit" : "new";
    }

    const fullTranslation = translation[mode][type];

    this.title = this.i18nService.t(fullTranslation);
  }

  /**
   * Changes the mode of the dialog. When switching to Form mode, the form is initialized first then displayed once ready.
   * @param mode
   * @private
   */
  private async changeMode(mode: VaultItemDialogMode) {
    this.formReady = false;

    if (mode == "form") {
      this.loadForm = true;
      // Wait for the formReadySubject to emit before continuing.
      // This helps prevent flashing an empty dialog while the form is initializing.
      await firstValueFrom(this._formReadySubject);
    } else {
      this.loadForm = false;
    }

    this.params.mode = mode;
    this.updateTitle();
    // Scroll to the top of the dialog content when switching modes.
    this.dialogContent.nativeElement.parentElement.scrollTop = 0;

    // Update the URL query params to reflect the new mode.
    await this.router.navigate([], {
      queryParams: {
        action: mode === "form" ? "edit" : "view",
        itemId: this.cipher?.id,
      },
      queryParamsHandling: "merge",
      replaceUrl: true,
    });
  }

  /**
   * Helper method to delete cipher.
   */
  private async deleteCipher(): Promise<void> {
    const cipherIsUnassigned = this.cipher.isUnassigned;

    // Delete the cipher as an admin when:
    // - The organization allows for owners/admins to manage all collections/items
    // - The cipher is unassigned
    const asAdmin = this.organization?.canEditAllCiphers || cipherIsUnassigned;

    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.id)),
    );

    if (this.cipher.isDeleted) {
      await this.cipherService.deleteWithServer(this.cipher.id, activeUserId, asAdmin);
    } else {
      await this.cipherService.softDeleteWithServer(this.cipher.id, activeUserId, asAdmin);
    }
  }

  /**
   * Opens the VaultItemDialog.
   * @param dialogService
   * @param params
   */
  static open(dialogService: DialogService, params: VaultItemDialogParams) {
    return dialogService.open<VaultItemDialogResult, VaultItemDialogParams>(
      VaultItemDialogComponent,
      {
        data: params,
      },
    );
  }
}
