import { inject, Injectable, OnDestroy } from "@angular/core";
import { filter, Subject, takeUntil } from "rxjs";

import {
  AGENT_FILL_IPC_TOPIC,
  AgentFillDescribeResponseMessage,
  AgentFillFieldRole,
  AgentFillRefusalReason,
  AgentFillRequestMessage,
  AgentFillResponseMessage,
  AgentFillResult,
  AgentFillTargetDescription,
  isAgentFillIpcMessage,
} from "@bitwarden/common/autofill/agent-fill/agent-fill-messages";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { IpcService } from "@bitwarden/common/platform/ipc";
import { HostId, IncomingMessage, OutgoingMessage } from "@bitwarden/sdk-internal";

/** No live browser-extension endpoint has announced itself (`agentFillHello`). */
export class ExtensionUnavailableError extends Error {
  constructor() {
    super("No connected Bitwarden browser extension endpoint");
    this.name = "ExtensionUnavailableError";
  }
}

/** More than one distinct browser-extension endpoint is known — v1 requires exactly one
 *  (agent-access-architecture.md, "M5", decision 8). */
export class MultipleBrowsersError extends Error {
  constructor() {
    super("Multiple connected Bitwarden browser extension endpoints");
    this.name = "MultipleBrowsersError";
  }
}

/** The extension did not answer within {@link AGENT_FILL_RESPONSE_TIMEOUT_MS}. */
export class AgentFillTimeoutError extends Error {
  constructor() {
    super("The browser extension did not respond in time");
    this.name = "AgentFillTimeoutError";
  }
}

/** The extension answered a describe request with no describable login surface; `refusal` carries
 *  the machine-readable §4.1 reason. Value-free by construction. */
export class NoDescribableTargetError extends Error {
  constructor(readonly refusal?: AgentFillRefusalReason) {
    super("The active tab has no describable login surface");
    this.name = "NoDescribableTargetError";
  }
}

/** How long one describe/fill round-trip may take before it fails (M5: "describe round-trip to
 *  the extension (10s timeout)"). */
export const AGENT_FILL_RESPONSE_TIMEOUT_MS = 10_000;

/** One in-flight request awaiting the extension's correlated response. */
interface PendingExchange {
  resolve: (response: AgentFillDescribeResponseMessage | AgentFillResponseMessage) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** Extracts the `BrowserBackground` host id from an incoming message's source, or `null` for any
 *  other sender — only a browser extension background may speak the agent-fill topic. */
function browserBackgroundHostId(source: IncomingMessage["source"]): HostId | null {
  if (typeof source === "object" && source != null && "BrowserBackground" in source) {
    return source.BrowserBackground.id;
  }
  return null;
}

/** Stable map key for a `HostId` (`"Own"` or `{ Id: number }`), so distinct transport-assigned
 *  ids count as distinct endpoints for the exactly-one rule. */
function endpointKey(hostId: HostId): string {
  return typeof hostId === "string" ? hostId : `id-${hostId.Id}`;
}

/**
 * Desktop side of the agent-fill desktop↔extension leg (agent-access-architecture.md, "M5 —
 * Browser fill delivery"): correlated request/response over SDK IPC untyped JSON messages on
 * {@link AGENT_FILL_IPC_TOPIC}, against the extension's `AgentFillBackground`.
 *
 * The desktop cannot enumerate connected extensions, so the extension announces itself with an
 * unsolicited `agentFillHello` on connect/reconnect; this service keeps that endpoint registry
 * and enforces the v1 exactly-one-endpoint rule on every call: zero endpoints →
 * {@link ExtensionUnavailableError}, more than one distinct endpoint →
 * {@link MultipleBrowsersError}.
 *
 * SECURITY: {@link fill}'s request payload carries the live credential value — the ONLY place it
 * transits (M5 invariant 8). Nothing in this service ever logs, throws, or otherwise echoes a
 * request or response payload; errors are static and value-free by construction.
 */
@Injectable({
  providedIn: "root",
})
export class AgentFillBrowserService implements OnDestroy {
  private logService = inject(LogService);
  private ipcService = inject(IpcService);

  private destroy$ = new Subject<void>();

  /** Known live extension endpoints, keyed by {@link endpointKey}. Values are the raw `HostId`s
   *  to address replies back to. Entries are refreshed by any inbound agent-fill traffic; there
   *  is no expiry — hellos arrive on connect/reconnect only, so a TTL would drop live endpoints
   *  (a stale entry surfacing as `MultipleBrowsersError` is the documented v1 limitation). */
  private endpoints = new Map<string, HostId>();

  /** In-flight exchanges awaiting a correlated response, keyed by `requestId`. */
  private pending = new Map<string, PendingExchange>();

  private initialized = false;

  /** Subscribes the agent-fill topic. Idempotent; call once the renderer's IPC layer is up. */
  init(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    try {
      this.ipcService.messages$
        .pipe(
          filter((message) => message.topic === AGENT_FILL_IPC_TOPIC),
          takeUntil(this.destroy$),
        )
        .subscribe((message) => this.onMessage(message));
    } catch (e) {
      // messages$ throws when the IPC layer never initialized — the fill feature then simply
      // reports "extension unavailable" on use rather than breaking the credential pipeline.
      this.logService.error("Agent fill: IPC subscription failed", e);
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    for (const exchange of this.pending.values()) {
      clearTimeout(exchange.timer);
    }
    this.pending.clear();
  }

  /**
   * Asks the (single) connected extension to describe the active tab's login surface. Value-free
   * both ways. Throws {@link NoDescribableTargetError} when the extension reports no describable
   * surface, carrying its machine-readable refusal reason.
   */
  async describeTarget(): Promise<AgentFillTargetDescription> {
    const response = await this.exchange({
      type: "agentFillDescribeRequest",
      requestId: crypto.randomUUID(),
    });
    if (response.type !== "agentFillDescribeResponse") {
      // Correlation is by requestId, so a cross-type response means a misbehaving extension.
      throw new AgentFillTimeoutError();
    }
    if (response.target == null) {
      throw new NoDescribableTargetError(response.refusal);
    }
    return response.target;
  }

  /**
   * Pushes one immediate fill to the (single) connected extension and awaits its per-field
   * outcomes. `payload.credential` is the only value-bearing object in the whole contract —
   * NEVER log or persist it (see the class docs).
   */
  async fill(payload: {
    /** The origin the desktop matched against — echoed so the extension refuses on drift. */
    origin: string;
    targetToken?: string;
    fields: AgentFillFieldRole[];
    credential: { username?: string; password?: string; totpCode?: string };
  }): Promise<AgentFillResult> {
    const request: AgentFillRequestMessage = {
      type: "agentFillRequest",
      requestId: crypto.randomUUID(),
      origin: payload.origin,
      targetToken: payload.targetToken,
      fields: payload.fields,
      credential: payload.credential,
    };
    const response = await this.exchange(request);
    if (response.type !== "agentFillResponse") {
      throw new AgentFillTimeoutError();
    }
    return response.result;
  }

  /** Sends one request to the single endpoint and awaits its correlated response, under the
   *  shared timeout. Enforces the exactly-one-endpoint rule up front. */
  private async exchange(
    request: AgentFillRequestMessage | { type: "agentFillDescribeRequest"; requestId: string },
  ): Promise<AgentFillDescribeResponseMessage | AgentFillResponseMessage> {
    const hostId = this.singleEndpoint();

    // Register the pending exchange BEFORE sending so a same-tick response can't be missed.
    const responsePromise = new Promise<
      AgentFillDescribeResponseMessage | AgentFillResponseMessage
    >((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(request.requestId);
        reject(new AgentFillTimeoutError());
      }, AGENT_FILL_RESPONSE_TIMEOUT_MS);
      this.pending.set(request.requestId, { resolve, timer });
    });
    // The rejection above always has an awaiter (the return below); this guard only silences the
    // unhandled-rejection warning for the send-failure path, where the promise is abandoned.
    responsePromise.catch(() => {});

    try {
      await this.ipcService.send(
        OutgoingMessage.new_json_payload(
          request,
          { BrowserBackground: { id: hostId } },
          AGENT_FILL_IPC_TOPIC,
        ),
      );
    } catch {
      // Deliberately not re-throwing or logging the original error object: for a fill request it
      // could conceivably stringify the payload. The static replacement is value-free.
      const exchange = this.pending.get(request.requestId);
      if (exchange != null) {
        clearTimeout(exchange.timer);
        this.pending.delete(request.requestId);
      }
      throw new ExtensionUnavailableError();
    }

    return responsePromise;
  }

  /** The one known endpoint, or the appropriate error when there are zero or several. */
  private singleEndpoint(): HostId {
    if (this.endpoints.size === 0) {
      throw new ExtensionUnavailableError();
    }
    if (this.endpoints.size > 1) {
      throw new MultipleBrowsersError();
    }
    return this.endpoints.values().next().value!;
  }

  private onMessage(message: IncomingMessage): void {
    let payload: unknown;
    try {
      payload = message.parse_payload_as_json();
    } catch {
      return;
    }
    if (!isAgentFillIpcMessage(payload)) {
      return;
    }

    const hostId = browserBackgroundHostId(message.source);
    if (hostId == null) {
      // Only a browser extension background may speak this topic; drop anything else.
      return;
    }
    // Any agent-fill traffic proves a live endpoint, not just hellos.
    this.endpoints.set(endpointKey(hostId), hostId);

    switch (payload.type) {
      case "agentFillHello":
        return;
      case "agentFillDescribeResponse":
      case "agentFillResponse": {
        const exchange = this.pending.get(payload.requestId);
        if (exchange == null) {
          // Late (post-timeout) or unsolicited response — nothing to correlate to.
          return;
        }
        clearTimeout(exchange.timer);
        this.pending.delete(payload.requestId);
        exchange.resolve(payload);
        return;
      }
      default:
        // Desktop→extension request types echoed back are not ours to handle.
        return;
    }
  }
}
