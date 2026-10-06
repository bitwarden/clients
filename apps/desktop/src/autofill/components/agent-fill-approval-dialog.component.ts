import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";

import { CipherType } from "@bitwarden/common/vault/enums";
import {
  AsyncActionsModule,
  ButtonModule,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  RadioButtonModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AgentFillApprovalRequest, AgentFillDenyReason } from "../models/agent-fill-approval";

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

/**
 * PROTOTYPE: agent autofill. Asks the user to approve an AI agent filling an item from their vault
 * into a browser tab.
 */
@Component({
  selector: "app-agent-fill-approval-dialog",
  templateUrl: "agent-fill-approval-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncActionsModule,
    ButtonModule,
    DialogModule,
    FormFieldModule,
    I18nPipe,
    RadioButtonModule,
    ReactiveFormsModule,
    TypographyModule,
  ],
})
export class AgentFillApprovalDialogComponent {
  protected readonly params = inject<AgentFillApprovalDialogParams>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<AgentFillApprovalDialogResult>>(DialogRef);

  protected readonly DenyReason = AgentFillDenyReason;
  protected readonly messageKey =
    this.params.request.cipherType === CipherType.Card
      ? "agentFillApprovalCardMessage"
      : "agentFillApprovalLoginMessage";

  protected readonly form = inject(FormBuilder).group({
    cipherId: [this.params.items[0]?.id ?? null],
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
    if (cipherId == null) {
      return;
    }
    await this.dialogRef.close({ decision: "approved", cipherId });
  };

  protected readonly deny = async () => {
    await this.dialogRef.close({
      decision: "denied",
      reason: this.form.value.denyReason ?? undefined,
    });
  };
}
