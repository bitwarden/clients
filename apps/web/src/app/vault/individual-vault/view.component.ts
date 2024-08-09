import { DIALOG_DATA, DialogConfig, DialogRef } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { Component, Inject, OnInit, EventEmitter, OnDestroy } from "@angular/core";
import { Router } from "@angular/router";
import { Subject } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  AsyncActionsModule,
  DialogModule,
  DialogService,
  ToastService,
} from "@bitwarden/components";

import { CipherViewComponent } from "../../../../../../libs/vault/src/cipher-view/cipher-view.component";
import { SharedModule } from "../../shared/shared.module";

export interface ViewCipherDialogParams {
  cipher: CipherView;
  cipherTypeString: string;
}

export enum ViewCipherDialogResult {
  edited = "edited",
  deleted = "deleted",
}

export interface ViewCipherDialogCloseResult {
  action: ViewCipherDialogResult;
}

@Component({
  selector: "app-vault-view",
  templateUrl: "view.component.html",
  standalone: true,
  imports: [CipherViewComponent, CommonModule, AsyncActionsModule, DialogModule, SharedModule],
})
export class ViewComponent implements OnInit, OnDestroy {
  cipher: CipherView;
  deletePromise: Promise<void>;
  onDeletedCipher = new EventEmitter<CipherView>();
  cipherTypeString: string;
  cipherEditUrl: string;
  organization: Organization;
  flexibleCollectionsV1Enabled = false;
  restrictProviderAccess = false;

  protected destroy$ = new Subject<void>();

  constructor(
    @Inject(DIALOG_DATA) public params: ViewCipherDialogParams,
    private dialogRef: DialogRef<ViewCipherDialogCloseResult>,
    private i18nService: I18nService,
    private dialogService: DialogService,
    private messagingService: MessagingService,
    private logService: LogService,
    private cipherService: CipherService,
    private toastService: ToastService,
    private organizationService: OrganizationService,
    private router: Router,
  ) {}

  async ngOnInit() {
    this.cipher = this.params.cipher;
    this.cipherTypeString = this.params.cipherTypeString;
    if (this.cipher.organizationId) {
      this.organization = await this.organizationService.get(this.cipher.organizationId);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async delete(): Promise<void> {
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
      this.deletePromise = this.deleteCipher();
      await this.deletePromise;
      this.toastService.showToast({
        variant: "success",
        title: this.i18nService.t("success"),
        message: this.i18nService.t(
          this.cipher.isDeleted ? "permanentlyDeletedItem" : "deletedItem",
        ),
      });
      this.onDeletedCipher.emit(this.cipher);
      this.messagingService.send(
        this.cipher.isDeleted ? "permanentlyDeletedCipher" : "deletedCipher",
      );
    } catch (e) {
      this.logService.error(e);
    }

    this.dialogRef.close({ action: ViewCipherDialogResult.deleted });
  }

  protected async deleteCipher(): Promise<void> {
    const asAdmin = this.organization?.canEditAllCiphers(
      this.flexibleCollectionsV1Enabled,
      this.restrictProviderAccess,
    );
    if (this.cipher.isDeleted) {
      await this.cipherService.deleteWithServer(this.cipher.id, asAdmin);
    } else {
      await this.cipherService.softDeleteWithServer(this.cipher.id, asAdmin);
    }
  }

  async edit(): Promise<boolean> {
    this.dialogRef.close({ action: ViewCipherDialogResult.edited });
    await this.router.navigate([], {
      queryParams: {
        itemId: this.cipher.id,
        action: "edit",
        organizationId: this.cipher.organizationId,
      },
    });
    return true;
  }

  static getCipherViewTypeString(cipher: CipherView, i18nService: I18nService): string {
    if (!cipher) {
      return null;
    }

    const type = cipher.type;
    switch (type) {
      case CipherType.Login:
        return i18nService.t("viewItemType", "login");
      case CipherType.SecureNote:
        return i18nService.t("viewItemType", "note");
      case CipherType.Card:
        return i18nService.t("viewItemType", "card");
      case CipherType.Identity:
        return i18nService.t("viewItemType", "identity");
      default:
        return null;
    }
  }
}

/**
 * Strongly typed helper to open a cipher view dialog
 * @param dialogService Instance of the dialog service that will be used to open the dialog
 * @param data Data to be passed to the dialog
 */
export function openViewCipherDialog(
  dialogService: DialogService,
  config: DialogConfig<ViewCipherDialogParams>,
): DialogRef<ViewCipherDialogCloseResult> {
  return dialogService.open(ViewComponent, config);
}
