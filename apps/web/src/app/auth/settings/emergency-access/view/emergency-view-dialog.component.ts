import { CommonModule } from "@angular/common";
import { Component, Inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { VaultViewPasswordHistoryService } from "@bitwarden/angular/services/view-password-history.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { EmergencyAccessId } from "@bitwarden/common/types/guid";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { ViewPasswordHistoryService } from "@bitwarden/common/vault/abstractions/view-password-history.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  DIALOG_DATA,
  DialogRef,
  ButtonModule,
  DialogModule,
  DialogService,
} from "@bitwarden/components";
import {
  ChangeLoginPasswordService,
  CipherViewComponent,
  DefaultChangeLoginPasswordService,
} from "@bitwarden/vault";

export interface EmergencyViewDialogParams {
  /** The cipher being viewed. */
  cipher: CipherView;
  emergencyAccessId: EmergencyAccessId;
}

/** Stubbed class, premium upgrade is not applicable for emergency viewing */
class PremiumUpgradePromptNoop implements PremiumUpgradePromptService {
  async promptForPremium() {
    return Promise.resolve();
  }
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-emergency-view-dialog",
  templateUrl: "emergency-view-dialog.component.html",
  imports: [ButtonModule, CipherViewComponent, DialogModule, CommonModule, JslibModule],
  providers: [
    { provide: ViewPasswordHistoryService, useClass: VaultViewPasswordHistoryService },
    { provide: PremiumUpgradePromptService, useClass: PremiumUpgradePromptNoop },
    { provide: ChangeLoginPasswordService, useClass: DefaultChangeLoginPasswordService },
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

  get emergencyAccessId(): EmergencyAccessId {
    return this.params.emergencyAccessId;
  }

  cancel = () => {
    this.dialogRef.close();
  };

  private updateTitle() {
    const type = this.cipher.type;

    switch (type) {
      case CipherType.Login:
        this.title = this.i18nService.t("viewItemHeaderLogin");
        break;
      case CipherType.Card:
        this.title = this.i18nService.t("viewItemHeaderCard");
        break;
      case CipherType.Identity:
        this.title = this.i18nService.t("viewItemHeaderIdentity");
        break;
      case CipherType.SecureNote:
        this.title = this.i18nService.t("viewItemHeaderNote");
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
