// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  AsyncActionsModule,
  DialogModule,
  DialogService,
  ItemModule,
} from "@bitwarden/components";
import {
  AttachmentsV2Component,
  CipherAttachmentsComponent,
  CipherFormConfig,
  CipherFormGenerationService,
  CipherFormMode,
  CipherFormModule,
} from "@bitwarden/vault";

import { SharedModule } from "../../shared/shared.module";
import { WebCipherFormGenerationService } from "../services/web-cipher-form-generation.service";

/**
 * The result of the AddEditCipherDialogV2 component.
 */
export const AddEditCipherDialogResult = {
  Edited: "edited",
  Added: "added",
  Canceled: "canceled",
} as const;

type AddEditCipherDialogResult = UnionOfValues<typeof AddEditCipherDialogResult>;

/**
 * The close result of the AddEditCipherDialogV2 component.
 */
export interface AddEditCipherDialogCloseResult {
  /**
   * The action that was taken.
   */
  action: AddEditCipherDialogResult;
  /**
   * The ID of the cipher that was edited or added.
   */
  id?: CipherId;
}

/**
 * Component for viewing a cipher, presented in a dialog.
 * @deprecated Use the VaultItemDialogComponent instead.
 */
@Component({
  selector: "app-vault-add-edit-v2",
  templateUrl: "add-edit-v2.component.html",
  imports: [
    CommonModule,
    AsyncActionsModule,
    DialogModule,
    SharedModule,
    CipherFormModule,
    CipherAttachmentsComponent,
    ItemModule,
  ],
  providers: [{ provide: CipherFormGenerationService, useClass: WebCipherFormGenerationService }],
})
export class AddEditComponentV2 implements OnInit {
  config: CipherFormConfig;
  headerText: string;
  canAccessAttachments: boolean = false;

  /**
   * Constructor for the AddEditComponentV2 component.
   * @param params The parameters for the component.
   * @param dialogRef The reference to the dialog.
   * @param i18nService The internationalization service.
   * @param dialogService The dialog service.
   * @param billingAccountProfileStateService The billing account profile state service.
   */
  constructor(
    @Inject(DIALOG_DATA) public params: CipherFormConfig,
    private dialogRef: DialogRef<AddEditCipherDialogCloseResult>,
    private i18nService: I18nService,
    private dialogService: DialogService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private accountService: AccountService,
  ) {
    this.accountService.activeAccount$
      .pipe(
        switchMap((account) =>
          this.billingAccountProfileStateService.hasPremiumFromAnySource$(account.id),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((canAccessPremium: boolean) => {
        this.canAccessAttachments = canAccessPremium;
      });
  }

  /**
   * Lifecycle hook for component initialization.
   */
  async ngOnInit() {
    this.config = this.params;
    this.headerText = this.setHeader(this.config?.mode, this.config.cipherType);
  }

  /**
   * Getter to check if the component is loading.
   */
  get loading() {
    return this.config == null;
  }

  /**
   * Method to handle cancel action. Called when a user clicks the cancel button.
   */
  async cancel() {
    this.dialogRef.close({ action: AddEditCipherDialogResult.Canceled });
  }

  /**
   * Sets the header text based on the mode and type of the cipher.
   * @param mode The form mode.
   * @param type The cipher type.
   * @returns The header text.
   */
  setHeader(mode: CipherFormMode, type: CipherType) {
    const partOne = mode === "edit" || mode === "partial-edit" ? "editItemHeader" : "newItemHeader";
    switch (type) {
      case CipherType.Login:
        return this.i18nService.t(partOne, this.i18nService.t("typeLogin").toLowerCase());
      case CipherType.Card:
        return this.i18nService.t(partOne, this.i18nService.t("typeCard").toLowerCase());
      case CipherType.Identity:
        return this.i18nService.t(partOne, this.i18nService.t("typeIdentity").toLowerCase());
      case CipherType.SecureNote:
        return this.i18nService.t(partOne, this.i18nService.t("note").toLowerCase());
      case CipherType.SshKey:
        return this.i18nService.t(partOne, this.i18nService.t("typeSshKey").toLowerCase());
    }
  }

  /**
   * Opens the attachments dialog.
   */
  async openAttachmentsDialog() {
    this.dialogService.open<
      AttachmentsV2Component,
      { cipherId: CipherId; organizationId?: OrganizationId }
    >(AttachmentsV2Component, {
      data: {
        cipherId: this.config.originalCipher?.id as CipherId,
        organizationId: this.config.originalCipher?.organizationId as OrganizationId,
      },
    });
  }

  /**
   * Handles the event when a cipher is saved.
   * @param cipherView The cipher view that was saved.
   */
  async onCipherSaved(cipherView: CipherView) {
    this.dialogRef.close({
      action:
        this.config.mode === "add"
          ? AddEditCipherDialogResult.Added
          : AddEditCipherDialogResult.Edited,
      id: cipherView.id as CipherId,
    });
  }
}

/**
 * Strongly typed helper to open a cipher add/edit dialog
 * @param dialogService Instance of the dialog service that will be used to open the dialog
 * @param config Configuration for the dialog
 * @returns A reference to the opened dialog
 */
export function openAddEditCipherDialog(
  dialogService: DialogService,
  config: DialogConfig<CipherFormConfig>,
): DialogRef<AddEditCipherDialogCloseResult> {
  return dialogService.open(AddEditComponentV2, config);
}
