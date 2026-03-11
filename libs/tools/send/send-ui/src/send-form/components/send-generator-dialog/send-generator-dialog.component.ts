import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Inject } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import { DIALOG_DATA, DialogRef, ButtonModule, DialogModule } from "@bitwarden/components";
import { AlgorithmInfo } from "@bitwarden/generator-core";
import { I18nPipe } from "@bitwarden/ui-common";
import { CipherFormGeneratorComponent } from "@bitwarden/vault";

export interface SendGeneratorDialogParams {
  type: "password" | "username";
  uri?: string;
}

export interface SendGeneratorDialogResult {
  action: SendGeneratorDialogAction;
  generatedValue?: string;
}

export const SendGeneratorDialogAction = {
  Selected: "selected",
  Canceled: "canceled",
} as const;

export type SendGeneratorDialogAction = UnionOfValues<typeof SendGeneratorDialogAction>;

@Component({
  selector: "tools-send-generator-dialog",
  templateUrl: "./send-generator-dialog.component.html",
  standalone: true,
  imports: [CommonModule, CipherFormGeneratorComponent, ButtonModule, DialogModule, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendGeneratorDialogComponent {
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

  protected uri: string | undefined;

  constructor(
    @Inject(DIALOG_DATA) protected params: SendGeneratorDialogParams,
    private dialogRef: DialogRef<SendGeneratorDialogResult>,
    private i18nService: I18nService,
  ) {
    this.uri = params.uri;
  }

  protected close = () => {
    this.dialogRef.close({ action: SendGeneratorDialogAction.Canceled });
  };

  protected selectValue = () => {
    this.dialogRef.close({
      action: SendGeneratorDialogAction.Selected,
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
      this.buttonLabel = this.i18nService.t("useThisEmail");
    }
    this.generatedValue = "";
  };
}
