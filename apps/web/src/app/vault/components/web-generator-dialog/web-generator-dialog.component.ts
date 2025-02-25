// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DIALOG_DATA, DialogConfig, DialogRef } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { Component, Inject } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ButtonModule, DialogModule, DialogService } from "@bitwarden/components";
import { AlgorithmInfo } from "@bitwarden/generator-core";
import { I18nPipe } from "@bitwarden/ui-common";
import { CipherFormGeneratorComponent } from "@bitwarden/vault";

export interface WebVaultGeneratorDialogParams {
  type: "password" | "username";
  uri?: string;
}

export interface WebVaultGeneratorDialogResult {
  action: WebVaultGeneratorDialogAction;
  generatedValue?: string;
}

export enum WebVaultGeneratorDialogAction {
  Selected = "selected",
  Canceled = "canceled",
}

@Component({
  selector: "web-vault-generator-dialog",
  templateUrl: "./web-generator-dialog.component.html",
  standalone: true,
  imports: [CommonModule, CipherFormGeneratorComponent, ButtonModule, DialogModule, I18nPipe],
})
export class WebVaultGeneratorDialogComponent {
  protected titleKey = this.isPassword ? "passwordGenerator" : "usernameGenerator";
  protected buttonLabel: string | undefined;

  /**
   * Whether the dialog is generating a password/passphrase. If false, it is generating a username.
   * @protected
   */
  protected get isPassword() {
    return this.params.type === "password";
  }

  /**
   * The currently generated value.
   * @protected
   */
  protected generatedValue: string = "";

  protected uri: string;

  constructor(
    @Inject(DIALOG_DATA) protected params: WebVaultGeneratorDialogParams,
    private dialogRef: DialogRef<WebVaultGeneratorDialogResult>,
    private i18nService: I18nService,
  ) {
    this.uri = params.uri;
  }

  /**
   * Close the dialog without selecting a value.
   */
  protected close = () => {
    this.dialogRef.close({ action: WebVaultGeneratorDialogAction.Canceled });
  };

  /**
   * Close the dialog and select the currently generated value.
   */
  protected selectValue = () => {
    this.dialogRef.close({
      action: WebVaultGeneratorDialogAction.Selected,
      generatedValue: this.generatedValue,
    });
  };

  onValueGenerated(value: string) {
    this.generatedValue = value;
  }

  onAlgorithmSelected = (selected?: AlgorithmInfo) => {
    if (selected) {
      this.buttonLabel = selected.useGeneratedValue;
    } else {
      // default to email
      this.buttonLabel = this.i18nService.t("useThisEmail");
    }
    this.generatedValue = undefined;
  };

  /**
   * Opens the vault generator dialog.
   */
  static open(dialogService: DialogService, config: DialogConfig<WebVaultGeneratorDialogParams>) {
    return dialogService.open<WebVaultGeneratorDialogResult, WebVaultGeneratorDialogParams>(
      WebVaultGeneratorDialogComponent,
      {
        ...config,
      },
    );
  }
}
