import { inject, Injectable, OnDestroy } from "@angular/core";
import { concatMap, filter, firstValueFrom, Subject, take, takeUntil } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { AgentFillFailureReason } from "@bitwarden/common/autofill/agent-fill/agent-fill-ipc";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CommandDefinition, MessageListener } from "@bitwarden/common/platform/messaging";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";

import {
  AgentFillApprovalDialogComponent,
  AgentFillApprovalItem,
} from "../components/agent-fill-approval-dialog.component";
import { AgentFillApprovalRequest, AgentFillApprovalResponse } from "../models/agent-fill-approval";
import { AGENT_FILL_IPC_CHANNELS } from "../models/ipc-channels";

const APPROVAL_REQUEST = new CommandDefinition<AgentFillApprovalRequest>(
  AGENT_FILL_IPC_CHANNELS.APPROVAL_REQUEST,
);
const APPROVAL_CANCEL = new CommandDefinition<{ requestId: string }>(
  AGENT_FILL_IPC_CHANNELS.APPROVAL_CANCEL,
);

/**
 * PROTOTYPE: agent autofill with approval.
 *
 * Renderer half of the approval: matches items in the desktop app's own vault against the tab's
 * domain, shows the approval dialog, and answers the main process with the decision and display
 * fields only (item name, username or card last four).
 */
@Injectable({ providedIn: "root" })
export class AgentFillService implements OnDestroy {
  private readonly messageListener = inject(MessageListener);
  private readonly accountService = inject(AccountService);
  private readonly authService = inject(AuthService);
  private readonly cipherService = inject(CipherService);
  private readonly dialogService = inject(DialogService);
  private readonly logService = inject(LogService);

  private readonly destroy$ = new Subject<void>();

  init() {
    this.messageListener
      .messages$(APPROVAL_REQUEST)
      .pipe(
        concatMap(async (request) => {
          let response: AgentFillApprovalResponse;
          try {
            response = await this.handle(request);
          } catch (e) {
            this.logService.error("[AgentFill] Approval failed", e);
            response = {
              decision: "failed",
              reason: AgentFillFailureReason.Error,
              message: "The desktop app hit an error.",
            };
          }
          await ipc.autofill.agentFill.approvalResponse(request.requestId, response);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async handle(request: AgentFillApprovalRequest): Promise<AgentFillApprovalResponse> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getOptionalUserId));
    const status =
      userId != null ? await firstValueFrom(this.authService.authStatusFor$(userId)) : null;
    if (userId == null || status !== AuthenticationStatus.Unlocked) {
      return {
        decision: "failed",
        reason: AgentFillFailureReason.Locked,
        message: "The Bitwarden desktop app is locked.",
      };
    }

    const ciphers = await this.matchingCiphers(request, userId);
    if (ciphers.length === 0) {
      return {
        decision: "failed",
        reason: AgentFillFailureReason.NoMatchingItem,
        message:
          request.cipherType === CipherType.Card
            ? "No card in the vault."
            : "No login in the vault matches this site.",
      };
    }

    ipc.platform.focusWindow();
    const dialogRef = AgentFillApprovalDialogComponent.open(this.dialogService, {
      request,
      items: ciphers.map(toApprovalItem),
    });

    // The main process cancels the dialog when the request expires.
    const cancelled = this.messageListener
      .messages$(APPROVAL_CANCEL)
      .pipe(
        filter((m) => m.requestId === request.requestId),
        take(1),
        takeUntil(dialogRef.closed),
      )
      .subscribe(() => dialogRef.close());

    const result = await firstValueFrom(dialogRef.closed);
    cancelled.unsubscribe();

    if (result?.decision !== "approved") {
      return { decision: "denied", reason: result?.reason };
    }

    const chosen = ciphers.find((c) => c.id === result.cipherId);
    if (chosen == null) {
      return {
        decision: "failed",
        reason: AgentFillFailureReason.NoMatchingItem,
        message: "The chosen item is no longer available.",
      };
    }

    return {
      decision: "approved",
      cipherId: chosen.id,
      itemName: chosen.name,
      username: chosen.type === CipherType.Login ? chosen.login.username : undefined,
      lastFour: chosen.type === CipherType.Card ? chosen.card.number?.slice(-4) : undefined,
    };
  }

  private async matchingCiphers(
    request: AgentFillApprovalRequest,
    userId: UserId,
  ): Promise<CipherView[]> {
    const candidates =
      request.cipherType === CipherType.Login
        ? await this.cipherService.getAllDecryptedForUrl(request.tabUrl, userId)
        : await this.cipherService.getAllDecrypted(userId);

    return candidates.filter(
      (c) =>
        c.type === request.cipherType &&
        !c.isDeleted &&
        !c.isArchived &&
        // The extension refuses re-prompt items for agents, so do not offer them.
        c.reprompt === CipherRepromptType.None,
    );
  }
}

function toApprovalItem(cipher: CipherView): AgentFillApprovalItem {
  return {
    id: cipher.id,
    name: cipher.name,
    subtitle: cipher.type === CipherType.Card ? cipher.card.subTitle : cipher.login.username,
  };
}
