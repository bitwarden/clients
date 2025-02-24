import { DIALOG_DATA } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { Component, Inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  ButtonModule,
  DialogModule,
  DialogService,
  ItemModule,
  LinkModule,
} from "@bitwarden/components";
import {
  CredentialGeneratorHistoryDialogComponent,
  GeneratorModule,
} from "@bitwarden/generator-components";
import { AlgorithmInfo } from "@bitwarden/generator-core";
import { CipherFormGeneratorComponent } from "@bitwarden/vault";

type CredentialGeneratorParams = {
  onCredentialGenerated: (value?: string) => void;
  type: "password" | "username";
};

@Component({
  standalone: true,
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
    private i18nService: I18nService,
  ) {}

  onAlgorithmSelected = (selected?: AlgorithmInfo) => {
    if (selected) {
      this.buttonLabel = selected.useGeneratedValue;
    } else {
      // clear the credential value when the user is
      // selecting the credential generation algorithm
      this.credentialValue = undefined;
    }
  };

  applyCredentials = () => {
    this.data.onCredentialGenerated(this.credentialValue);
  };

  clearCredentials = () => {
    this.data.onCredentialGenerated();
  };

  onCredentialGenerated = (value: string) => {
    this.credentialValue = value;
  };

  /**
   * Event handler for when the algorithm type changes.
   * This is necessary for the "forwarder" type because onAlgorithmSelected
   * doesn't fire when for this type as it also requires a forwarder service
   * to be selected before it can generate a value.
   */
  onTypeSelected = (type: string) => {
    this.buttonLabel = this.i18nService.t(
      type === '"username"' ? "useThisUsername" : "useThisEmail",
    );
    this.credentialValue = undefined;
  };

  openHistoryDialog = () => {
    // open history dialog
    this.dialogService.open(CredentialGeneratorHistoryDialogComponent);
  };

  static open = (dialogService: DialogService, data: CredentialGeneratorParams) => {
    dialogService.open(CredentialGeneratorDialogComponent, {
      data,
    });
  };
}
