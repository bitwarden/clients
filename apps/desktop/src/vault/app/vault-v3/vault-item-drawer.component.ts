// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Inject, OnDestroy, ViewChild } from "@angular/core";
import { firstValueFrom, Subject } from "rxjs";

import { PremiumBadgeComponent } from "@bitwarden/angular/billing/components/premium-badge";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
// import { CipherId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  DIALOG_DATA,
  DialogRef,
  AsyncActionsModule,
  ButtonModule,
  DialogService,
  DialogModule,
  ItemModule,
} from "@bitwarden/components";
import {
  // AttachmentDialogResult,
  // AttachmentsV2Component,
  CipherFormComponent,
  CipherFormConfig,
  CipherFormModule,
  CipherViewComponent,
} from "@bitwarden/vault";

import { ItemFooterComponent } from "../vault/item-footer.component";

export interface VaultItemDrawerParams {
  /**
   * The configuration object for the cipher form.
   */
  config: CipherFormConfig;

  /**
   * The initial mode for the drawer: 'view' | 'add' | 'edit' | 'clone'
   */
  initialMode: "view" | "add" | "edit" | "clone";
}

/** A result of the vault item drawer. */
export const VaultItemDrawerResult = Object.freeze({
  /** The cipher was saved. */
  Saved: "saved",
  /** The cipher was deleted. */
  Deleted: "deleted",
  /** The cipher was archived/unarchived. */
  Archived: "archived",
  /** The cipher was restored. */
  Restored: "restored",
} as const);

/** A result of the vault item drawer. */
export type VaultItemDrawerResult = {
  result: (typeof VaultItemDrawerResult)[keyof typeof VaultItemDrawerResult];
  cipher?: CipherView;
};

type DrawerMode = "view" | "form";

/**
 * Component for viewing or editing a vault item in a drawer.
 * Supports both view and edit modes with in-drawer switching.
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "vault-item-drawer.component.html",
  imports: [
    CommonModule,
    JslibModule,
    ButtonModule,
    CipherFormModule,
    CipherViewComponent,
    AsyncActionsModule,
    DialogModule,
    ItemFooterComponent,
    ItemModule,
    PremiumBadgeComponent,
  ],
})
export class VaultItemDrawerComponent implements OnDestroy {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild(ItemFooterComponent) itemFooter: ItemFooterComponent | null = null;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild(CipherFormComponent) cipherFormComponent!: CipherFormComponent;

  /**
   * The title of the drawer.
   */
  protected title: string;

  /**
   * Current mode of the drawer: 'view' or 'form'
   */
  protected mode: DrawerMode;

  /**
   * Flag to initialize/attach the form component.
   */
  protected loadForm: boolean;

  /**
   * Flag to indicate the form is ready to be displayed.
   */
  protected formReady = false;

  /**
   * The configuration for the cipher form.
   */
  protected formConfig: CipherFormConfig;

  /**
   * The cipher being viewed or edited.
   */
  protected cipher: CipherView | null = null;

  /**
   * Collections the cipher is assigned to.
   */
  protected collections: CollectionView[] = [];

  /**
   * The action to pass to ItemFooterComponent ('view', 'add', 'edit', 'clone')
   */
  protected get action(): string {
    if (this.mode === "view") {
      return "view";
    }
    return this.formConfig.mode;
  }

  /**
   * Whether to show the cipher view component.
   */
  protected get showCipherView(): boolean {
    return this.cipher != null && this.mode === "view";
  }

  /**
   * Whether the form is loading (initialized but not ready).
   */
  protected get loadingForm(): boolean {
    return this.loadForm && !this.formReady;
  }

  /**
   * Tracks if the cipher was ever modified while the drawer was open.
   * @private
   */
  private _cipherModified = false;

  /**
   * Subject to emit when the form is ready to be displayed.
   * @private
   */
  private _formReadySubject = new Subject<void>();

  /**
   * The initial mode from params (used to determine behavior after save).
   * @private
   */
  private _initialMode = this.params.initialMode;

  constructor(
    @Inject(DIALOG_DATA) protected params: VaultItemDrawerParams,
    private dialogRef: DialogRef<VaultItemDrawerResult>,
    private i18nService: I18nService,
    private dialogService: DialogService,
  ) {
    this.formConfig = params.config;
    this.cipher = params.config.originalCipher
      ? new CipherView(params.config.originalCipher)
      : null;

    if (this.cipher && this.formConfig.collections) {
      this.collections = this.formConfig.collections.filter((c) =>
        this.cipher.collectionIds?.includes(c.id),
      );
    }

    // Set initial mode
    this.mode = params.initialMode === "view" ? "view" : "form";
    this.loadForm = this.mode === "form";

    this.updateTitle();
  }

  ngOnDestroy() {
    // If the cipher was modified, be sure we emit the saved result in case the dialog was closed with the X button or ESC key.
    if (this._cipherModified) {
      this.dialogRef.close({ result: VaultItemDrawerResult.Saved });
    }
  }

  /**
   * Called by the CipherFormComponent when the cipher is saved successfully.
   */
  protected async onCipherSaved(cipherView: CipherView) {
    this.cipher = cipherView;
    this._cipherModified = true;

    if (this.formConfig.collections) {
      this.collections = this.formConfig.collections.filter((c) =>
        cipherView.collectionIds?.includes(c.id),
      );
    }

    // If the cipher was newly created (via add/clone), switch the form to edit for subsequent edits.
    if (this._initialMode === "add" || this._initialMode === "clone") {
      this.formConfig.mode = "edit";
      this.formConfig.initialValues = null;
    }

    // Switch back to view mode after save
    await this.changeMode("view");
  }

  /**
   * Called by the CipherFormComponent when the form is ready to be displayed.
   */
  protected onFormReady() {
    this.formReady = true;
    this._formReadySubject.next();
  }

  /**
   * Called when ItemFooter emits onEdit event.
   * Switches from view mode to edit mode.
   */
  protected async onEdit() {
    await this.changeMode("form");
  }

  /**
   * Called when ItemFooter emits onClone event.
   */
  protected async onClone(cipher: CipherView) {
    // Close drawer and let parent handle cloning by reopening with clone mode
    this.dialogRef.close({ result: VaultItemDrawerResult.Saved });
  }

  /**
   * Called when ItemFooter emits onDelete event.
   */
  protected onDelete() {
    this._cipherModified = false;
    this.dialogRef.close({ result: VaultItemDrawerResult.Deleted });
  }

  /**
   * Called when ItemFooter emits onRestore event.
   */
  protected onRestore() {
    this._cipherModified = false;
    this.dialogRef.close({ result: VaultItemDrawerResult.Restored });
  }

  /**
   * Called when ItemFooter emits onCancel event.
   * Returns to view mode or closes drawer if no cipher exists.
   */
  protected async onCancel() {
    // We're in View mode, we don't have a cipher, or we were adding/cloning, close the drawer.
    if (
      this.mode === "view" ||
      this.cipher == null ||
      this._initialMode === "add" ||
      this._initialMode === "clone"
    ) {
      this.dialogRef.close(
        this._cipherModified ? { result: VaultItemDrawerResult.Saved } : undefined,
      );
      return;
    }

    // We're in Form mode, and we have a cipher, switch back to View mode.
    await this.changeMode("view");
  }

  /**
   * Called when ItemFooter emits onArchiveToggle event.
   */
  protected async onArchiveToggle() {
    // ItemFooter handles the archive logic, just refresh and indicate change
    this._cipherModified = true;
    await this.refreshCurrentCipher();
  }

  /**
   * Opens the attachments dialog for the current cipher.
   */
  protected async openAttachmentsDialog() {
    // const dialogRef = AttachmentsV2Component.open(this.dialogService, {
    //   cipherId: this.formConfig.originalCipher?.id as CipherId,
    //   organizationId: this.formConfig.originalCipher?.organizationId as OrganizationId,
    // });
    // const result = await firstValueFrom(dialogRef.closed);
    // if (
    //   result.action === AttachmentDialogResult.Removed ||
    //   result.action === AttachmentDialogResult.Uploaded
    // ) {
    //   // Update the cipher form with the new attachments
    //   this.cipherFormComponent.patchCipher((currentCipher) => {
    //     currentCipher.attachments = result.cipher?.attachments;
    //     currentCipher.revisionDate = result.cipher?.revisionDate;
    //     return currentCipher;
    //   });
    //   this._cipherModified = true;
    // }
  }

  /**
   * Refresh the current cipher after an action like archive.
   * @private
   */
  private async refreshCurrentCipher() {
    // The cipher should be updated by the ItemFooter's archive action
    // We just need to mark it as modified
    this._cipherModified = true;
  }

  /**
   * Changes the mode of the drawer. When switching to Form mode, the form is initialized first then displayed once ready.
   * @param mode
   * @private
   */
  private async changeMode(mode: DrawerMode) {
    this.formReady = false;

    if (mode === "form") {
      this.loadForm = true;
      // Wait for the formReadySubject to emit before continuing.
      // This helps prevent flashing an empty dialog while the form is initializing.
      await firstValueFrom(this._formReadySubject);
    } else {
      this.loadForm = false;
    }

    this.mode = mode;
    this.updateTitle();
  }

  /**
   * Updates the title based on current mode and cipher type.
   * @private
   */
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
    let titleMode: "view" | "edit" | "new" = "view";

    if (this.mode === "form") {
      titleMode =
        this.formConfig.mode === "edit" || this.formConfig.mode === "partial-edit" ? "edit" : "new";
    }

    const fullTranslation = translation[titleMode][type];
    this.title = this.i18nService.t(fullTranslation);
  }

  /**
   * Opens the vault item drawer.
   * @param dialogService Instance of the DialogService.
   * @param params The parameters for the drawer.
   * @returns The drawer result.
   */
  static openDrawer(dialogService: DialogService, params: VaultItemDrawerParams) {
    return dialogService.openDrawer<VaultItemDrawerResult, VaultItemDrawerParams>(
      VaultItemDrawerComponent,
      {
        data: params,
      },
    );
  }
}
