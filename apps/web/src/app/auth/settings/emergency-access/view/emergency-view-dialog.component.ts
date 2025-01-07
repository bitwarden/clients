import { DIALOG_DATA, DialogRef } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { Component, Inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { ViewPasswordHistoryService } from "@bitwarden/common/vault/abstractions/view-password-history.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { ButtonModule, DialogModule, DialogService } from "@bitwarden/components";
import { CipherViewComponent } from "@bitwarden/vault";

import { WebViewPasswordHistoryService } from "../../../../vault/services/web-view-password-history.service";

export interface EmergencyViewDialogParams {
  /** The cipher being viewed. */
  cipher: CipherView;
}

/** Stubbed class, premium upgrade is not applicable for emergency viewing */
class PremiumUpgradePromptNoop implements PremiumUpgradePromptService {
  async promptForPremium() {
    return Promise.resolve();
  }
}

@Component({
  selector: "app-emergency-view-dialog",
  templateUrl: "emergency-view-dialog.component.html",
  standalone: true,
  imports: [ButtonModule, CipherViewComponent, DialogModule, CommonModule, JslibModule],
  providers: [
    { provide: ViewPasswordHistoryService, useClass: WebViewPasswordHistoryService },
    { provide: PremiumUpgradePromptService, useClass: PremiumUpgradePromptNoop },
  ],
})
export class EmergencyViewDialogComponent {
  /**
   * The title of the dialog. Updates based on the cipher type.
   * @protected
   */
  protected title: string = "";

  constructor(
    @Inject(DIALOG_DATA) protected params: EmergencyViewDialogParams,
    private dialogRef: DialogRef,
    private i18nService: I18nService,
  ) {
    this.updateTitle();
  }

  get cipher(): CipherView {
    return this.params.cipher;
  }

  cancel = () => {
    this.dialogRef.close();
  };

  private updateTitle() {
    const partOne = "viewItemType";

    const type = this.cipher.type;

    switch (type) {
      case CipherType.Login:
        this.title = this.i18nService.t(partOne, this.i18nService.t("typeLogin").toLowerCase());
        break;
      case CipherType.Card:
        this.title = this.i18nService.t(partOne, this.i18nService.t("typeCard").toLowerCase());
        break;
      case CipherType.Identity:
        this.title = this.i18nService.t(partOne, this.i18nService.t("typeIdentity").toLowerCase());
        break;
      case CipherType.SecureNote:
        this.title = this.i18nService.t(partOne, this.i18nService.t("note").toLowerCase());
        break;
    }
  }

  /**
   * Opens the EmergencyViewDialog.
   */
  static open(dialogService: DialogService, params: EmergencyViewDialogParams) {
    return dialogService.open<EmergencyViewDialogParams>(EmergencyViewDialogComponent, {
      data: params,
    });
  }
}
