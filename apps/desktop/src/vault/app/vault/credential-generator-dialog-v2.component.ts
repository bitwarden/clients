import { BasePortalOutlet } from "@angular/cdk/portal";
import { CommonModule } from "@angular/common";
import { Component, Inject } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  ButtonModule,
  DialogModule,
  DialogService,
} from "@bitwarden/components";
import { AlgorithmInfo } from "@bitwarden/generator-core";
import { I18nPipe } from "@bitwarden/ui-common";
import { CipherFormGeneratorComponent } from "@bitwarden/vault";

export interface CredentialGeneratorDialogParams {
  type: "password" | "username";
  uri?: string;
}

export interface CredentialGeneratorDialogResult {
  action: CredentialGeneratorDialogAction;
  generatedValue?: string;
}

export enum CredentialGeneratorDialogAction {
  Selected = "selected",
  Canceled = "canceled",
}

@Component({
  selector: "credential-generator-dialog",
  templateUrl: "credential-generator-dialog-v2.component.html",
  standalone: true,
  imports: [CommonModule, CipherFormGeneratorComponent, ButtonModule, DialogModule, I18nPipe],
})
export class CredentialGeneratorDialogComponent {
  protected titleKey = this.isPassword ? "passwordGenerator" : "usernameGenerator";
  protected buttonLabel: string | undefined;

  protected get isPassword() {
    return this.params.type === "password";
  }

  protected generatedValue: string | undefined = "";

  protected uri: string | undefined = undefined;

  constructor(
    @Inject(DIALOG_DATA) protected params: CredentialGeneratorDialogParams,
    private dialogRef: DialogRef<CredentialGeneratorDialogResult>,
    private i18nService: I18nService,
  ) {
    this.uri = params.uri;
  }

  protected close = () => {
    this.dialogRef.close({ action: CredentialGeneratorDialogAction.Canceled });
  };

  /**
   * Close the dialog and select the currently generated value.
   */
  protected selectValue = () => {
    this.dialogRef.close({
      action: CredentialGeneratorDialogAction.Selected,
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

  static open(
    dialogService: DialogService,
    config: DialogConfig<
      CredentialGeneratorDialogParams,
      DialogRef<CredentialGeneratorDialogResult, unknown>,
      BasePortalOutlet
    >,
  ) {
    return dialogService.open<CredentialGeneratorDialogResult, CredentialGeneratorDialogParams>(
      CredentialGeneratorDialogComponent,
      {
        ...config,
      },
    );
  }
}
