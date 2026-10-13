import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Inject, signal } from "@angular/core";

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
  protected readonly titleKey = this.isPassword ? "passwordGenerator" : "usernameGenerator";
  protected readonly buttonLabel = signal<string | undefined>(undefined);

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

  protected readonly generatedValue = signal<string>("");

  protected readonly uri: string | undefined;

  constructor(
    @Inject(DIALOG_DATA) protected readonly params: SendGeneratorDialogParams,
    private readonly dialogRef: DialogRef<SendGeneratorDialogResult>,
    private readonly i18nService: I18nService,
  ) {
    this.uri = params.uri;
  }

  protected readonly close = () => {
    void this.dialogRef.close({ action: SendGeneratorDialogAction.Canceled });
  };

  protected readonly selectValue = () => {
    void this.dialogRef.close({
      action: SendGeneratorDialogAction.Selected,
      generatedValue: this.generatedValue(),
    });
  };

  readonly onValueGenerated = (value: string) => {
    this.generatedValue.set(value);
  };

  readonly onAlgorithmSelected = (selected?: AlgorithmInfo) => {
    if (selected) {
      this.buttonLabel.set(selected.useGeneratedValue);
    } else {
      this.buttonLabel.set(this.i18nService.t("useThisEmail"));
    }
    this.generatedValue.set("");
  };
}
