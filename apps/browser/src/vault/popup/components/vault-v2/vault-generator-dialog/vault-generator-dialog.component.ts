import { animate, group, style, transition, trigger } from "@angular/animations";
import { DIALOG_DATA, DialogConfig, DialogRef } from "@angular/cdk/dialog";
import { Overlay } from "@angular/cdk/overlay";
import { CommonModule } from "@angular/common";
import { Component, Inject } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ButtonModule, DialogService } from "@bitwarden/components";
import { CipherFormGeneratorComponent } from "@bitwarden/vault";

import { PopupFooterComponent } from "../../../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../../platform/popup/layout/popup-page.component";

export interface GeneratorDialogParams {
  type: "password" | "username";
}

export interface GeneratorDialogResult {
  action: GeneratorDialogAction;
  generatedValue?: string;
}

export enum GeneratorDialogAction {
  Selected = "selected",
  Canceled = "canceled",
}

const slideIn = trigger("slideIn", [
  transition(":enter", [
    style({ opacity: 0, transform: "translateY(100vh)" }),
    group([
      animate("0.15s linear", style({ opacity: 1 })),
      animate("0.3s ease-out", style({ transform: "none" })),
    ]),
  ]),
]);

@Component({
  selector: "app-vault-generator-dialog",
  templateUrl: "./vault-generator-dialog.component.html",
  standalone: true,
  imports: [
    PopupPageComponent,
    PopupHeaderComponent,
    PopupFooterComponent,
    CommonModule,
    CipherFormGeneratorComponent,
    ButtonModule,
  ],
  animations: [slideIn],
})
export class VaultGeneratorDialogComponent {
  protected title = this.i18nService.t(this.isPassword ? "passwordGenerator" : "usernameGenerator");
  protected selectButtonText = this.i18nService.t(
    this.isPassword ? "useThisPassword" : "useThisUsername",
  );

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

  constructor(
    @Inject(DIALOG_DATA) protected params: GeneratorDialogParams,
    private dialogRef: DialogRef<GeneratorDialogResult>,
    private i18nService: I18nService,
  ) {}

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
