// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Overlay } from "@angular/cdk/overlay";
import { CommonModule } from "@angular/common";
import { Component, Inject } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  ButtonModule,
  DialogService,
} from "@bitwarden/components";
import { AlgorithmInfo } from "@bitwarden/generator-core";
import { I18nPipe } from "@bitwarden/ui-common";
import { CipherFormGeneratorComponent } from "@bitwarden/vault";

import { PopupFooterComponent } from "../../../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../../platform/popup/layout/popup-page.component";

export interface GeneratorDialogParams {
  type: "password" | "username";
  uri?: string;
}

export interface GeneratorDialogResult {
  action: GeneratorDialogAction;
  generatedValue?: string;
}

export const GeneratorDialogAction = {
  Selected: "selected",
  Canceled: "canceled",
} as const;

type GeneratorDialogAction = UnionOfValues<typeof GeneratorDialogAction>;

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-vault-generator-dialog",
  templateUrl: "./vault-generator-dialog.component.html",
  imports: [
    PopupPageComponent,
    PopupHeaderComponent,
    PopupFooterComponent,
    CommonModule,
    CipherFormGeneratorComponent,
    ButtonModule,
    I18nPipe,
  ],
})
export class VaultGeneratorDialogComponent {
  protected selectButtonText: string | undefined;
  protected titleKey = this.isPassword ? "passwordGenerator" : "usernameGenerator";

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
    @Inject(DIALOG_DATA) protected params: GeneratorDialogParams,
    private dialogRef: DialogRef<GeneratorDialogResult>,
    private i18nService: I18nService,
  ) {
    this.uri = params.uri;
  }

  /**
   * Close the dialog without selecting a value.
   */
  protected close = () => {
    this.dialogRef.close({ action: GeneratorDialogAction.Canceled });
  };

  /**
   * Close the dialog and select the currently generated value.
   */
  protected selectValue = () => {
    this.dialogRef.close({
      action: GeneratorDialogAction.Selected,
      generatedValue: this.generatedValue,
    });
  };

  onValueGenerated(value: string) {
    this.generatedValue = value;
  }

  onAlgorithmSelected = (selected?: AlgorithmInfo) => {
    if (selected) {
      this.selectButtonText = selected.useGeneratedValue;
    } else {
      // default to email
      this.selectButtonText = this.i18nService.t("useThisEmail");
    }
    this.generatedValue = undefined;
  };

  /**
   * Opens the vault generator dialog in a full screen dialog.
   */
  static open(
    dialogService: DialogService,
    overlay: Overlay,
    config: DialogConfig<GeneratorDialogParams>,
  ) {
    const position = overlay.position().global();

    return dialogService.open<GeneratorDialogResult, GeneratorDialogParams>(
      VaultGeneratorDialogComponent,
      {
        ...config,
        positionStrategy: position,
        height: "100vh",
        width: "100vw",
      },
    );
  }
}
