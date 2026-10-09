import { inject, Injectable, OnDestroy } from "@angular/core";
import {
  concatMap,
  concatWith,
  filter,
  firstValueFrom,
  map,
  merge,
  NEVER,
  race,
  Subject,
  take,
  takeUntil,
  tap,
} from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { AgentFillFailureReason } from "@bitwarden/common/autofill/agent-fill/agent-fill-ipc";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  asUuid,
  SdkService,
  uuidAsString,
} from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CommandDefinition, MessageListener } from "@bitwarden/common/platform/messaging";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";
import {
  AgentFillApprovalClient,
  AgentFillApprovalId,
  ApprovalDecision,
  CipherId,
  isAgentFillApprovalError,
  PendingApproval,
} from "@bitwarden/sdk-internal";

import {
  AgentFillApprovalAnswer,
  AgentFillApprovalDialogComponent,
  AgentFillApprovalDialogResult,
  AgentFillApprovalItem,
} from "../components/agent-fill-approval-dialog.component";
import {
  AgentFillApprovalRequest,
  AgentFillApprovalResponse,
  AgentFillDenyReason,
} from "../models/agent-fill-approval";
import { AgentFillApprovalRecord } from "../models/agent-fill-approval-record";
import { AGENT_FILL_IPC_CHANNELS } from "../models/ipc-channels";

import { AgentFillApprovalApiService } from "./agent-fill-approval-api.service";

const APPROVAL_REQUEST = new CommandDefinition<AgentFillApprovalRequest>(
  AGENT_FILL_IPC_CHANNELS.APPROVAL_REQUEST,
);
const APPROVAL_CANCEL = new CommandDefinition<{ requestId: string }>(
  AGENT_FILL_IPC_CHANNELS.APPROVAL_CANCEL,
);

const AGENT_FILL_APPROVAL_ANSWERED = new CommandDefinition<{ approvalId: string }>(
  "agentFillApprovalAnswered",
);
const SYNC_COMPLETED = new CommandDefinition<{ successfully: boolean }>("syncCompleted");

/** The server's record of this fill, kept until the request ends. */
type ServerRequest = { id: string; pending: PendingApproval | null };

/** How a request ended, before it is mapped to the answer the main process expects. */
type AgentFillApprovalOutcome = Exclude<AgentFillApprovalDialogResult, { handledElsewhere: true }>;

/**
 * Renderer half of the approval: matches items in the desktop app's own vault against the tab's
 * domain, shows the approval dialog, and answers the main process with the decision and display
 * fields only (item name, username or card last four).
 *
 * With `FeatureFlag.AgentFillApprovals` on, it also posts a sealed request to the server and
 * accepts whichever answer comes first: the dialog's, or a phone's that passes verification.
 */
@Injectable({ providedIn: "root" })
export class AgentFillService implements OnDestroy {
  private readonly messageListener = inject(MessageListener);
  private readonly accountService = inject(AccountService);
  private readonly authService = inject(AuthService);
  private readonly cipherService = inject(CipherService);
  private readonly configService = inject(ConfigService);
  private readonly dialogService = inject(DialogService);
  private readonly sdkService = inject(SdkService);
  private readonly approvalApi = inject(AgentFillApprovalApiService);
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
    // Every approval passes through here, so this gate also covers the main-process hub.
    if (!(await this.configService.getFeatureFlag(FeatureFlag.AgentFill))) {
      return {
        decision: "failed",
        reason: AgentFillFailureReason.Error,
        message: "Agent fill is not enabled.",
      };
    }

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
    const server = await this.tryCreateServerRequest(userId, request);
    const dialogRef = AgentFillApprovalDialogComponent.open(this.dialogService, {
      request,
      items: ciphers.map(toApprovalItem),
      recordAnswer:
        server == null ? undefined : (answer) => this.recordAnswer(userId, server, answer),
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

    const phoneAnswer$ =
      server == null
        ? NEVER
        : merge(
            this.messageListener
              .messages$(AGENT_FILL_APPROVAL_ANSWERED)
              .pipe(filter((m) => m.approvalId === server.id)),
            // Catches an answer whose push was missed, for example while offline.
            this.messageListener.messages$(SYNC_COMPLETED).pipe(
              filter((m) => m.successfully),
              take(1),
            ),
          ).pipe(
            concatMap(() => this.fetchAndVerify(userId, server)),
            filter((outcome) => outcome != null),
            take(1),
            tap(() => dialogRef.close({ handledElsewhere: true })),
          );

    const dialogAnswer$ = dialogRef.closed.pipe(
      // A result of handledElsewhere means a phone answered; that branch carries the outcome.
      filter((result) => result == null || !("handledElsewhere" in result)),
      map((result) => (result ?? { decision: "denied" }) as AgentFillApprovalOutcome),
      // `closed` completes after it emits. Left alone, that would complete the race before the
      // phone's outcome is delivered, because phoneAnswer$ closes the dialog first.
      concatWith(NEVER),
    );

    let outcome: AgentFillApprovalOutcome;
    try {
      outcome = await firstValueFrom(race(dialogAnswer$, phoneAnswer$));
    } finally {
      cancelled.unsubscribe();
      // Single-use: a later answer for this request has nothing to verify against.
      if (server != null) {
        server.pending = null;
      }
    }

    return this.toResponse(outcome, ciphers);
  }

  private toResponse(
    outcome: AgentFillApprovalOutcome,
    ciphers: CipherView[],
  ): AgentFillApprovalResponse {
    switch (outcome.decision) {
      case "approved": {
        const chosen = ciphers.find((c) => c.id === outcome.cipherId);
        if (chosen == null) {
          return {
            decision: "failed",
            reason: AgentFillFailureReason.NoMatchingItem,
            message: "The chosen item is not in the desktop app's vault.",
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
      case "denied":
        return { decision: "denied", reason: outcome.reason };
      case "failed":
        return {
          decision: "failed",
          reason: outcome.reason,
          message: "The approval request expired.",
        };
    }
  }

  /** Seals the request and posts it. Null when approvals are off or anything goes wrong. */
  private async tryCreateServerRequest(
    userId: UserId,
    request: AgentFillApprovalRequest,
  ): Promise<ServerRequest | null> {
    try {
      if (!(await this.configService.getFeatureFlag(FeatureFlag.AgentFillApprovals))) {
        return null;
      }

      const created = await this.withApprovals(userId, (approvals) =>
        approvals.create_request({
          cipherType: request.cipherType === CipherType.Card ? "card" : "login",
          tabUrl: request.tabUrl,
          domain: request.domain,
          connectionName: request.connectionName,
          browserName: request.browser,
        }),
      );
      const record = await this.approvalApi.create(created.sealedRequest);
      this.logService.info(`[AgentFill] Approval ${record.id} created`);
      return { id: record.id, pending: created.pending };
    } catch (e) {
      this.logService.warning(`[AgentFill] Approval request not created: ${describeError(e)}`);
      return null;
    }
  }

  /**
   * Seals and posts the dialog's answer. Returns what the dialog should close with: its own
   * answer, or the phone's if the phone answered first.
   */
  private async recordAnswer(
    userId: UserId,
    server: ServerRequest,
    answer: AgentFillApprovalAnswer,
  ): Promise<AgentFillApprovalDialogResult> {
    const pending = server.pending;
    if (pending == null) {
      return answer;
    }

    try {
      const sealed = await this.withApprovals(userId, (approvals) =>
        approvals.seal_response(
          asUuid<AgentFillApprovalId>(server.id),
          { view: pending.view, challenge: pending.challenge },
          toSdkDecision(answer),
        ),
      );
      const result = await this.approvalApi.answer(server.id, sealed);
      switch (result.kind) {
        case "answered":
          this.logService.info(`[AgentFill] Approval ${server.id} answered here`);
          return answer;
        case "alreadyAnswered":
          // A phone won. Use its answer instead of this dialog's.
          return (await this.verifyRecord(userId, server, result.record)) ?? answer;
        case "expired":
          return { decision: "failed", reason: AgentFillFailureReason.Expired };
      }
    } catch (e) {
      this.logService.warning(
        `[AgentFill] Approval ${server.id} answer not recorded: ${describeError(e)}`,
      );
      return answer;
    }
  }

  /** Reads the record and verifies its answer. Null while it has no answer, or can't be read. */
  private async fetchAndVerify(
    userId: UserId,
    server: ServerRequest,
  ): Promise<AgentFillApprovalOutcome | null> {
    if (server.pending == null) {
      return null;
    }

    try {
      return await this.verifyRecord(userId, server, await this.approvalApi.get(server.id));
    } catch (e) {
      this.logService.warning(`[AgentFill] Approval ${server.id} not read: ${describeError(e)}`);
      return null;
    }
  }

  private async verifyRecord(
    userId: UserId,
    server: ServerRequest,
    record: AgentFillApprovalRecord,
  ): Promise<AgentFillApprovalOutcome | null> {
    const pending = server.pending;
    if (pending == null || record.sealedResponse == null) {
      return null;
    }
    const sealedResponse = record.sealedResponse;

    try {
      const decision = await this.withApprovals(userId, (approvals) =>
        approvals.verify_response(pending, asUuid<AgentFillApprovalId>(server.id), sealedResponse),
      );
      this.logService.info(
        `[AgentFill] Approval ${server.id} answered by device ${record.responseDeviceId}`,
      );
      return fromSdkDecision(decision);
    } catch (e) {
      this.logService.warning(
        `[AgentFill] Approval ${server.id} answer from device ${record.responseDeviceId} rejected: ${describeError(e)}`,
      );
      return isAgentFillApprovalError(e) && e.variant === "Expired"
        ? { decision: "failed", reason: AgentFillFailureReason.Expired }
        : { decision: "denied" };
    }
  }

  private async withApprovals<T>(
    userId: UserId,
    operation: (approvals: AgentFillApprovalClient) => T,
  ): Promise<T> {
    return await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        map((rc) => {
          using ref = rc.take();
          return operation(ref.value.agent_fill().approvals());
        }),
      ),
    );
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

function toSdkDecision(answer: AgentFillApprovalAnswer): ApprovalDecision {
  if (answer.decision === "approved") {
    return { approved: { cipherId: asUuid<CipherId>(answer.cipherId) } };
  }
  return {
    denied: {
      reason:
        answer.reason === AgentFillDenyReason.WrongAccount
          ? "wrongAccount"
          : answer.reason === AgentFillDenyReason.NotRequested
            ? "notRequested"
            : undefined,
    },
  };
}

function fromSdkDecision(decision: ApprovalDecision): AgentFillApprovalAnswer {
  if ("approved" in decision) {
    return { decision: "approved", cipherId: uuidAsString(decision.approved.cipherId) };
  }
  const reason = decision.denied.reason;
  return {
    decision: "denied",
    reason:
      reason === "wrongAccount"
        ? AgentFillDenyReason.WrongAccount
        : reason === "notRequested"
          ? AgentFillDenyReason.NotRequested
          : undefined,
  };
}

/** The error variant or HTTP status only, so no vault data or server message is logged. */
function describeError(e: unknown): string {
  if (isAgentFillApprovalError(e)) {
    return e.variant;
  }
  if (e instanceof ErrorResponse) {
    return `status ${e.statusCode}`;
  }
  return "unknown error";
}
