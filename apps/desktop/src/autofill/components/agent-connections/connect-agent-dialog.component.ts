import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  AsyncActionsModule,
  ButtonModule,
  CalloutModule,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  CreatedAgentFillConnection,
  MAX_CONNECTION_NAME_LENGTH,
} from "../../models/agent-fill-connection";
import {
  AgentFillUserVerificationService,
  AgentFillVerificationResult,
} from "../../services/agent-fill-user-verification.service";

/** What the dialog is showing. */
const Stage = Object.freeze({
  /** The user names the connection and confirms with Touch ID. */
  Name: "name",
  /** Touch ID did not pass or is unavailable, so the master password is needed. */
  MasterPassword: "master_password",
  /** The new connection key, shown once. */
  Key: "key",
  /** Neither Touch ID nor a master password can verify this account. */
  Unavailable: "unavailable",
} as const);
type Stage = (typeof Stage)[keyof typeof Stage];

/**
 * Connects an agent: the user names the connection and confirms with Touch ID (falling back to the
 * master password), then the desktop app shows a new random connection key once, to paste into the
 * connector in Claude Desktop. The dialog closes with the saved connection.
 */
@Component({
  selector: "app-connect-agent-dialog",
  templateUrl: "connect-agent-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncActionsModule,
    ButtonModule,
    CalloutModule,
    DialogModule,
    FormFieldModule,
    I18nPipe,
    IconButtonModule,
    ReactiveFormsModule,
    TypographyModule,
  ],
})
export class ConnectAgentDialogComponent {
  private readonly dialogRef =
    inject<DialogRef<CreatedAgentFillConnection["connection"] | null>>(DialogRef);
  private readonly verificationService = inject(AgentFillUserVerificationService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);

  protected readonly Stage = Stage;
  protected readonly maxNameLength = MAX_CONNECTION_NAME_LENGTH;

  protected readonly stage = signal<Stage>(Stage.Name);
  /** An i18n key explaining why the last attempt did not verify the user. */
  protected readonly verificationError = signal<string | null>(null);
  protected readonly connectionKey = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).group({
    name: ["", [Validators.required, Validators.maxLength(MAX_CONNECTION_NAME_LENGTH)]],
    masterPassword: [""],
  });

  private readonly created = signal<CreatedAgentFillConnection["connection"] | null>(null);

  static open(dialogService: DialogService) {
    return dialogService.open<CreatedAgentFillConnection["connection"] | null>(
      ConnectAgentDialogComponent,
      { disableClose: true },
    );
  }

  protected readonly submit = async () => {
    if (this.stage() === Stage.Key || this.stage() === Stage.Unavailable) {
      return;
    }
    this.form.controls.name.markAsTouched();
    const name = (this.form.value.name ?? "").trim();
    if (name.length === 0 || this.form.controls.name.invalid) {
      return;
    }

    const result = await this.verificationService.verify(
      this.stage() === Stage.MasterPassword ? (this.form.value.masterPassword ?? "") : undefined,
    );

    switch (result) {
      case AgentFillVerificationResult.Verified: {
        const { connection, key } = await ipc.autofill.agentFill.connections.create(name);
        this.created.set(connection);
        this.connectionKey.set(key);
        this.verificationError.set(null);
        this.stage.set(Stage.Key);
        return;
      }
      case AgentFillVerificationResult.NeedsMasterPassword:
        this.stage.set(Stage.MasterPassword);
        this.verificationError.set(null);
        return;
      case AgentFillVerificationResult.Unavailable:
        this.stage.set(Stage.Unavailable);
        this.verificationError.set(null);
        return;
      default:
        this.verificationError.set(
          this.stage() === Stage.MasterPassword
            ? "invalidMasterPassword"
            : "agentFillVerificationFailed",
        );
    }
  };

  protected readonly copyKey = () => {
    const key = this.connectionKey();
    if (key == null) {
      return;
    }
    this.platformUtilsService.copyToClipboard(key);
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("valueCopied", this.i18nService.t("agentConnectionKey")),
    });
  };

  protected done() {
    // The key leaves this component's state with the dialog.
    this.connectionKey.set(null);
    void this.dialogRef.close(this.created());
  }

  protected cancel() {
    void this.dialogRef.close(null);
  }
}
