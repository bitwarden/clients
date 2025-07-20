import { CommonModule } from "@angular/common";
import { Component, Inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import {
  DIALOG_DATA,
  ButtonModule,
  DialogModule,
  DialogService,
  ItemModule,
  LinkModule,
  DialogRef,
} from "@bitwarden/components";
import {
  CredentialGeneratorHistoryDialogComponent,
  GeneratorModule,
} from "@bitwarden/generator-components";
import { AlgorithmInfo } from "@bitwarden/generator-core";
import { CipherFormGeneratorComponent } from "@bitwarden/vault";

type CredentialGeneratorParams = {
  /** @deprecated Prefer use of dialogRef.closed to retreive the generated value */
  onCredentialGenerated?: (value?: string) => void;
  type: "password" | "username";
  uri?: string;
};

export interface CredentialGeneratorDialogResult {
  action: CredentialGeneratorDialogAction;
  generatedValue?: string;
}

export const CredentialGeneratorDialogAction = {
  Selected: "selected",
  Canceled: "canceled",
} as const;

type CredentialGeneratorDialogAction = UnionOfValues<typeof CredentialGeneratorDialogAction>;

@Component({
  selector: "credential-generator-dialog",
  templateUrl: "credential-generator-dialog.component.html",
  imports: [
    CipherFormGeneratorComponent,
    CommonModule,
    DialogModule,
    ButtonModule,
    JslibModule,
    GeneratorModule,
    ItemModule,
    LinkModule,
  ],
})
export class CredentialGeneratorDialogComponent {
  credentialValue?: string;
  buttonLabel?: string;

  constructor(
    @Inject(DIALOG_DATA) protected data: CredentialGeneratorParams,
    private dialogService: DialogService,
    private dialogRef: DialogRef<CredentialGeneratorDialogResult>,
    private i18nService: I18nService,
  ) {}

  onAlgorithmSelected = (selected?: AlgorithmInfo) => {
    if (selected) {
      this.buttonLabel = selected.useGeneratedValue;
    } else {
      // default to email
      this.buttonLabel = this.i18nService.t("useThisEmail");
    }
    this.credentialValue = undefined;
  };

  applyCredentials = () => {
    this.data.onCredentialGenerated?.(this.credentialValue);
    this.dialogRef.close({
      action: CredentialGeneratorDialogAction.Selected,
      generatedValue: this.credentialValue,
    });
  };

  clearCredentials = () => {
    this.data.onCredentialGenerated?.();
  };

  onCredentialGenerated = (value: string) => {
    this.credentialValue = value;
  };

  openHistoryDialog = () => {
    // open history dialog
    this.dialogService.open(CredentialGeneratorHistoryDialogComponent);
  };

  static open(dialogService: DialogService, data: CredentialGeneratorParams) {
    return dialogService.open<CredentialGeneratorDialogResult, CredentialGeneratorParams>(
      CredentialGeneratorDialogComponent,
      {
        data,
      },
    );
  }
}
