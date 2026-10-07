// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import * as os from "os";
import * as path from "path";

import { ipcMain } from "electron";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { agent_access, passwords } from "@bitwarden/desktop-napi";

import {
  AgentAccessActivityEntry,
  AgentAccessActivityOrigin,
  AgentAccessActivityType,
  AgentAccessRequestStatus,
  CredentialRequestOutcome,
} from "../models/agent-access-activity";
import {
  AgentAccessGrant,
  AgentAccessGrantKey,
  AgentAccessGrantScope,
  isAgentAccessGrantScope,
  isAgentAccessOpenShellGrantDetails,
  isAgentAccessOpenShellGrantKey,
  UpsertAgentAccessGrantInput,
} from "../models/agent-access-grant";
import { AgentAccessOperation } from "../models/agent-access-operation";
import { AgentAccessResourceType } from "../models/agent-access-resource-type";
import { CredentialQueryType } from "../models/credential-query-type";
import { AGENT_ACCESS_IPC_CHANNELS } from "../models/ipc-channels";
import { OPENSHELL_DESKTOP_SOCKET_FILENAME, SetOpenShellListenerResult } from "../models/openshell";
import { deriveAgentAccessDisplayName } from "../utils/agent-access-attestation.util";

import { AgentAccessGrantStoreService } from "./agent-access-grant-store.service";
import { OpenShellDetectionService } from "./openshell-detection.service";
import { OpenShellEnabledState } from "./openshell-enabled-state";

// Default local socket/pipe path, per agent-access-architecture.md's "Local wire protocol v1"
// ("Socket path (fixed, userData-independent — both sides hardcode the same defaults)"). This
// intentionally does NOT depend on Electron's userData dir: the `aac` CLI has no way to learn a
// per-install userData path, so both sides hardcode the same well-known location instead. Kept
// in sync with the SDK-side default in `bitwarden/agent-access` (see the architecture doc's
// "SDK-side changes" section) — changing this is a protocol-level change, not a config tweak.
const LOCAL_SOCKET_FILENAME_UNIX = ".bitwarden-agent-access.sock";
const LOCAL_PIPE_PREFIX_WINDOWS = "\\\\.\\pipe\\bitwarden.agent-access.";
// Only [A-Za-z0-9_-] are valid in a Windows named pipe path segment; anything else in the OS
// username (spaces, unicode, etc.) is collapsed to `_` rather than rejected outright.
//
// CANONICAL ALGORITHM — must stay byte-for-byte identical to `sanitize_username` in
// `bitwarden/agent-access`'s `crates/ap-cli/src/transport/local.rs`: replace every character not in
// [A-Za-z0-9_-] with `_`. The desktop side and the `aac` CLI independently compute this pipe name
// from the same OS username with no handshake to reconcile a mismatch, so if the two algorithms
// ever diverge, the Windows local transport silently fails (falls back to relay) for any username
// containing a dot, space, or non-ASCII character. Do not change this regex without updating
// `sanitize_username` in the same change (see `sanitizeWindowsPipeUsername`'s spec for the vectors
// both sides are pinned to: `john.doe`→`john_doe`, `CORP\max power!`→`CORP_max_power_`,
// `plainuser`→`plainuser`).
const WINDOWS_PIPE_NAME_SANITIZER = /[^A-Za-z0-9_-]/g;

// Exported for direct unit testing (see main-agent-access.service.spec.ts) — the vectors it's
// tested against are the same ones the SDK-side `sanitize_username` is pinned to; see the doc
// comment on `WINDOWS_PIPE_NAME_SANITIZER` above.
export function sanitizeWindowsPipeUsername(username: string): string {
  return username.replace(WINDOWS_PIPE_NAME_SANITIZER, "_");
}

// Keychain service name for Agent Access identity/connection/PSK material. Scoped separately from
// the biometric ("Bitwarden_biometric") and generic credential-storage entries so it can be wiped
// independently (e.g. "remove all paired devices").
export const KEYCHAIN_SERVICE_NAME = "Bitwarden_agent_access";

// Bound in-memory ring buffer of the most recent Agent Access activity entries, used to back the
// activity log's "history" view (GET_ACTIVITY) for a page that mounts after the activity happened.
// Entries are metadata-only: a resolved credential request records the released item's *id*, never
// its name, so no decrypted Vault Data enters this process (see `CredentialRequestActivity`). The
// buffer still outlives the active account, though, so `clearActivity` drops it on logout/switch.
const MAX_ACTIVITY_BUFFER_SIZE = 200;

// Rust's own credential audit events are dropped rather than buffered: this service opens and
// resolves a far richer `credential_request` entry around the same request (see
// `openCredentialRequest`/`resolveCredentialRequest`), and buffering both would double every row.
// Only Rust sees the connection/transport lifecycle, so those kinds are forwarded as-is.
const RUST_CREDENTIAL_EVENT_KINDS: ReadonlySet<string> = new Set([
  "credential_requested",
  "credential_approved",
  "credential_denied",
]);

// §M8.4: emitted for a value-free `openshellHello`. Main keeps only the last-seen timestamp.
const OPENSHELL_DRIVER_SEEN_EVENT_KIND = "openshellDriverSeen";

// §M8.18: Rust emits this (with only the request's dispatch token as `detail`) when aac hung up
// while the request was still waiting — the gateway or supervisor cancelled it. Main settles that
// one request as an undelivered, value-free timeout, so a later approval for it reports
// `delivered: false` and the renderer keeps the decision for the supervisor's retry.
const OPENSHELL_ABANDONED_EVENT_KIND = "openshellRequestAbandoned";
/** Every OpenShell dispatch token Rust puts in `queryValue` starts with this. */
const OPENSHELL_DISPATCH_TOKEN_PREFIX = "openshell-dispatch:";
/** Abandon events that arrived before their request was registered (napi delivers the two on
 *  different threadsafe functions, so their order isn't guaranteed). Bounded. */
const MAX_EARLY_ABANDONED_TOKENS = 64;

// Upper bound on how long a credential/fingerprint callback Promise (and the `pendingRequests`
// entry backing it) is allowed to live before this process gives up on the renderer ever
// answering — e.g. the credential pipeline isn't listening (feature flag off), the renderer
// crashed, or a bug in the approval pipeline swallowed the message. Set slightly above the Rust
// side's own 60 s deny-by-default callback timeout (agent-access-architecture.md: "under the same
// 60 s deny-by-default timeout") so Rust's own timeout is always the one that fires first in the
// common case; this is a backstop for cases where it doesn't (e.g. the callback itself never got a
// chance to run). Without this, an unanswered request's resolver closure — and its Map entry —
// would live in `pendingRequests` forever.
const PENDING_REQUEST_TIMEOUT_MS = 65_000;

/** A napi callback (credential, describe, or fingerprint) awaiting the renderer's answer. `kind`
 *  selects the correctly-shaped deny response if the request expires before the renderer ever
 *  answers (see `PENDING_REQUEST_TIMEOUT_MS`); `timer` is cleared as soon as the request settles,
 *  whichever way, so an already-answered request never fires a stray expiry later. A `describe`
 *  entry is a credential-callback request whose operation is `describeFillTarget` (M5) — its
 *  expiry denies with reason `"error"` rather than `"denied"`, because a describe is
 *  approval-free and "Denied by user" would name a user decision that cannot exist. */
interface PendingRequestEntry {
  kind: "credential" | "describe" | "fingerprint";
  resolve: (response: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
  /** OpenShell only: after this instant Rust's dispatch timeout (`min(60 s, deadlineMs)`, started
   *  just before main saw the request) has already fired, so an approval can no longer be
   *  delivered. A late answer is settled as a timeout (no values cross napi) and reported to the
   *  renderer as undelivered, so it records no grant and no release. */
  replyByMs?: number;
  /** OpenShell only (§M8.18): Rust's dispatch token, to match an `openshellRequestAbandoned`. */
  openShellDispatchToken?: string;
}

/** Rust's dispatch cap for an OpenShell request (§M8.4 `min(CALLBACK_TIMEOUT, deadlineMs)`). */
const OPENSHELL_DISPATCH_CAP_MS = 60_000;
/** Margin for the time between Rust starting its timeout and main seeing the request, plus the
 *  reply's own trip back to Rust. */
const OPENSHELL_DELIVERY_MARGIN_MS = 1_000;

/** Activity-entry id for a credential request, so its outcome can find the row it opened. */
function activityIdFor(requestId: number): string {
  return `request-${requestId}`;
}

/**
 * Narrows napi's `CredentialQueryType` (an ambient `const enum` with no runtime backing) to the
 * TS-side const object. Falls back to `Search` for a value outside the contract — the query text
 * is still worth logging, and the label is only used to caption it.
 */
function toCredentialQueryType(queryType: string): CredentialQueryType {
  const known: readonly string[] = Object.values(CredentialQueryType);
  return known.includes(queryType)
    ? (queryType as CredentialQueryType)
    : CredentialQueryType.Search;
}

/**
 * Narrows napi's `ResourceType` (an ambient `const enum` with no runtime backing) to the TS-side
 * const object. Falls back to `Credential` for a value outside the contract — the same defensive
 * default as the relay path, which always sends `"credential"` (agent-access-architecture.md,
 * "M4": "Always `"credential"` on the relay path").
 */
function toAgentAccessResourceType(resourceType: unknown): AgentAccessResourceType {
  const known: readonly string[] = Object.values(AgentAccessResourceType);
  return typeof resourceType === "string" && known.includes(resourceType)
    ? (resourceType as AgentAccessResourceType)
    : AgentAccessResourceType.Credential;
}

/**
 * Narrows napi's `OperationType` (an ambient `const enum` with no runtime backing) to the
 * TS-side const object. Falls back to `Request` for a value outside the contract — the same
 * defensive default as `toAgentAccessResourceType`, and the correct one: a value this service
 * doesn't recognize as `"create"`/`"update"`/`"delete"`/`"list"` (M6) must never be treated as a
 * write.
 */
function toAgentAccessOperation(operation: unknown): AgentAccessOperation {
  const known: readonly string[] = Object.values(AgentAccessOperation);
  return typeof operation === "string" && known.includes(operation)
    ? (operation as AgentAccessOperation)
    : AgentAccessOperation.Request;
}

export class MainAgentAccessService {
  // The napi callbacks (credential/fingerprint) are awaited directly by the Rust agent, so each
  // must return a Promise that resolves with the renderer's decision. The approval dialogs live in
  // the renderer (a separate process), so bridging a callback to a user decision requires a
  // round-trip: main fires a message to the renderer, the renderer responds via a separate IPC
  // call. Multiple remote agents can be connected concurrently, so pendingRequests holds the
  // resolve function for each in-flight callback (credential or fingerprint), keyed by requestId,
  // so the IPC response can be matched back to the correct waiting Promise. Electron has no native
  // main->renderer request-response mechanism, making this correlation map necessary.
  private pendingRequests = new Map<number, PendingRequestEntry>();
  /** §M8.18: see `MAX_EARLY_ABANDONED_TOKENS`. Insertion-ordered, so the oldest drops first. */
  private readonly earlyAbandonedTokens = new Set<string>();
  private requestId = 0;
  private agentState: agent_access.AgentAccessState;
  private handlersRegistered = false;
  // Oldest -> newest. Survives agent stop/start (and INIT re-registration) so the activity log
  // reflects the full session, not just the current run.
  private activityBuffer: AgentAccessActivityEntry[] = [];
  // Monotonic suffix for lifecycle entry ids. Rust events carry no id of their own, and a
  // timestamp alone collides when two events land in the same millisecond.
  private lifecycleEntryCount = 0;
  // First-use authorization grant store (W2b), keyed on the requester's attested code signature
  // (or canonical exe path, for unsigned/invalid-signature peers). See
  // agent-access-architecture.md, "Grant store (W2b)". Available independent of INIT/run state,
  // like GET_ACTIVITY — the handlers are registered unconditionally below.
  private grantStore: AgentAccessGrantStoreService;
  // Last `openshellDriverSeen` (§M8.4): a timestamp only — the hello carries nothing else, and
  // it is never written to the activity buffer.
  private openShellDriverLastSeenMs: number | null = null;

  constructor(
    private logService: LogService,
    private messagingService: MessagingService,
    private openShellDetectionService: OpenShellDetectionService = new OpenShellDetectionService(
      logService,
    ),
    private openShellEnabledState: OpenShellEnabledState = new OpenShellEnabledState(),
  ) {
    this.grantStore = new AgentAccessGrantStoreService(this.logService, KEYCHAIN_SERVICE_NAME);
    this.registerIpcHandlers();
  }

  private registerIpcHandlers() {
    ipcMain.handle(
      AGENT_ACCESS_IPC_CHANNELS.INIT,
      async (_event: any, { relayUrl }: { relayUrl: string }) => {
        if (!this.handlersRegistered) {
          this.registerAgentAccessIpcHandlers();
          this.handlersRegistered = true;
        }
        await this.init(relayUrl);
      },
    );

    ipcMain.handle(AGENT_ACCESS_IPC_CHANNELS.IS_LOADED, async (_event: any) => {
      return this.agentState != null && this.agentState.isRunning();
    });

    // Available independent of INIT/run state: the activity log page needs its history even if
    // opened before the agent has ever started (empty buffer) or after it's been stopped.
    ipcMain.handle(AGENT_ACCESS_IPC_CHANNELS.GET_ACTIVITY, async (_event: any) => {
      return this.activityBuffer;
    });

    // Also independent of INIT/run state, and for a stronger reason than GET_ACTIVITY: the
    // renderer calls this precisely when the account changes, a moment at which the agent may well
    // have just been stopped.
    ipcMain.handle(AGENT_ACCESS_IPC_CHANNELS.CLEAR_ACTIVITY, async (_event: any) => {
      this.clearActivity();
    });

    // Grant store handlers (W2b) — independent of INIT/run state for the same reason as
    // GET_ACTIVITY above: the credential pipeline needs these before/regardless of whether the
    // local listener has started, and there's nothing here that depends on `agentState`. The raw
    // keychain blob never crosses this boundary — only Grant DTOs (identity/scope metadata, no
    // secrets) do.
    ipcMain.handle(AGENT_ACCESS_IPC_CHANNELS.LIST_GRANTS, async (): Promise<AgentAccessGrant[]> => {
      return this.grantStore.list();
    });

    ipcMain.handle(
      AGENT_ACCESS_IPC_CHANNELS.FIND_GRANT,
      async (_event: any, key: AgentAccessGrantKey): Promise<AgentAccessGrant | null> => {
        // The renderer is a distrusted caller at this boundary: reject a malformed key outright
        // rather than letting it reach the store. An empty/missing `signatureIdentity` in
        // particular must never match — the store enforces the same fail-closed rule (see
        // `AgentAccessGrantStoreService.find`), but rejecting it here too means a malformed
        // request never even reaches storage.
        if (!MainAgentAccessService.isValidGrantKey(key)) {
          return null;
        }
        return this.grantStore.find(key);
      },
    );

    ipcMain.handle(
      AGENT_ACCESS_IPC_CHANNELS.UPSERT_GRANT,
      async (_event: any, input: UpsertAgentAccessGrantInput): Promise<AgentAccessGrant | null> => {
        // Fail closed on malformed input from the renderer (a distrusted caller at this
        // boundary): `scope` must be one of the known `AgentAccessGrantScope` members, and
        // `signatureKind`/`signatureIdentity` must be non-empty strings — an empty
        // `signatureIdentity` in particular is the degenerate "no attestable identity" case
        // (agent-access-architecture.md's grant-key derivation falls back to `("path", "")` when a
        // peer has no valid signature AND no resolvable exe path), which must never be persisted:
        // doing so would let one "Unknown application" grant silently cover every future
        // fully-unattestable process. The store enforces the same rule independently (defense in
        // depth), but rejecting here means a malformed request is never even attempted.
        if (!MainAgentAccessService.isValidUpsertGrantInput(input)) {
          this.logService.warning("[Agent Access] Rejected a malformed UPSERT_GRANT request");
          return null;
        }
        return this.grantStore.upsert(input);
      },
    );

    ipcMain.handle(
      AGENT_ACCESS_IPC_CHANNELS.REMOVE_GRANT,
      async (_event: any, { id }: { id: string }): Promise<void> => {
        await this.grantStore.remove(id);
      },
    );

    // OpenShell listener toggle (§M8.8). Registered unconditionally so a renderer call before
    // INIT gets an honest "not running" refusal instead of an unhandled channel.
    ipcMain.handle(
      AGENT_ACCESS_IPC_CHANNELS.SET_OPENSHELL_LISTENER,
      async (_event: any, enabled: unknown): Promise<SetOpenShellListenerResult> =>
        this.setOpenShellListener(enabled),
    );

    ipcMain.handle(
      AGENT_ACCESS_IPC_CHANNELS.GET_OPENSHELL_DRIVER_LAST_SEEN,
      async (): Promise<number | null> => this.openShellDriverLastSeenMs,
    );
  }

  /**
   * Starts or stops the OpenShell listener (§M8.8). The renderer only says on/off: on `true`
   * main re-runs detection itself and refuses unless OpenShell is present on a supported
   * platform and the agent-access server is running; the socket path is main-owned.
   */
  private async setOpenShellListener(enabled: unknown): Promise<SetOpenShellListenerResult> {
    if (typeof enabled !== "boolean") {
      throw new Error("setOpenShellListener expects a boolean");
    }
    if (!enabled) {
      this.openShellEnabledState.set(false);
      await this.agentState?.setOpenShellListener(null);
      return { listening: false };
    }

    const detection = await this.openShellDetectionService.detect();
    if (!detection.platformSupported) {
      return { listening: false, refusedReason: "unsupportedPlatform" };
    }
    if (!detection.present) {
      return { listening: false, refusedReason: "notDetected" };
    }
    if (this.agentState == null || !this.agentState.isRunning()) {
      return { listening: false, refusedReason: "agentAccessNotRunning" };
    }
    await this.agentState.setOpenShellListener(this.getOpenShellSocketPath());
    this.openShellEnabledState.set(true);
    return { listening: true };
  }

  // §M8.4: the OpenShell listener's fixed, home-relative path. Main-owned; never renderer input.
  private getOpenShellSocketPath(): string {
    return path.join(os.homedir(), OPENSHELL_DESKTOP_SOCKET_FILENAME);
  }

  private registerAgentAccessIpcHandlers() {
    ipcMain.handle(AGENT_ACCESS_IPC_CHANNELS.STOP, async () => {
      // The listener goes down with the server, so management is off with it.
      this.openShellEnabledState.set(false);
      if (this.agentState != null) {
        this.agentState.stop();
        this.agentState = null;
      }
      // Any callback the Rust agent is still awaiting is moot once the server has stopped — its
      // connection is gone. Clear every pending resolver/timer rather than leaving them to expire
      // on their own timers (or, worse, forever if STOP itself is what's cleaning up after a
      // renderer that will never answer).
      this.clearPendingRequests();
    });

    ipcMain.handle(AGENT_ACCESS_IPC_CHANNELS.GET_FINGERPRINT, async () => {
      return this.agentState?.getFingerprint();
    });

    ipcMain.handle(
      AGENT_ACCESS_IPC_CHANNELS.GENERATE_PSK_TOKEN,
      async (_event: any, { name, reusable }: { name: string | null; reusable: boolean }) => {
        return this.agentState?.generatePskToken(name, reusable);
      },
    );

    ipcMain.handle(
      AGENT_ACCESS_IPC_CHANNELS.GENERATE_RENDEZVOUS_CODE,
      async (_event: any, { name }: { name: string | null }) => {
        return this.agentState?.generateRendezvousCode(name);
      },
    );

    ipcMain.handle(AGENT_ACCESS_IPC_CHANNELS.LIST_CONNECTIONS, async () => {
      return (await this.agentState?.listConnections()) ?? [];
    });

    ipcMain.handle(
      AGENT_ACCESS_IPC_CHANNELS.REMOVE_CONNECTION,
      async (_event: any, { fingerprint }: { fingerprint: string }) => {
        await this.agentState?.removeConnection(fingerprint);
      },
    );

    ipcMain.handle(
      AGENT_ACCESS_IPC_CHANNELS.CREDENTIAL_REQUEST_RESPONSE,
      async (
        _event: any,
        {
          requestId,
          response,
          outcome,
        }: {
          requestId: number;
          response: agent_access.CredentialResponseData;
          // Activity-log annotation, supplied by the renderer alongside the response. Deliberately
          // a separate object: `response` may carry a live password, and nothing from it is ever
          // read into the activity buffer.
          outcome?: CredentialRequestOutcome;
        },
      ): Promise<boolean> => {
        // `true` only when the answer reached a request Rust is still waiting for. The renderer
        // persists an OpenShell grant and records release events only on `true`.
        const delivered = this.settlePendingRequest(requestId, response);
        this.resolveCredentialRequest(
          requestId,
          delivered || outcome == null ? outcome : { status: AgentAccessRequestStatus.Denied },
        );
        return delivered;
      },
    );

    ipcMain.handle(
      AGENT_ACCESS_IPC_CHANNELS.FINGERPRINT_RESPONSE,
      async (
        _event: any,
        {
          requestId,
          response,
        }: { requestId: number; response: agent_access.FingerprintVerificationResponse },
      ) => {
        this.settlePendingRequest(requestId, response);
      },
    );
  }

  // Starts the Agent Access server. Idempotent: does not trust the renderer's own "not already
  // running" check (`IS_LOADED`) across the IPC boundary — a second INIT racing the first would
  // otherwise call `serve()` again while the first instance is still live, orphaning it (its relay
  // connection and napi callbacks stay registered) and racing the second instance for the same
  // keychain keys and local socket/pipe. Guarding here, main-side, makes two concurrent INITs
  // produce exactly one `serve()` regardless of what the renderer believes its own state is.
  private async init(relayUrl: string) {
    if (this.agentState != null && this.agentState.isRunning()) {
      this.logService.info("Agent Access server already running; ignoring redundant init");
      return;
    }

    // A fresh server has no OpenShell listener until the toggle is applied again.
    this.openShellEnabledState.set(false);

    const credentialCb = (_err: Error | null, data: agent_access.CredentialRequestData) =>
      this.requestCredential(data);
    const fingerprintCb = (_err: Error | null, data: agent_access.FingerprintVerificationData) =>
      this.requestFingerprint(data);
    const storageGetCb = (_err: Error | null, key: string) => this.storageGet(key);
    // The generated napi type wants Promise<undefined>, so `void` alone doesn't satisfy it.
    const storageSetCb = async (
      _err: Error | null,
      entry: agent_access.StorageEntry,
    ): Promise<undefined> => {
      await this.storageSet(entry);
      return undefined;
    };
    // The generated napi type wants Promise<undefined>, so `void` alone doesn't satisfy it. Rust
    // invokes this fire-and-forget under a short timeout, so it must never throw.
    const eventCb = async (
      _err: Error | null,
      event: agent_access.AgentAccessEvent,
    ): Promise<undefined> => {
      this.recordEvent(event);
      return undefined;
    };

    try {
      this.agentState = await agent_access.AgentAccessState.serve(
        { relayUrl, socketPath: this.getDefaultSocketPath() },
        credentialCb,
        fingerprintCb,
        storageGetCb,
        storageSetCb,
        eventCb,
      );
      this.logService.info("Agent Access server started");
    } catch (e: unknown) {
      this.logService.error("Agent Access server encountered an error: ", e);
      // Rethrow so the rejection propagates through `ipcMain.handle`'s INIT handler to the
      // renderer's own `await ipc.agentAccess.init(...)` — swallowing it here previously made
      // INIT resolve successfully even when `serve()` failed (an unbindable socket, a bad relay
      // URL, ...), leaving the renderer believing the server had started when it hadn't.
      throw e;
    }
  }

  // Main-process-owned default for the local `aac` transport (agent-access-architecture.md,
  // "Local wire protocol v1"). Deliberately independent of Electron's userData dir — the `aac`
  // CLI, running as an unrelated process, has no way to discover a per-install userData path, so
  // both sides hardcode the same well-known home-relative location instead. Not overridable from
  // the renderer's INIT payload; only the relay URL is.
  private getDefaultSocketPath(): string {
    if (process.platform === "win32") {
      const username = sanitizeWindowsPipeUsername(os.userInfo().username);
      return `${LOCAL_PIPE_PREFIX_WINDOWS}${username}`;
    }
    return path.join(os.homedir(), LOCAL_SOCKET_FILENAME_UNIX);
  }

  // Records a Rust-sourced activity event. Never throws: the napi event callback is
  // fire-and-forget from the Rust side, and a broken activity log must never affect protocol
  // behavior.
  //
  // Rust's three credential kinds are dropped here (see RUST_CREDENTIAL_EVENT_KINDS) — this
  // service tracks the same requests itself, with the query, outcome, and released item attached.
  private recordEvent(event: agent_access.AgentAccessEvent): void {
    try {
      if (RUST_CREDENTIAL_EVENT_KINDS.has(event.kind)) {
        return;
      }
      if (event.kind === OPENSHELL_ABANDONED_EVENT_KIND) {
        // Never buffered: a dispatch token is internal bookkeeping, not an activity row.
        if (
          typeof event.detail === "string" &&
          event.detail.startsWith(OPENSHELL_DISPATCH_TOKEN_PREFIX)
        ) {
          this.abandonOpenShellRequest(event.detail);
        }
        return;
      }
      if (event.kind === OPENSHELL_DRIVER_SEEN_EVENT_KIND) {
        // Timestamp only, never buffered (§M8.4).
        const seenAt = Number(event.timestampMs);
        this.openShellDriverLastSeenMs = Number.isFinite(seenAt) ? seenAt : Date.now();
        return;
      }
      this.appendActivity({
        type: AgentAccessActivityType.Lifecycle,
        id: `lifecycle-${++this.lifecycleEntryCount}`,
        timestampMs: event.timestampMs,
        agentName: event.peerName,
        agentFingerprint: event.peerFingerprint,
        kind: event.kind,
        detail: event.detail,
      });
    } catch (e: unknown) {
      this.logService.error("Failed to record an Agent Access activity event", e);
    }
  }

  // Opens a `Pending` activity row for a credential request as it's dispatched to the renderer.
  // Both ingresses funnel through `requestCredential`, so this is the one place that sees every
  // request on both the relay and local paths, already correlated by `requestId`.
  private openCredentialRequest(requestId: number, data: agent_access.CredentialRequestData): void {
    try {
      const operation = toAgentAccessOperation(data.operation);
      // True for every write/list operation (`create`/`update`/`delete`/`list`, M4b/M6) — none of
      // them are a plain lookup, so none of them get a `queryType`/`queryValue` on the row (see
      // the invariant comment below). `describeFillTarget` never reaches here (early return
      // above), so this is never true for it.
      const isNonLookup = operation !== AgentAccessOperation.Request;

      // No activity row for `describeFillTarget` (agent-access-architecture.md, "M5"): the
      // operation is approval-free and vault-free — an agent preflights before every fill, so a
      // row per describe would flood the log with entries no user decision ever touches. The
      // `pendingRequests` entry for the response round-trip still exists (see
      // `requestCredential`); only the audit row is skipped. No query fields are fabricated
      // either, per the create-row invariant below.
      if (operation === AgentAccessOperation.DescribeFillTarget) {
        return;
      }

      if (data.origin === AgentAccessActivityOrigin.OpenShell) {
        this.appendActivity(this.openShellActivityRow(requestId, data));
        return;
      }

      this.appendActivity({
        type: AgentAccessActivityType.CredentialRequest,
        id: activityIdFor(requestId),
        timestampMs: `${Date.now()}`,
        // Relay requests carry a `requesterName` resolved from the connection store; local ones
        // never do (napi's `CredentialRequestData`: "`None` for `origin: "local"`"), so fall back
        // to the OS-attested process name — the same value the approval dialog shows. Both are
        // OS- or store-sourced; neither is ever self-reported by the requester.
        agentName: data.requesterName ?? deriveAgentAccessDisplayName(data.localPeer),
        agentFingerprint: data.requesterFingerprint,
        // OpenShell rows never reach here (see the early return above).
        origin:
          data.origin === AgentAccessActivityOrigin.Local
            ? AgentAccessActivityOrigin.Local
            : AgentAccessActivityOrigin.Relay,
        // HARD INVARIANT (agent-access-architecture.md, "M4b"/"M6"): napi's `queryValue` field on
        // `CredentialRequestData` isn't optional, so the Rust side force-fills it for every
        // non-lookup operation — the *proposed name* for `create`/`projectCreate`, the *target
        // id* for `update`/`delete` — there is no other value to put there. This main-process
        // activity buffer stores ids only, never names/values (see `CredentialRequestActivity`'s
        // docs), so `queryType`/`queryValue` are omitted entirely for every `operation !==
        // "request"` row rather than copied from `data` — an id would be tolerable on its own,
        // but a name must never enter the buffer, and consistency across every non-lookup
        // operation wins over special-casing which ones happen to carry an id today. Do not "fix"
        // this by reading `data.queryValue` here — that is exactly the leak this guards against.
        ...(isNonLookup
          ? {}
          : { queryType: toCredentialQueryType(data.queryType), queryValue: data.queryValue }),
        status: AgentAccessRequestStatus.Pending,
        resourceType: toAgentAccessResourceType(data.resourceType),
        operation,
      });
    } catch (e: unknown) {
      this.logService.error("Failed to open an Agent Access activity entry", e);
    }
  }

  // §M8.8: an OpenShell row stores exactly these keys — ids, the digest and the requested
  // target ids. No gateway/sandbox/provider/item names, no image, no endpoints, no values.
  // `agentName` is the attested gateway binary's name, from the shared display-name helper.
  private openShellActivityRow(
    requestId: number,
    data: agent_access.CredentialRequestData,
  ): AgentAccessActivityEntry {
    return {
      type: AgentAccessActivityType.CredentialRequest,
      id: activityIdFor(requestId),
      timestampMs: `${Date.now()}`,
      agentName: deriveAgentAccessDisplayName(data.localPeer),
      origin: AgentAccessActivityOrigin.OpenShell,
      operation: AgentAccessOperation.ProviderResolve,
      sandboxId: data.openshell?.sandboxId,
      providerId: data.openshell?.providerId,
      policyDigest: data.openshell?.policyDigest,
      targetIds: (data.providerTargets ?? []).map((target) => target.id),
      status: AgentAccessRequestStatus.Pending,
    };
  }

  // Resolves the row `openCredentialRequest` opened, in place, so one request stays one row.
  //
  // A missing `outcome` leaves the row `Pending` rather than guessing: an older renderer (or a
  // caller that skipped the annotation) genuinely hasn't told us how the request ended, and
  // inventing "denied" would put a wrong answer in what is meant to be an audit trail. A missing
  // *entry* is equally benign — the buffer may have evicted it, or the agent may have restarted.
  private resolveCredentialRequest(requestId: number, outcome?: CredentialRequestOutcome): void {
    try {
      if (outcome == null) {
        return;
      }
      const id = activityIdFor(requestId);
      const index = this.activityBuffer.findIndex((entry) => entry.id === id);
      const entry = index === -1 ? undefined : this.activityBuffer[index];
      if (entry == null || entry.type !== AgentAccessActivityType.CredentialRequest) {
        return;
      }
      // Only a `Pending -> resolved` transition is legitimate: each `requestId` is opened exactly
      // once (`openCredentialRequest`), so a second `CREDENTIAL_REQUEST_RESPONSE` for the same id
      // — a buggy or compromised renderer replaying/forging the message — must not be allowed to
      // silently rewrite an already-resolved row (e.g. flipping a recorded "denied" to "shared").
      if (entry.status !== AgentAccessRequestStatus.Pending) {
        this.logService.warning(
          `[Agent Access] Ignoring a credential request response for an already-resolved activity entry (requestId ${requestId})`,
        );
        return;
      }

      // Only a `Shared`/`Created`/`Updated`/`Deleted`/`Filled` outcome may point at a target;
      // anything else has nothing to point at, and a stray id on a denial (or a `FillFailed`,
      // where nothing was written) would imply a release/write/fill that never happened. `Filled`
      // stores the cipher *id* only, plus the roles actually filled and the extension-reported
      // page origin — metadata, never names or values (the reference-model invariant). `Listed`
      // (M6) has no single target — the project *list itself* was the release — so it copies
      // neither a `secretId` nor a `projectId`; it still transitions `Pending -> "listed"` like
      // every other terminal status.
      // OpenShell rows keep their fixed key set (§M8.8): only the status and resolution time
      // change. The targets are already recorded as ids; nothing from the outcome is copied.
      if (entry.origin === AgentAccessActivityOrigin.OpenShell) {
        const status =
          outcome.status === AgentAccessRequestStatus.Shared
            ? AgentAccessRequestStatus.Shared
            : outcome.status === AgentAccessRequestStatus.NotFound
              ? AgentAccessRequestStatus.NotFound
              : AgentAccessRequestStatus.Denied;
        const resolvedOpenShell: AgentAccessActivityEntry = {
          ...entry,
          status,
          resolvedAtMs: `${Date.now()}`,
        };
        this.activityBuffer[index] = resolvedOpenShell;
        this.messagingService.send(AGENT_ACCESS_IPC_CHANNELS.ACTIVITY, {
          entry: resolvedOpenShell,
        });
        return;
      }

      const pointsAtSecretOrProject =
        outcome.status === AgentAccessRequestStatus.Shared ||
        outcome.status === AgentAccessRequestStatus.Created ||
        outcome.status === AgentAccessRequestStatus.Updated ||
        outcome.status === AgentAccessRequestStatus.Deleted;
      const pointsAtCipher =
        outcome.status === AgentAccessRequestStatus.Shared ||
        outcome.status === AgentAccessRequestStatus.Filled;
      const fillOutcome =
        outcome.status === AgentAccessRequestStatus.Filled ||
        outcome.status === AgentAccessRequestStatus.FillFailed;
      const resolved: AgentAccessActivityEntry = {
        ...entry,
        status: outcome.status,
        cipherId: pointsAtCipher ? outcome.cipherId : undefined,
        secretId: pointsAtSecretOrProject ? outcome.secretId : undefined,
        projectId: pointsAtSecretOrProject ? outcome.projectId : undefined,
        fieldsShared: pointsAtCipher ? outcome.fieldsShared : undefined,
        fillOrigin: fillOutcome ? outcome.fillOrigin : undefined,
        resolvedAtMs: `${Date.now()}`,
      };
      this.activityBuffer[index] = resolved;
      this.messagingService.send(AGENT_ACCESS_IPC_CHANNELS.ACTIVITY, { entry: resolved });
    } catch (e: unknown) {
      this.logService.error("Failed to resolve an Agent Access activity entry", e);
    }
  }

  /** A copy of the activity buffer, for read-only consumers in main (the OpenShell Activity tab). */
  getActivityEntries(): readonly AgentAccessActivityEntry[] {
    return [...this.activityBuffer];
  }

  // Drops the buffer on logout/account switch, then tells the renderer to re-fetch. Nothing here
  // is decrypted Vault Data — that is what makes a *lock* need no equivalent — but which domains
  // the previous account's agents queried is still their session, not the next account's.
  private clearActivity(): void {
    this.activityBuffer = [];
    this.messagingService.send(AGENT_ACCESS_IPC_CHANNELS.ACTIVITY_RESET, {});
  }

  // Appends to the ring buffer and pushes the entry to the renderer's live activity log.
  private appendActivity(entry: AgentAccessActivityEntry): void {
    this.activityBuffer.push(entry);
    if (this.activityBuffer.length > MAX_ACTIVITY_BUFFER_SIZE) {
      this.activityBuffer.shift();
    }
    this.messagingService.send(AGENT_ACCESS_IPC_CHANNELS.ACTIVITY, { entry });
  }

  private requestCredential(
    data: agent_access.CredentialRequestData,
  ): Promise<agent_access.CredentialResponseData> {
    const id = ++this.requestId;
    this.openCredentialRequest(id, data);
    // A `describeFillTarget` request (M5) still needs the pending-map entry for its response
    // round-trip, but its expiry must deny with the approval-free `"error"` shape — see
    // `PendingRequestEntry.kind`.
    const kind: PendingRequestEntry["kind"] =
      toAgentAccessOperation(data.operation) === AgentAccessOperation.DescribeFillTarget
        ? "describe"
        : "credential";
    const deadlineMs = data.openshell?.deadlineMs;
    const replyByMs =
      data.origin === AgentAccessActivityOrigin.OpenShell && typeof deadlineMs === "number"
        ? Date.now() +
          Math.min(OPENSHELL_DISPATCH_CAP_MS, deadlineMs) -
          OPENSHELL_DELIVERY_MARGIN_MS
        : undefined;
    const dispatchToken =
      data.origin === AgentAccessActivityOrigin.OpenShell &&
      typeof data.queryValue === "string" &&
      data.queryValue.startsWith(OPENSHELL_DISPATCH_TOKEN_PREFIX)
        ? data.queryValue
        : undefined;
    return new Promise((resolve) => {
      this.setPendingRequest(
        id,
        kind,
        resolve as (response: unknown) => void,
        replyByMs,
        dispatchToken,
      );
      if (dispatchToken != null && this.earlyAbandonedTokens.delete(dispatchToken)) {
        this.abandonOpenShellRequest(dispatchToken);
      }
      this.messagingService.send(AGENT_ACCESS_IPC_CHANNELS.CREDENTIAL_REQUEST, {
        requestId: id,
        queryType: data.queryType,
        queryValue: data.queryValue,
        requesterFingerprint: data.requesterFingerprint,
        requesterName: data.requesterName,
        // Additive: which ingress this request arrived through, the local `aac` process's
        // OS-verified peer info (undefined on the relay path), and how the requester wants an
        // approved credential delivered (also undefined on the relay path).
        origin: data.origin,
        localPeer: data.localPeer,
        deliveryMode: data.deliveryMode,
        // Additive (M4): whether this request is asking for a login credential or a Secrets
        // Manager secret. The renderer pipeline branches on this at the lookup step
        // (agent-access-architecture.md, "M4"); always `Credential` on the relay path.
        resourceType: toAgentAccessResourceType(data.resourceType),
        // Additive (M4b): whether this is a lookup or a proposal to create a new Secrets Manager
        // secret, plus the proposed fields for a create. These ride the live IPC message to the
        // renderer only — never persisted into `activityBuffer` (see `openCredentialRequest`'s
        // hard invariant above).
        operation: toAgentAccessOperation(data.operation),
        newSecretName: data.newSecretName,
        newSecretValue: data.newSecretValue,
        newSecretNote: data.newSecretNote,
        projectHint: data.projectHint,
        // Additive (M6): the id of the existing secret/project an `update`/`delete` request
        // targets, and generation parameters for a `create`/`update` that asks the desktop to
        // generate the value instead of the agent supplying one. All value-free (an id, a
        // boolean, a length, a symbols flag) — none of these ride `activityBuffer` either, same
        // as the create fields above.
        targetId: data.targetId,
        generateValue: data.generateValue,
        generateLength: data.generateLength,
        generateSymbols: data.generateSymbols,
        // Additive (M5): fill-delivery parameters — requested field roles and the optional
        // target token from a prior describeFillTarget. Value-free by construction (role names
        // and an opaque token); like the create fields above, they ride the live IPC message
        // only and never enter `activityBuffer`.
        fillFields: data.fillFields,
        fillTargetToken: data.fillTargetToken,
        // Additive (§M8): gateway-reported OpenShell context and the requested `bw://` targets
        // (ids and env-var names only) for `operation: "providerResolve"`, plus when main handed
        // the request over, so the renderer can tell how much of the deadline is left. Live IPC
        // only — the activity row above keeps ids alone.
        openshell: data.openshell,
        providerTargets: data.providerTargets,
        ...(data.origin === AgentAccessActivityOrigin.OpenShell
          ? { receivedAtMs: Date.now() }
          : {}),
      });
    });
  }

  private requestFingerprint(
    data: agent_access.FingerprintVerificationData,
  ): Promise<agent_access.FingerprintVerificationResponse> {
    const id = ++this.requestId;
    return new Promise((resolve) => {
      this.setPendingRequest(id, "fingerprint", resolve as (response: unknown) => void);
      this.messagingService.send(AGENT_ACCESS_IPC_CHANNELS.FINGERPRINT_REQUEST, {
        requestId: id,
        fingerprint: data.fingerprint,
        identityFingerprint: data.identityFingerprint,
      });
    });
  }

  // Registers a callback's resolver under `requestId`, with an expiry timer as a backstop against
  // it never being answered (see `PENDING_REQUEST_TIMEOUT_MS`).
  private setPendingRequest(
    requestId: number,
    kind: PendingRequestEntry["kind"],
    resolve: (response: unknown) => void,
    replyByMs?: number,
    openShellDispatchToken?: string,
  ): void {
    const timer = setTimeout(
      () => this.expirePendingRequest(requestId),
      PENDING_REQUEST_TIMEOUT_MS,
    );
    this.pendingRequests.set(requestId, {
      kind,
      resolve,
      timer,
      replyByMs,
      ...(openShellDispatchToken != null ? { openShellDispatchToken } : {}),
    });
  }

  // §M8.18: aac hung up on this OpenShell request. Settle it now as a value-free timeout (Rust has
  // already dropped the dispatch, so nothing reaches it either way); the renderer's later answer
  // finds no pending entry and is reported undelivered, so it records no grant and no release.
  private abandonOpenShellRequest(token: string): void {
    for (const [requestId, entry] of this.pendingRequests) {
      if (entry.openShellDispatchToken === token) {
        clearTimeout(entry.timer);
        this.pendingRequests.delete(requestId);
        entry.resolve({
          approved: false,
          reason: "timeout",
        } as agent_access.CredentialResponseData);
        return;
      }
    }
    // Not registered yet: remember it briefly (bounded) so registration can settle it.
    this.earlyAbandonedTokens.add(token);
    if (this.earlyAbandonedTokens.size > MAX_EARLY_ABANDONED_TOKENS) {
      const oldest = this.earlyAbandonedTokens.values().next().value;
      if (oldest != null) {
        this.earlyAbandonedTokens.delete(oldest);
      }
    }
  }

  // Settles a pending request with the renderer's actual answer (CREDENTIAL_REQUEST_RESPONSE /
  // FINGERPRINT_RESPONSE), clearing its expiry timer so it can never also fire a stray denial
  // after the fact.
  //
  // Returns whether the answer was delivered to a request that is still waiting. An OpenShell
  // answer past its `replyByMs` is settled as a value-free timeout instead.
  private settlePendingRequest(requestId: number, response: unknown): boolean {
    const entry = this.pendingRequests.get(requestId);
    if (entry == null) {
      return false;
    }
    clearTimeout(entry.timer);
    this.pendingRequests.delete(requestId);
    if (entry.replyByMs != null && Date.now() > entry.replyByMs) {
      entry.resolve({ approved: false, reason: "timeout" } as agent_access.CredentialResponseData);
      return false;
    }
    entry.resolve(response);
    return true;
  }

  // Backstop for a request the renderer never answered at all (feature disabled, renderer crash,
  // a bug in the approval pipeline, ...). Without this, the resolver closure — and its
  // `pendingRequests` entry — would live forever; Rust's own napi callback would also be left
  // permanently unresolved rather than settling on its own 60 s deny-by-default timeout. A no-op
  // if the request already settled the normal way (its timer would already be cleared, so this
  // fires only when it wasn't).
  private expirePendingRequest(requestId: number): void {
    const entry = this.pendingRequests.get(requestId);
    if (entry == null) {
      return;
    }
    this.pendingRequests.delete(requestId);
    const denyResponse: unknown =
      entry.kind === "credential"
        ? ({ approved: false, reason: "denied" } as agent_access.CredentialResponseData)
        : entry.kind === "describe"
          ? // A describe is approval-free, so its expiry is a non-user failure — "denied" would
            // report a user decision that cannot exist for this operation (M5).
            ({ approved: false, reason: "error" } as agent_access.CredentialResponseData)
          : ({ approved: false } as agent_access.FingerprintVerificationResponse);
    entry.resolve(denyResponse);
  }

  // Drops every pending resolver/timer without individually resolving them — used by STOP, where
  // the underlying connection each callback was answering on is already gone, so there is nothing
  // left for a per-entry deny response to reach.
  private clearPendingRequests(): void {
    for (const entry of this.pendingRequests.values()) {
      clearTimeout(entry.timer);
    }
    this.pendingRequests.clear();
    this.earlyAbandonedTokens.clear();
  }

  // Storage callbacks back identity/connection/PSK persistence with the OS keychain. This never
  // round-trips to the renderer: the values are opaque blobs the Agent Access SDK owns (no vault
  // data), and keeping them main-process-local avoids exposing raw PSK/identity material over IPC.
  private async storageGet(key: string): Promise<string | null> {
    try {
      return await passwords.getPassword(KEYCHAIN_SERVICE_NAME, key);
    } catch (e) {
      if (e instanceof Error && e.message === passwords.PASSWORD_NOT_FOUND) {
        return null;
      }
      this.logService.error("[Agent Access] Failed to read storage key", key, e);
      throw e;
    }
  }

  private async storageSet(entry: agent_access.StorageEntry): Promise<void> {
    try {
      if (entry.value == null) {
        await passwords.deletePassword(KEYCHAIN_SERVICE_NAME, entry.key);
      } else {
        // NOTE: keychain entries are not designed for large payloads. The "connections" key is a
        // JSON blob of cached connection metadata that can grow to a few KB with many paired
        // devices; this is fine for v1 but should move to a userData file if it becomes a problem
        // in practice (see final report).
        await passwords.setPassword(KEYCHAIN_SERVICE_NAME, entry.key, entry.value);
      }
    } catch (e) {
      if (e instanceof Error && e.message === passwords.PASSWORD_NOT_FOUND) {
        // Deleting a key that was never written is a no-op.
        return;
      }
      this.logService.error("[Agent Access] Failed to write storage key", entry.key, e);
      throw e;
    }
  }

  // Input validation for the grant-store IPC boundary (finding: "empty-attestation grant-key
  // collapse"). The renderer is a distrusted caller here — these guard FIND_GRANT/UPSERT_GRANT
  // against both a malformed shape and the degenerate "no attestable identity" key.

  private static isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
  }

  private static isValidGrantKey(key: unknown): key is AgentAccessGrantKey {
    if (key == null || typeof key !== "object") {
      return false;
    }
    const candidate = key as Partial<AgentAccessGrantKey>;
    return (
      MainAgentAccessService.isNonEmptyString(candidate.signatureKind) &&
      MainAgentAccessService.isNonEmptyString(candidate.signatureIdentity) &&
      // §M8.5: an OpenShell key is checked field by field (type, length, charset).
      (candidate.openshell === undefined || isAgentAccessOpenShellGrantKey(candidate.openshell))
    );
  }

  private static isValidUpsertGrantInput(input: unknown): input is UpsertAgentAccessGrantInput {
    if (!MainAgentAccessService.isValidGrantKey(input)) {
      return false;
    }
    const candidate = input as Partial<UpsertAgentAccessGrantInput>;
    // §M8.5: `scope === "openshellSandbox"` if and only if `openshell` is present, and the
    // details are validated in full.
    const isOpenShellScope = candidate.scope === AgentAccessGrantScope.OpenShellSandbox;
    const openShellValid = isOpenShellScope
      ? isAgentAccessOpenShellGrantDetails(candidate.openshell)
      : candidate.openshell === undefined;
    return (
      MainAgentAccessService.isNonEmptyString(candidate.displayName) &&
      isAgentAccessGrantScope(candidate.scope) &&
      (candidate.exePath == null || typeof candidate.exePath === "string") &&
      openShellValid
    );
  }
}
