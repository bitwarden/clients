import { firstValueFrom, Subscription } from "rxjs";
import { debounceTime } from "rxjs/operators";

import {
  AGENT_FILL_IPC_TOPIC,
  AgentFillDescribeRequestMessage,
  AgentFillDescribeResponseMessage,
  AgentFillFieldRole,
  AgentFillHelloMessage,
  AgentFillPerFieldOutcome,
  AgentFillRefusalReason,
  AgentFillRequestMessage,
  AgentFillResponseMessage,
  AgentFillResult,
  isAgentFillIpcMessage,
} from "@bitwarden/common/autofill/agent-fill";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { IpcService } from "@bitwarden/common/platform/ipc";
import { newGuid } from "@bitwarden/guid";
import { Endpoint, IncomingMessage, OutgoingMessage } from "@bitwarden/sdk-internal";

import { BrowserApi } from "../../platform/browser/browser-api";
import { AutofillService } from "../services/abstractions/autofill.service";
import { InlineMenuFieldQualificationService } from "../services/abstractions/inline-menu-field-qualifications.service";
import { AgentFillPlan, AgentFillPlanner, originOf } from "../services/agent-fill-planner";
import { AGENT_FILL_FORM_COMMAND, AgentFillOp, AgentFillOpResult } from "../types/agent-fill";

/** How long a described plan stays redeemable. Mirrors the wire contract's `expiresInMs`. */
export const AGENT_FILL_TARGET_TOKEN_TTL_MS = 30_000;

/** Quiet period allowed for multi-frame page-details aggregation before planning. */
const PAGE_DETAILS_SETTLE_MS = 100;

/** Bounded best-effort hello retry: the desktop IPC transport connects on a 10s reconnect loop. */
const HELLO_RETRY_INTERVAL_MS = 10_000;
const HELLO_MAX_ATTEMPTS = 6;

/**
 * In-memory record backing a single-use target token. Deliberately holds structure only —
 * opids and element signatures, never values.
 *
 * MV3 caveat: service-worker suspension clears this map. A token redeemed after a suspension
 * therefore resolves to `target-changed`, which is the acceptable fail-safe outcome (the desktop
 * re-describes and retries).
 */
type TargetTokenEntry = {
  tabId: number;
  origin: string;
  roles: Partial<Record<AgentFillFieldRole, { opid: string; frameId: number; signature: string }>>;
  expiresAt: number;
};

/**
 * Browser-extension endpoint of the Agent Access browser-fill feature (architecture §M5).
 *
 * Listens on the SDK IPC channel (topic {@link AGENT_FILL_IPC_TOPIC}) for describe/fill requests
 * from the desktop app and answers value-free responses. The zero-knowledge frame: the desktop
 * pushes an already-decrypted credential for a one-shot fill; this class holds it in memory only
 * for the duration of the fill — no vault write, no cache, no last-used update, and no value is
 * ever logged or echoed back (per-field outcomes carry targets and static reasons only).
 *
 * Event logging is owned by the desktop side per §M5 — deliberately no
 * `eventCollectionService` / `updateLastUsedDate` calls here.
 */
export class AgentFillBackground {
  private readonly planner: AgentFillPlanner;
  private readonly targetTokens = new Map<string, TargetTokenEntry>();
  private messagesSubscription?: Subscription;
  private helloTimer?: ReturnType<typeof setInterval>;
  private helloAttempts = 0;

  constructor(
    private ipcService: IpcService,
    private autofillService: AutofillService,
    fieldQualificationService: Pick<
      InlineMenuFieldQualificationService,
      "isNewPasswordField" | "isTotpField"
    >,
    private logService: LogService,
  ) {
    this.planner = new AgentFillPlanner(fieldQualificationService);
  }

  /**
   * Subscribes to the IPC message stream and announces this endpoint to the desktop app.
   * Must be called after {@link IpcService.init}; degrades to a no-op (with a static log line)
   * when IPC is unavailable.
   */
  init(): void {
    try {
      this.messagesSubscription = this.ipcService.messages$.subscribe({
        next: (message) => void this.handleIncomingMessage(message),
        // Keep the subscription callback exception-free; never surface stream errors upward.
        error: () => this.logService.warning("[AgentFill] IPC message stream errored"),
      });
    } catch {
      this.logService.warning("[AgentFill] IPC unavailable, agent fill disabled");
      return;
    }

    void this.sendHello();
  }

  destroy(): void {
    this.messagesSubscription?.unsubscribe();
    this.clearHelloTimer();
    this.targetTokens.clear();
  }

  /**
   * Announces a live agent-fill endpoint to the desktop (the desktop cannot enumerate connected
   * extensions over SDK IPC). The desktop transport connects asynchronously on a 10s reconnect
   * loop and {@link IpcService} exposes no (re)connect hook, so this retries a bounded number of
   * times instead of firing once into a not-yet-connected transport.
   *
   * MV3 caveat: the background service worker can be suspended at any time, which kills the retry
   * timer (and, on wake, re-runs init → a fresh hello). A hello lost to suspension is tolerable:
   * the desktop's describe request itself reaches us via the same transport regardless.
   */
  private async sendHello(): Promise<void> {
    if (await this.tryToSendHello()) {
      return;
    }

    this.helloTimer = setInterval(() => {
      this.helloAttempts++;
      void this.tryToSendHello().then((sent) => {
        if (sent || this.helloAttempts >= HELLO_MAX_ATTEMPTS) {
          this.clearHelloTimer();
        }
      });
    }, HELLO_RETRY_INTERVAL_MS);
  }

  private async tryToSendHello(): Promise<boolean> {
    try {
      const hello: AgentFillHelloMessage = { type: "agentFillHello" };
      await this.ipcService.send(
        OutgoingMessage.new_json_payload(hello, "DesktopRenderer", AGENT_FILL_IPC_TOPIC),
      );
      return true;
    } catch {
      // Desktop not connected (yet). Static message only — never log payloads on this path.
      return false;
    }
  }

  private clearHelloTimer(): void {
    if (this.helloTimer != null) {
      clearInterval(this.helloTimer);
      this.helloTimer = undefined;
    }
  }

  private async handleIncomingMessage(message: IncomingMessage): Promise<void> {
    try {
      if (message.topic !== AGENT_FILL_IPC_TOPIC) {
        return;
      }

      // Only the desktop app may drive describes/fills. Web-page sourced IPC messages (or any
      // other endpoint) are ignored outright — this is a security gate, not routing hygiene.
      const source = message.source;
      if (source !== "DesktopRenderer" && source !== "DesktopMain") {
        return;
      }

      let parsed: unknown;
      try {
        parsed = message.parse_payload_as_json();
      } catch {
        return;
      }
      if (!isAgentFillIpcMessage(parsed)) {
        return;
      }

      switch (parsed.type) {
        case "agentFillDescribeRequest":
          await this.handleDescribeRequest(parsed, source);
          break;
        case "agentFillRequest":
          await this.handleFillRequest(parsed, source);
          break;
        default:
          // Hello and response messages are extension → desktop; ignore echoes.
          return;
      }
    } catch {
      // Never throw into the subscription, and never log exception contents on this path — an
      // error raised mid-fill could theoretically reference the payload.
      this.logService.error("[AgentFill] failed to handle agent-fill message");
    }
  }

  private async handleDescribeRequest(
    message: AgentFillDescribeRequestMessage,
    replyTo: Endpoint,
  ): Promise<void> {
    let response: AgentFillDescribeResponseMessage;
    try {
      response = await this.describeActiveTab(message.requestId);
    } catch {
      this.logService.error("[AgentFill] describe request failed");
      response = {
        type: "agentFillDescribeResponse",
        requestId: message.requestId,
        refusal: "no-login-form",
      };
    }
    await this.reply(replyTo, response);
  }

  private async describeActiveTab(requestId: string): Promise<AgentFillDescribeResponseMessage> {
    const refuse = (refusal: AgentFillRefusalReason): AgentFillDescribeResponseMessage => ({
      type: "agentFillDescribeResponse",
      requestId,
      refusal,
    });

    const tab = await BrowserApi.getTabFromCurrentWindow();
    if (tab?.id == null || originOf(tab.url) == null) {
      return refuse("no-login-form");
    }

    const plan = await this.planForTab(tab);
    if (plan.candidates.length === 0) {
      return refuse(plan.pageRefusal ?? "no-login-form");
    }

    return {
      type: "agentFillDescribeResponse",
      requestId,
      target: {
        origin: plan.origin,
        formClass: plan.formClass,
        candidates: plan.candidates,
        refusals: plan.refusals,
        targetToken: this.storeTargetToken(plan, tab.id),
        expiresInMs: AGENT_FILL_TARGET_TOKEN_TTL_MS,
      },
    };
  }

  private async handleFillRequest(
    message: AgentFillRequestMessage,
    replyTo: Endpoint,
  ): Promise<void> {
    let result: AgentFillResult;
    try {
      result = await this.executeFill(message);
    } catch {
      // Static refusal: never let an exception (which could reference the payload) escape into a
      // response or a log entry.
      this.logService.error("[AgentFill] fill request failed");
      result = { status: "no-safe-target", origin: "", fields: [], reason: "no-login-form" };
    }
    const response: AgentFillResponseMessage = {
      type: "agentFillResponse",
      requestId: message.requestId,
      result,
    };
    await this.reply(replyTo, response);
  }

  private async executeFill(message: AgentFillRequestMessage): Promise<AgentFillResult> {
    this.sweepExpiredTokens();

    const tab = await BrowserApi.getTabFromCurrentWindow();
    const observedOrigin = originOf(tab?.url) ?? "";
    if (tab?.id == null || observedOrigin === "" || observedOrigin !== message.origin) {
      // Origin binding is string equality against what this extension itself reported (TOCTOU).
      return { status: "origin-changed", origin: observedOrigin, fields: [] };
    }

    let tokenEntry: TargetTokenEntry | undefined;
    if (message.targetToken != null) {
      tokenEntry = this.targetTokens.get(message.targetToken);
      // Single-use: consumed on redemption attempt, valid or not.
      this.targetTokens.delete(message.targetToken);
      if (
        tokenEntry == null ||
        tokenEntry.expiresAt <= Date.now() ||
        tokenEntry.tabId !== tab.id ||
        tokenEntry.origin !== observedOrigin
      ) {
        return { status: "target-changed", origin: observedOrigin, fields: [] };
      }
    }

    // Always plan against the live DOM: with a token this is the drift re-derivation, without one
    // it is the internal preflight that must be unambiguous per §4.1.
    const plan = await this.planForTab(tab);

    const requestedRoles = [...new Set(message.fields ?? [])];
    if (requestedRoles.length === 0) {
      return {
        status: "no-safe-target",
        origin: observedOrigin,
        fields: [],
        reason: this.planRefusalReason(plan),
      };
    }

    if (tokenEntry != null) {
      for (const role of requestedRoles) {
        const pinned = tokenEntry.roles[role];
        if (pinned == null) {
          continue; // Role was never in the described plan; skipped below, not drift.
        }
        const current = plan.selections[role];
        if (
          current == null ||
          current.opid !== pinned.opid ||
          current.frameId !== pinned.frameId ||
          current.signature !== pinned.signature
        ) {
          return { status: "target-changed", origin: observedOrigin, fields: [] };
        }
      }
    }

    const skippedOutcomes = new Map<AgentFillFieldRole, AgentFillPerFieldOutcome>();
    const opsByFrame = new Map<number, AgentFillOp[]>();
    const dispatchedRoles: { role: AgentFillFieldRole; opid: string; target: string }[] = [];

    for (const role of requestedRoles) {
      const selection = plan.selections[role];
      // A token pins the fill to exactly the described plan: roles outside it are never filled,
      // even if a fresh plan would now find a target for them.
      if (selection == null || (tokenEntry != null && tokenEntry.roles[role] == null)) {
        skippedOutcomes.set(role, {
          role,
          status: "skipped",
          reason: this.roleRefusalReason(plan, role),
        });
        continue;
      }

      const value = this.credentialValueForRole(message, role);
      if (value == null || value === "") {
        skippedOutcomes.set(role, { role, status: "skipped", reason: "no-credential-value" });
        continue;
      }

      const frameOps = opsByFrame.get(selection.frameId) ?? [];
      frameOps.push({ opid: selection.opid, role, value });
      opsByFrame.set(selection.frameId, frameOps);
      dispatchedRoles.push({ role, opid: selection.opid, target: selection.target });
    }

    if (dispatchedRoles.length === 0) {
      return {
        status: "no-safe-target",
        origin: observedOrigin,
        fields: requestedRoles
          .map((role) => skippedOutcomes.get(role))
          .filter((outcome): outcome is AgentFillPerFieldOutcome => outcome != null),
        reason: this.planRefusalReason(plan),
      };
    }

    // Per-frame dispatch: the content script independently re-checks every op at write time
    // (element type, viewability, origin, readonly, sandbox), so per-field independence is safe —
    // a password whose own write-time check fails is never written, regardless of siblings.
    const resultsByRole = new Map<AgentFillFieldRole, AgentFillOpResult>();
    for (const [frameId, ops] of opsByFrame) {
      let frameResults: AgentFillOpResult[] | undefined;
      try {
        frameResults = await BrowserApi.tabSendMessage<
          { command: string; agentFillOps: AgentFillOp[]; agentFillExpectedOrigin: string },
          AgentFillOpResult[] | undefined
        >(
          tab,
          {
            command: AGENT_FILL_FORM_COMMAND,
            agentFillOps: ops,
            agentFillExpectedOrigin: observedOrigin,
          },
          { frameId },
          true,
        );
      } catch {
        frameResults = undefined;
      }

      for (const op of ops) {
        const opResult = frameResults?.find?.((result) => result?.opid === op.opid);
        resultsByRole.set(
          op.role,
          opResult ?? { opid: op.opid, status: "failed", reason: "frame-unreachable" },
        );
      }
    }

    // NOTE: deliberately no page-details re-collection after filling — collected fields carry
    // element values, which would put the password into background memory/messaging again.

    const fields: AgentFillPerFieldOutcome[] = [];
    for (const role of requestedRoles) {
      const skipped = skippedOutcomes.get(role);
      if (skipped != null) {
        fields.push(skipped);
        continue;
      }
      const dispatched = dispatchedRoles.find((entry) => entry.role === role);
      const opResult = dispatched == null ? undefined : resultsByRole.get(role);
      if (dispatched == null || opResult == null) {
        fields.push({ role, status: "failed", reason: "frame-unreachable" });
        continue;
      }
      fields.push(
        opResult.status === "filled"
          ? { role, status: "filled", target: dispatched.target }
          : { role, status: "failed", reason: opResult.reason ?? "fill-failed" },
      );
    }

    const filledCount = fields.filter((outcome) => outcome.status === "filled").length;
    if (filledCount === requestedRoles.length) {
      return { status: "filled", origin: observedOrigin, fields };
    }
    if (filledCount > 0) {
      return { status: "partial", origin: observedOrigin, fields };
    }
    return {
      status: "no-safe-target",
      origin: observedOrigin,
      fields,
      reason: this.planRefusalReason(plan),
    };
  }

  private credentialValueForRole(
    message: AgentFillRequestMessage,
    role: AgentFillFieldRole,
  ): string | undefined {
    switch (role) {
      case "username":
        return message.credential.username;
      case "password":
        return message.credential.password;
      case "totp":
        return message.credential.totpCode;
    }
  }

  private async planForTab(tab: chrome.tabs.Tab): Promise<AgentFillPlan> {
    // The collect stream accumulates per-frame responses over time (with a 1s empty fallback);
    // a short quiet period lets multi-frame pages settle before the plan is derived.
    const pageDetails = await firstValueFrom(
      this.autofillService
        .collectPageDetailsFromTab$(tab)
        .pipe(debounceTime(PAGE_DETAILS_SETTLE_MS)),
    );
    return this.planner.plan(pageDetails, tab);
  }

  private storeTargetToken(plan: AgentFillPlan, tabId: number): string {
    this.sweepExpiredTokens();
    // The token is an unguessable one-shot handle; prefer crypto randomness, but a plan token is
    // additionally bound to tabId + origin + signatures, so the guid fallback stays safe.
    const token = typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : newGuid();
    const roles: TargetTokenEntry["roles"] = {};
    for (const selection of Object.values(plan.selections)) {
      if (selection != null) {
        roles[selection.role] = {
          opid: selection.opid,
          frameId: selection.frameId,
          signature: selection.signature,
        };
      }
    }
    this.targetTokens.set(token, {
      tabId,
      origin: plan.origin,
      roles,
      expiresAt: Date.now() + AGENT_FILL_TARGET_TOKEN_TTL_MS,
    });
    return token;
  }

  /** Lazy expiry sweep — invoked on token create and on fill, no timer to survive SW suspension. */
  private sweepExpiredTokens(): void {
    const now = Date.now();
    for (const [token, entry] of this.targetTokens) {
      if (entry.expiresAt <= now) {
        this.targetTokens.delete(token);
      }
    }
  }

  private planRefusalReason(plan: AgentFillPlan): AgentFillRefusalReason {
    return (
      plan.refusals.find((refusal) => refusal.role === "password")?.reason ??
      plan.refusals[0]?.reason ??
      plan.pageRefusal ??
      "no-login-form"
    );
  }

  /** Static skip reason for a role with no planned target. Never derived from values. */
  private roleRefusalReason(plan: AgentFillPlan, role: AgentFillFieldRole): string {
    return plan.refusals.find((refusal) => refusal.role === role)?.reason ?? "no-safe-target";
  }

  private async reply(
    destination: Endpoint,
    payload: AgentFillDescribeResponseMessage | AgentFillResponseMessage,
  ): Promise<void> {
    try {
      await this.ipcService.send(
        OutgoingMessage.new_json_payload(payload, destination, AGENT_FILL_IPC_TOPIC),
      );
    } catch {
      // All replies are value-free by construction, so a static log line is all that is safe
      // and all that is useful here.
      this.logService.warning("[AgentFill] failed to send agent-fill reply");
    }
  }
}
