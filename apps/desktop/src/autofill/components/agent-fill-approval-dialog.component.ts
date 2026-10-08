import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";

import { CipherType } from "@bitwarden/common/vault/enums";
import {
  AsyncActionsModule,
  ButtonModule,
  CalloutModule,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  RadioButtonModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AgentFillApprovalRequest, AgentFillDenyReason } from "../models/agent-fill-approval";
import {
  AgentFillUserVerificationService,
  AgentFillVerificationResult,
} from "../services/agent-fill-user-verification.service";

/** An item the user may approve. Display fields only; no secrets. */
export type AgentFillApprovalItem = {
  id: string;
  name: string;
  /** Username for a login, or masked last digits for a card. */
  subtitle?: string;
};

export type AgentFillApprovalDialogParams = {
  request: AgentFillApprovalRequest;
  items: AgentFillApprovalItem[];
};

export type AgentFillApprovalDialogResult =
  { decision: "approved"; cipherId: string } | { decision: "denied"; reason?: AgentFillDenyReason };

/** What the dialog asks of the user to approve. */
const VerificationStep = Object.freeze({
  /** Touch ID is tried when the user presses Approve. */
  Biometrics: "biometrics",
  /** Touch ID did not pass or is unavailable, so the master password is needed. */
  MasterPassword: "master_password",
  /** Neither can verify this account, so Approve is refused. */
  Unavailable: "unavailable",
} as const);
type VerificationStep = (typeof VerificationStep)[keyof typeof VerificationStep];

/**
 * Asks the user to approve an AI agent filling an item from their vault into a browser tab. Every
 * approval needs fresh verification: Touch ID, falling back to the master password. If both fail
 * or the user cancels Touch ID, the dialog stays open.
 */
@Component({
  selector: "app-agent-fill-approval-dialog",
  templateUrl: "agent-fill-approval-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncActionsModule,
    ButtonModule,
    CalloutModule,
    DialogModule,
    FormFieldModule,
    I18nPipe,
    IconButtonModule,
    RadioButtonModule,
    ReactiveFormsModule,
    TypographyModule,
  ],
})
export class AgentFillApprovalDialogComponent {
  protected readonly params = inject<AgentFillApprovalDialogParams>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<AgentFillApprovalDialogResult>>(DialogRef);
  private readonly verificationService = inject(AgentFillUserVerificationService);

  protected readonly DenyReason = AgentFillDenyReason;
  protected readonly VerificationStep = VerificationStep;
  protected readonly messageKey =
    this.params.request.cipherType === CipherType.Card
      ? "agentFillApprovalCardMessage"
      : "agentFillApprovalLoginMessage";

  protected readonly step = signal<VerificationStep>(VerificationStep.Biometrics);
  /** An i18n key explaining why the last attempt did not verify the user. */
  protected readonly verificationError = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).group({
    cipherId: [this.params.items[0]?.id ?? null],
    masterPassword: [""],
    denyReason: [null as AgentFillDenyReason | null],
  });

  static open(dialogService: DialogService, params: AgentFillApprovalDialogParams) {
    return dialogService.open<AgentFillApprovalDialogResult, AgentFillApprovalDialogParams>(
      AgentFillApprovalDialogComponent,
      { data: params, disableClose: true },
    );
  }

  protected readonly approve = async () => {
    const cipherId = this.form.value.cipherId;
    if (cipherId == null || this.step() === VerificationStep.Unavailable) {
      return;
    }

    const result = await this.verificationService.verify(
      this.step() === VerificationStep.MasterPassword
        ? (this.form.value.masterPassword ?? "")
        : undefined,
    );

    switch (result) {
      case AgentFillVerificationResult.Verified:
        await this.dialogRef.close({ decision: "approved", cipherId });
        return;
      case AgentFillVerificationResult.NeedsMasterPassword:
        this.step.set(VerificationStep.MasterPassword);
        this.verificationError.set(null);
        return;
      case AgentFillVerificationResult.Unavailable:
        this.step.set(VerificationStep.Unavailable);
        this.verificationError.set(null);
        return;
      default:
        this.verificationError.set(
          this.step() === VerificationStep.MasterPassword
            ? "invalidMasterPassword"
            : "agentFillVerificationFailed",
        );
    }
  };

  protected readonly deny = async () => {
    await this.dialogRef.close({
      decision: "denied",
      reason: this.form.value.denyReason ?? undefined,
    });
  };
}
