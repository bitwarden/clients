// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Overlay } from "@angular/cdk/overlay";
import { CommonModule } from "@angular/common";
import { Component, Inject } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
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

import { PopupFooterComponent } from "../../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../platform/popup/layout/popup-page.component";

export interface BrowserSendGeneratorDialogParams {
  type: "password";
}

export interface BrowserSendGeneratorDialogResult {
  action: "selected" | "canceled";
  generatedValue?: string;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "tools-browser-send-generator-dialog",
  templateUrl: "./send-generator-dialog.component.html",
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
export class BrowserSendGeneratorDialogComponent {
  protected selectButtonText: string | undefined;

  /**
   * The currently generated value.
   * @protected
   */
  protected generatedValue: string = "";

  constructor(
    @Inject(DIALOG_DATA) protected params: BrowserSendGeneratorDialogParams,
    private dialogRef: DialogRef<BrowserSendGeneratorDialogResult>,
    private i18nService: I18nService,
  ) {}

  /**
   * Close the dialog without selecting a value.
   */
  protected close = () => {
    this.dialogRef.close({ action: "canceled" });
  };

  /**
   * Close the dialog and select the currently generated value.
   */
  protected selectValue = () => {
    this.dialogRef.close({
      action: "selected",
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
      this.selectButtonText = this.i18nService.t("useThisPassword");
    }
    this.generatedValue = undefined;
  };

  /**
   * Opens the send generator dialog in a full screen dialog (popup-page layout).
   */
  static open(
    dialogService: DialogService,
    overlay: Overlay,
    config: DialogConfig<BrowserSendGeneratorDialogParams>,
  ) {
    const position = overlay.position().global();

    return dialogService.open<BrowserSendGeneratorDialogResult, BrowserSendGeneratorDialogParams>(
      BrowserSendGeneratorDialogComponent,
      {
        ...config,
        positionStrategy: position,
        height: "100vh",
        width: "100vw",
      },
    );
  }
}
