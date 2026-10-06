// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { inject, Injectable, OnDestroy } from "@angular/core";
import {
  catchError,
  combineLatest,
  concatMap,
  distinctUntilChanged,
  EMPTY,
  filter,
  firstValueFrom,
  from,
  map,
  of,
  skip,
  Subject,
  switchMap,
  take,
  takeUntil,
  timeout,
  TimeoutError,
  withLatestFrom,
} from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import {
  AgentFillFieldRole,
  AgentFillPerFieldOutcome,
  AgentFillResult,
  AgentFillTargetDescription,
} from "@bitwarden/common/autofill/agent-fill/agent-fill-messages";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { EventCollectionService, EventType } from "@bitwarden/common/dirt/event-logs";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  CommandDefinition,
  MessageListener,
  MessageSender,
} from "@bitwarden/common/platform/messaging";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, ToastService } from "@bitwarden/components";
import type { agent_access } from "@bitwarden/desktop-napi";

import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";
import {
  ApproveCredentialRequestComponent,
  CredentialLoginMatch,
  CredentialMatch,
} from "../components/approve-credential-request.component";
import { ApproveFillRequestComponent } from "../components/approve-fill-request.component";
import {
  ConfirmDeleteRequestComponent,
  ConfirmDeleteRequestResult,
} from "../components/confirm-delete-request.component";
import {
  CreateProjectRequestComponent,
  CreateProjectRequestResult,
} from "../components/create-project-request.component";
import {
  CreateSecretRequestComponent,
  CreateSecretRequestResult,
} from "../components/create-secret-request.component";
import { FirstUseAuthorizationDialogComponent } from "../components/first-use-authorization-dialog.component";
import {
  ProjectListRequestComponent,
  ProjectListRequestResult,
} from "../components/project-list-request.component";
import {
  ProjectSecretsRequestComponent,
  ProjectSecretsRequestResult,
} from "../components/project-secrets-request.component";
import {
  UpdateSecretRequestChanges,
  UpdateSecretRequestComponent,
  UpdateSecretRequestResult,
} from "../components/update-secret-request.component";
import { AgentAccessRequestStatus } from "../models/agent-access-activity";
import { AgentAccessDeliveryMode } from "../models/agent-access-delivery-mode";
import { AgentAccessGrantScope, UpsertAgentAccessGrantInput } from "../models/agent-access-grant";
import { AgentAccessOperation } from "../models/agent-access-operation";
import { AgentAccessResourceType } from "../models/agent-access-resource-type";
import { CredentialDenialReason } from "../models/credential-denial-reason";
import { CredentialQueryType } from "../models/credential-query-type";
import { AGENT_ACCESS_IPC_CHANNELS } from "../models/ipc-channels";
import {
  deriveAgentAccessAttestationKey,
  deriveAgentAccessDisplayName,
} from "../utils/agent-access-attestation.util";

import { AgentAccessSecretsService, SmProjectMatch } from "./agent-access-secrets.service";
import {
  AgentFillBrowserService,
  MultipleBrowsersError,
  NoDescribableTargetError,
} from "./agent-fill-browser.service";

/**
 * Default Agent Access relay. This is a development relay operated outside Bitwarden
 * infrastructure (see agent-access-desktop-plan.md, "Known risks"), NOT a Bitwarden-hosted
 * service. It must be replaced with Bitwarden-hosted relay infrastructure before this feature
 * ships broadly.
 */
export const DEFAULT_RELAY_URL = "wss://ap.lesspassword.dev";

/** Announces a grant-store write to the renderer's own listeners — see `GRANTS_CHANGED`'s doc in
 *  models/ipc-channels.ts for why this is renderer -> renderer rather than an IPC handle. */
const GRANTS_CHANGED_COMMAND = new CommandDefinition<Record<string, never>>(
  AGENT_ACCESS_IPC_CHANNELS.GRANTS_CHANGED,
);

/** Caps how many matches are ever built/shown for one request — a runaway query (e.g. a very
 *  short search term) must not build dozens of live-credential payloads or render an unusable
 *  picker. */
const MAX_CREDENTIAL_MATCHES = 20;

/** Caps a `projectList` release (agent-access-architecture.md, "M6"): "capped at 200 entries.
 *  This is the one list-shaped release; every other op stays single-target." */
const MAX_PROJECT_LIST_ENTRIES = 200;

/** Caps a `projectSecretsRequest` release (agent-access-architecture.md, "M7"): "Capped at 200
 *  entries; a project over the cap ⇒ wire `error` with a generic 'too many secrets' message
 *  (pre-dialog — don't ask a human to approve a release we won't perform)." Unlike
 *  `MAX_PROJECT_LIST_ENTRIES`, exceeding this denies the whole request rather than truncating —
 *  a truncated bulk release would silently omit secrets the agent's command still expects. */
const MAX_PROJECT_SECRETS_ENTRIES = 200;

// Actionable, value-free `denialDetail` strings for `deliveryMode: "fill"` pre-prompt failures
// (agent-access-architecture.md, "M5": "Extension unreachable / ambiguous browser count
// pre-prompt -> existing `status: "error"` with an actionable message"). These go to the
// requesting agent over the local wire protocol, not to the UI, so they are deliberately not
// localized.
const FILL_DETAIL_EXTENSION_UNAVAILABLE =
  "The Bitwarden browser extension is not connected. Open a browser with the Bitwarden extension installed and connected to the desktop app, then retry.";
const FILL_DETAIL_MULTIPLE_BROWSERS =
  "More than one browser with the Bitwarden extension is connected. Close the extra browsers so exactly one is connected, then retry.";

/** All fill field roles this desktop knows, in fill order. */
const FILL_FIELD_ROLES: readonly AgentFillFieldRole[] = ["username", "password", "totp"];

/**
 * The wire-protocol `fill` object shape (agent-access-architecture.md, "M5") serialized into the
 * napi `fillResult` pass-through. Identical to the extension's {@link AgentFillResult} except for
 * the desktop-assembled `extension-unavailable` status: the extension never reports its own
 * absence, so a post-approval transport failure is represented desktop-side without widening the
 * frozen desktop<->extension message contract.
 */
type AgentFillWireResult =
  | AgentFillResult
  | { status: "extension-unavailable"; origin: string; fields: AgentFillPerFieldOutcome[] };

/**
 * One matched cipher with its response payload already built. Building every candidate's payload
 * up front — before the dialog opens — preserves the property that what the user approves is
 * exactly what gets released (see agent-access-desktop-plan.md, "What is already correct").
 */
type CredentialCandidate = {
  cipher: CipherView;
  response: agent_access.CredentialResponseData;
};

/**
 * One matched Secrets Manager secret — the M4 analogue of {@link CredentialCandidate}, but
 * deliberately value-less (agent-access-architecture.md, "M4c — server-side event logs"): the
 * server writes a `Secret_Retrieved` audit event for every `GET /secrets/{id}` call made with the
 * user's token, so fetching a value for every candidate shown in the dialog — before the user has
 * picked one — would forge a retrieval trail for secrets never released. Unlike the credential
 * path, the payload here is built only *after* approval, from exactly the id the user selected
 * (see `resolveSecretRequest`).
 */
/**
 * `projectId`/`projectName` are carried through from `AgentAccessSecretsService.findSecrets`'s
 * `SmSecretMatch` (see that interface's doc comment for why): SM enforces secret-name uniqueness
 * per project, not per org, so `findSecrets`'s org-wide listing can surface two candidates with
 * identical `name` AND `organizationName` — the project is what the approval picker uses to tell
 * them apart. Both are optional for the same reason they are on `SmSecretMatch`: a project-less
 * secret carries neither.
 */
type SecretCandidate = {
  secretId: string;
  name: string;
  organizationId: string;
  organizationName?: string;
  projectId?: string;
  projectName?: string;
};

/** Which resource kind a request's matches are, and the (already payload-built) candidates for
 *  it — the pipeline branches on this once, right after lookup, and both branches share the same
 *  deny/dialog/release shape from there on. `truncated` reports whether the lookup that produced
 *  `candidates` actually cut off further matches at its cap (see `findCiphers`'s and
 *  `lookupSecret`'s docs) — carried through to the approval dialog so it can say so truthfully
 *  instead of guessing from `candidates.length` alone (agent-access-design-spec.md §3.3: "a
 *  silently truncated list misrepresents what matched"). */
type ResolvedCandidates =
  | {
      resourceType: typeof AgentAccessResourceType.Credential;
      candidates: CredentialCandidate[];
      truncated: boolean;
    }
  | {
      resourceType: typeof AgentAccessResourceType.Secret;
      candidates: SecretCandidate[];
      truncated: boolean;
    };

/**
 * Narrows the wire's `deliveryMode` (`string | undefined` per napi's `CredentialRequestData`) to
 * the TS-side const object — the same defensive-narrowing pattern `main-agent-access.service.ts`
 * uses for `resourceType`/`operation`. Unlike those, there is no single safe default to collapse
 * onto: an unrecognized or absent value must read as "no restriction" (`undefined`), so callers
 * fall through to the full, current field list rather than ever silently narrowing toward
 * `Reference` and under-reporting what a real disclosure released. `Fill` requests never reach
 * `resolveCredentialRequest` (they branch to `resolveFillRequest` earlier in the pipeline), but a
 * `Fill` value narrowed here is harmless: it isn't `Reference`, so it also falls through to the
 * full field list.
 */
function toKnownDeliveryMode(deliveryMode: unknown): AgentAccessDeliveryMode | undefined {
  const known: readonly string[] = Object.values(AgentAccessDeliveryMode);
  return typeof deliveryMode === "string" && known.includes(deliveryMode)
    ? (deliveryMode as AgentAccessDeliveryMode)
    : undefined;
}

/**
 * Names the fields a response actually carries for the given delivery mode, e.g.
 * `["username", "password"]`, for the approval dialog's "fields shared" summary and the activity
 * log. Presence only — a field's *value* never leaves this function.
 *
 * Reference mode releases only `item.username` on the wire (`build_approved_credential`'s
 * `DeliveryMode::Reference` arm emits `credential: None` — see
 * `local_listener/local_protocol.rs`), so this restricts the reported fields to `username` only,
 * matching exactly what was released. Every other delivery mode — `Inject`, and `undefined` for a
 * relay-origin request, which carries no delivery mode at all — reports the full field list, the
 * unchanged existing behavior.
 */
function releasedFieldNames(
  response: agent_access.CredentialResponseData,
  deliveryMode: AgentAccessDeliveryMode | undefined,
): string[] {
  const present: [string, unknown][] =
    deliveryMode === AgentAccessDeliveryMode.Reference
      ? [["username", response.username]]
      : [
          ["username", response.username],
          ["password", response.password],
          ["totp", response.totp],
          ["uri", response.uri],
        ];
  return present.filter(([, value]) => value != null).map(([name]) => name);
}

/**
 * Extracts the attested code-signature facts from a request's `localPeer` (napi's
 * `LocalPeerInfoData`) so every request-dialog call site can resolve `AgentAccessRequesterView
 * .brandLogo` from the same OS-verified data `authorizeLocalRequest` already uses to open the
 * first-use dialog (agent-access-design-spec.md §7.5.2 — the reported scope regression: only
 * `first-use-authorization-dialog` passed a brand logo, so the requesting agent's mark never
 * appeared on the request dialogs users actually see most often).
 *
 * `localPeer` is attached only for `origin: "local"` requests (see `agent_access
 * .CredentialRequestData.localPeer`'s docs — "`None` on the relay path") and survives
 * `authorizeLocalRequest`'s `{ ...message, requesterName: displayName }` spread untouched, so it
 * is still reachable on `message` at every downstream call site in this file. A relay-origin
 * request carries no `localPeer` at all, so this returns an all-`undefined` result for it —
 * `resolveAgentBrand` requires `signatureValid === true` to resolve anything, so the bare absence
 * of a signature is already enough to keep a relay-origin request on the neutral glyph (design
 * spec constraint 1: only a *verified* signature resolves a brand).
 *
 * SECURITY: deliberately reads only `message.localPeer?.signature` — never
 * `message.requesterName`. That field is self-reported by the requesting process (or, for a
 * local request, the OS-attested display name `authorizeLocalRequest` substitutes in — still not
 * a code signature) and must never influence which brand, and therefore which logo, is resolved:
 * keying a brand off a self-reported name would let any local process claim a known agent's mark
 * by simply naming itself "Claude" (design spec constraint 2). `requesterName` remains usable as
 * a display name only, exactly as before this change.
 */
function attestedSignatureLookup(message: Record<string, unknown>): {
  signatureKind?: string;
  signatureIdentity?: string;
  signatureValid?: boolean;
} {
  const localPeer = message.localPeer as agent_access.LocalPeerInfoData | undefined;
  return {
    signatureKind: localPeer?.signature?.kind,
    signatureIdentity: localPeer?.signature?.identity,
    signatureValid: localPeer?.signature?.valid,
  };
}

@Injectable({
  providedIn: "root",
})
export class DesktopAgentAccessService implements OnDestroy {
  AGENT_ACCESS_UNLOCK_REQUEST_TIMEOUT = 60_000;

  private destroy$ = new Subject<void>();

  private cipherService = inject(CipherService);
  private logService = inject(LogService);
  private dialogService = inject(DialogService);
  private messageListener = inject(MessageListener);
  private messageSender = inject(MessageSender);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  private i18nService = inject(I18nService);
  private desktopSettingsService = inject(DesktopSettingsService);
  private accountService = inject(AccountService);
  private configService = inject(ConfigService);
  private totpService = inject(TotpService);
  private agentAccessSecretsService = inject(AgentAccessSecretsService);
  private eventCollectionService = inject(EventCollectionService);
  private domainSettingsService = inject(DomainSettingsService);
  private agentFillBrowserService = inject(AgentFillBrowserService);

  // Session-remembered last org/project choice for the secret-creation dialog (M4b). In-memory
  // only — deliberately not persisted anywhere (keychain, userData, ...): it's a UX convenience
  // for the common case of an agent creating several secrets in a row in the same session, not a
  // standing preference, and it should reset on app restart the same way every other credential-
  // pipeline in-memory cache does.
  private lastCreateOrganizationId?: string;
  private lastCreateProjectId?: string;

  async init() {
    // Gate the whole feature on the flag: if it's off, don't even wire up listeners. Once the
    // flag flips within a session the app restarts before it takes effect, matching the SSH
    // agent v2 rollout gate.
    const enabled = await this.configService.getFeatureFlag(FeatureFlag.DesktopAgentAccess);
    if (!enabled) {
      return;
    }

    this.initStartStopPipeline();
    this.initCredentialRequestPipeline();
    // Subscribe the agent-fill endpoint registry early so extension hellos that arrive before
    // the first fill request are not missed (M5 — the desktop cannot enumerate endpoints).
    this.agentFillBrowserService.init();
    // TODO(agent-access): main-side FINGERPRINT_REQUEST/generateRendezvousCode now unused —
    // remove in main/preload/napi. The renderer-side rendezvous ceremony was removed here
    // (previously `initFingerprintRequestPipeline`, wired to the now-deleted
    // VerifyFingerprintDialogComponent) because it claimed users could compare a code shown here
    // with one shown "on the requesting agent," but PSK pairing never performs a rendezvous and
    // no code is ever generated for the agent side to display — the dialog trained blind
    // approval. A real ceremony, if wanted, should be designed fresh under W6. A leftover
    // main -> renderer FINGERPRINT_REQUEST with no renderer listener is a harmless no-op.
    this.initActivityClearPipeline();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Starts/stops the Agent Access server based on the user setting and whether any account is
  // logged in. Unlike the SSH agent, there is no "keep serving while locked" behavior to preserve
  // here beyond simply staying connected — credential lookups happen on demand per request, so
  // there is nothing to push proactively.
  private initStartStopPipeline() {
    this.accountService.activeAccount$
      .pipe(
        switchMap((account) => {
          if (account == null) {
            return from(this.stopAgent());
          }

          return combineLatest([
            this.authService.authStatusFor$(account.id),
            this.desktopSettingsService.agentAccessEnabled$,
          ]).pipe(
            switchMap(([status, enabled]) => {
              if (!enabled || status === AuthenticationStatus.LoggedOut) {
                return from(this.stopAgent());
              }
              return from(this.ensureAgentRunning());
            }),
          );
        }),
        catchError((error: unknown) => {
          this.logService.error("Agent Access start/stop pipeline stopped by an error", error);
          return EMPTY;
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  // Keeps one account's activity out of the next one's log. The main process's buffer is
  // process-memory and outlives the active account on its own; nothing in it is decrypted Vault
  // Data (a resolved request stores the released item's id, never its name — see
  // `CredentialRequestActivity`), so a *lock* needs no equivalent. The names shown against those
  // ids are resolved from the unlocked vault at render time and simply stop resolving.
  private initActivityClearPipeline() {
    this.accountService.activeAccount$
      .pipe(
        map((account) => account?.id ?? null),
        distinctUntilChanged(),
        // The first emission is whoever this session started as — there is no previous account's
        // activity to drop yet.
        skip(1),
        concatMap(() => this.clearActivity()),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  private async clearActivity(): Promise<void> {
    try {
      await ipc.agentAccess.clearActivity();
    } catch (e) {
      this.logService.error("Failed to clear the Agent Access activity log", e);
    }
  }

  private initCredentialRequestPipeline() {
    this.messageListener
      .messages$(new CommandDefinition(AGENT_ACCESS_IPC_CHANNELS.CREDENTIAL_REQUEST))
      .pipe(
        withLatestFrom(this.desktopSettingsService.agentAccessEnabled$),
        concatMap(async ([message, enabled]) => {
          if (!enabled) {
            await this.denyCredentialRequest(message.requestId as number);
            return null;
          }
          return message;
        }),
        filter((message) => message != null),
        withLatestFrom(this.authService.activeAccountStatus$, this.accountService.activeAccount$),
        // Mirrors the SSH agent unlock gate: if the vault isn't unlocked, prompt and wait (with a
        // timeout), otherwise proceed immediately.
        //
        // concatMap (not switchMap): a second request arriving while this one is waiting on
        // unlock (or on the grant/first-use stage below) must queue behind it, not cancel it.
        // switchMap here would unsubscribe the still-pending unlock-wait for request A the moment
        // request B arrived — silently dropping A (no deny is ever sent; the user only saw the
        // "unlock required" toast) while B's own wait/dialog stacks on top. Serializing the whole
        // per-request tail preserves deny-by-default without relying solely on the Rust-side 60s
        // timeout as the only backstop.
        concatMap(([message, status, account]) => {
          // `describeFillTarget` bypasses the unlock gate (agent-access-architecture.md, "M5",
          // invariant 12): it touches no vault data — the reply describes the browser page only
          // — so a locked vault must neither block it nor toast the user. The enable gate above
          // and the grant/first-use gate below still apply in full.
          if (this.isDescribeFillTargetRequest(message)) {
            return of([message, account?.id] as const);
          }
          if (status !== AuthenticationStatus.Unlocked || account == null) {
            ipc.platform.focusWindow();
            this.toastService.showToast({
              variant: "info",
              title: null,
              message: this.i18nService.t("agentAccessUnlockRequired"),
            });
            return this.authService.activeAccountStatus$.pipe(
              filter((s) => s === AuthenticationStatus.Unlocked),
              // Without take(1) this inner subscription stays alive after resolving once, so
              // every *future* unlock (long after this request was answered) re-emits into
              // timeout/catchError/concatMap below and replays this same request through
              // authorize -> lookup -> approval again. take(1) completes the inner observable
              // right after its first (and only) match, matching the "resolved exactly once"
              // invariant the rest of this pipeline (and the activity log) relies on.
              take(1),
              timeout({ first: this.AGENT_ACCESS_UNLOCK_REQUEST_TIMEOUT }),
              catchError((error: unknown) => {
                if (error instanceof TimeoutError) {
                  this.toastService.showToast({
                    variant: "error",
                    title: null,
                    message: this.i18nService.t("agentAccessUnlockTimeout"),
                  });
                  const requestId = message.requestId as number;
                  // switchMap (not map) so the deny completes without emitting — otherwise the
                  // already-denied request would continue into the lookup/dialog steps below.
                  return from(this.denyCredentialRequest(requestId)).pipe(switchMap(() => EMPTY));
                }
                throw error;
              }),
              concatMap(async () => {
                const updatedAccount = await firstValueFrom(this.accountService.activeAccount$);
                return [message, updatedAccount.id] as const;
              }),
            );
          }

          return of([message, account.id] as const);
        }),
        // Grant check + first-use authorization (W2b), local-origin requests only — relay
        // requests are unchanged and never reach `authorizeLocalRequest`. Denied (or malformed)
        // local requests are denied inside `authorizeLocalRequest` itself and resolve to `null`
        // here.
        //
        // concatMap (not switchMap): `authorizeLocalRequest` wraps a Promise, and a Promise can't
        // be cancelled once started — a switchMap "cancellation" here would only unsubscribe the
        // wrapping Observable while the first-use dialog, grant persistence, and deny/approve
        // side effects kept running in the background. The result would then be silently
        // discarded for request A while request B's dialog opened on top of it. concatMap instead
        // queues B until A's authorization (and everything downstream of it) has fully resolved.
        concatMap(([message, userId]: [Record<string, unknown>, UserId]) => {
          if ((message.origin as string | undefined) !== "local") {
            return of([message, userId] as const);
          }
          return from(this.authorizeLocalRequest(message)).pipe(
            switchMap((authorizedMessage) =>
              authorizedMessage == null ? EMPTY : of([authorizedMessage, userId] as const),
            ),
          );
        }),
        // Write/list branch (agent-access-architecture.md, "M4b" + "M6 — Full Secrets Manager
        // surface"): after the shared enable/unlock/grant gates above, a create/update/delete/
        // list request has no vault/SM *lookup* to run through `lookupCandidates` — either
        // nothing exists yet (`create`) or the target is already named by id (`update`/`delete`)
        // or there is no query at all (`list`) — so each takes its own path through
        // `handleWriteOrListRequest`, which owns its own resolve/dialog/approve/deny/respond
        // lifecycle end to end. `request` and `describeFillTarget` fall through unchanged to the
        // branches below.
        concatMap(([message, userId]: [Record<string, unknown>, UserId]) => {
          const operation = message.operation as string | undefined;
          if (
            operation === AgentAccessOperation.Create ||
            operation === AgentAccessOperation.Update ||
            operation === AgentAccessOperation.Delete ||
            operation === AgentAccessOperation.List
          ) {
            return from(this.handleWriteOrListRequest(message, userId, operation)).pipe(
              switchMap(() => EMPTY),
            );
          }
          return of([message, userId] as const);
        }),
        // Bulk-read branch (agent-access-architecture.md, "M7 — `bws run` parity"): a
        // `projectSecretsRequest` has its own resolve/dialog/approve/deny/respond lifecycle, like
        // the write/list branch above, but it isn't a write or a list — it releases every secret
        // VALUE in one project, so it gets its own handler rather than joining
        // `handleWriteOrListRequest`'s switch.
        concatMap(([message, userId]: [Record<string, unknown>, UserId]) => {
          if ((message.operation as string | undefined) === AgentAccessOperation.BulkRequest) {
            return from(this.handleProjectSecretsRequest(message, userId)).pipe(
              switchMap(() => EMPTY),
            );
          }
          return of([message, userId] as const);
        }),
        // describeFillTarget branch (agent-access-architecture.md, "M5"): approval-free and
        // vault-free — nothing to look up, no dialog, no activity row — so it takes its own path
        // after the shared enable/grant gates (the unlock gate was already bypassed above) and
        // owns its own respond/deny lifecycle.
        concatMap(([message, userId]: [Record<string, unknown>, UserId]) => {
          if (this.isDescribeFillTargetRequest(message)) {
            return from(this.handleDescribeFillTargetRequest(message)).pipe(switchMap(() => EMPTY));
          }
          return of([message, userId] as const);
        }),
        concatMap(([message, userId]: [Record<string, unknown>, UserId]) =>
          from(this.lookupCandidates(message, userId)).pipe(
            // userId rides along past this point: `resolveSecretRequest` needs it for the
            // post-approval, single-secret value fetch (agent-access-architecture.md, "M4c").
            map((resolved) => [message, resolved, userId] as const),
            catchError((error: unknown) => {
              // A lookup failure is a genuine error, not a clean "nothing matched" — deny
              // directly with the default (generic) reason and short-circuit here, the same way
              // the unlock-timeout path above does, instead of falling through as `[message, []]`
              // to the empty-candidates branch below (which would report it as NotFound and make
              // a vault/lookup failure indistinguishable from a clean no-match).
              this.logService.error("Agent Access credential lookup failed", error);
              const requestId = message.requestId as number;
              return from(this.denyCredentialRequest(requestId)).pipe(switchMap(() => EMPTY));
            }),
          ),
        ),
        concatMap(
          async ([message, resolved, userId]: [
            Record<string, unknown>,
            ResolvedCandidates,
            UserId,
          ]) => {
            const requestId = message.requestId as number;

            if (resolved.candidates.length === 0) {
              // No match: deny with a distinguishable reason instead of a silent generic denial,
              // so both the agent and the activity log can tell "nothing matched" apart from
              // "the user said no." The log gets it via the outcome annotation on the deny;
              // carrying it to the *agent* over the local wire protocol is still W1's job.
              await this.denyCredentialRequest(requestId, CredentialDenialReason.NotFound);
              return;
            }

            // Fill delivery (agent-access-architecture.md, "M5"): rides the shared pipeline up
            // to this point — same enable/unlock/grant gates and the same not-found deny above —
            // then branches into its own describe -> origin-filter -> approve -> fill lifecycle.
            // Credential resource only (the Rust validate() matrix rejects Secret+fill); it
            // focuses the window itself only once a dialog will actually open, since its two
            // mechanical refusals must not yank focus for a prompt that never appears.
            if (
              resolved.resourceType === AgentAccessResourceType.Credential &&
              (message.deliveryMode as string | undefined) === AgentAccessDeliveryMode.Fill
            ) {
              await this.resolveFillRequest(message, requestId, resolved.candidates);
              return;
            }

            ipc.platform.focusWindow();

            if (resolved.resourceType === AgentAccessResourceType.Secret) {
              await this.resolveSecretRequest(
                message,
                requestId,
                resolved.candidates,
                userId,
                resolved.truncated,
              );
              return;
            }

            await this.resolveCredentialRequest(
              message,
              requestId,
              resolved.candidates,
              resolved.truncated,
            );
          },
        ),
        catchError((error: unknown, source) => {
          this.logService.error("Unexpected error during Agent Access credential request", error);
          return source;
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  // Opens the approval dialog for a matched set of login ciphers and releases the selected
  // candidate's pre-built payload, or denies if the user declines. Split out of the credential
  // request pipeline so it's shared between the (unchanged) relay/local credential paths — the
  // secret path has its own sibling, `resolveSecretRequest`, since the released payload and
  // activity annotation shape differ (fieldsShared vs. a fixed `["value"]`, cipherId vs.
  // secretId).
  private async resolveCredentialRequest(
    message: Record<string, unknown>,
    requestId: number,
    candidates: CredentialCandidate[],
    truncated: boolean,
  ): Promise<void> {
    // Drives both what the dialog claims will be shared (below) and what the activity log
    // records as actually shared (at release, below) — a single source of truth so the two can
    // never disagree the way they used to (see `releasedFieldNames`'s doc for the reference-mode
    // contract).
    const deliveryMode = toKnownDeliveryMode(message.deliveryMode);

    const matches: CredentialMatch[] = candidates.map((candidate) => {
      const shared = releasedFieldNames(candidate.response, deliveryMode);
      return {
        kind: "credential",
        cipherId: candidate.cipher.id,
        cipherName: candidate.cipher.name,
        username: candidate.cipher.login?.username ?? undefined,
        fieldsShared: {
          username: shared.includes("username"),
          password: shared.includes("password"),
          totp: shared.includes("totp"),
          uri: shared.includes("uri"),
        },
      };
    });

    const dialogRef = ApproveCredentialRequestComponent.open(this.dialogService, {
      requesterName: message.requesterName as string | undefined,
      requesterFingerprint: message.requesterFingerprint as string | undefined,
      ...attestedSignatureLookup(message),
      queryType: message.queryType as CredentialQueryType,
      queryValue: message.queryValue as string,
      deliveryMode,
      matches,
      matchesTruncated: truncated,
    });

    const result = await firstValueFrom(dialogRef.closed);
    const selected =
      result != null && result.approved && result.selectedId != null
        ? candidates.find((candidate) => candidate.cipher.id === result.selectedId)
        : undefined;

    if (selected != null) {
      // Release exactly the pre-built payload for the selected candidate — never re-read the
      // vault after approval (TOCTOU). The activity annotation is derived from the same payload,
      // so the log names exactly what was released.
      await ipc.agentAccess.credentialRequestResponse(requestId, selected.response, {
        status: AgentAccessRequestStatus.Shared,
        // The item's *id*, not its name: the activity log resolves a name from the unlocked
        // vault when it renders, so no decrypted Vault Data is handed to the main process. This
        // is the same id already going to the agent in `response`.
        cipherId: selected.cipher.id,
        fieldsShared: releasedFieldNames(selected.response, deliveryMode),
      });

      // Server-visible audit trail for org vault credential releases
      // (agent-access-architecture.md, "M4c — server-side event logs"). No caller-side
      // org/UseEvents checks: `EventCollectionService`'s own gating drops personal-vault ciphers
      // and non-`UseEvents` orgs, matching its documented contract. One
      // `Cipher_ClientSharedWithAgent` event per approved release — reference- and inject-mode
      // alike, since the event means "credential disclosed to an agent", not which fields.
      // uploadImmediately: true so the event reaches the server promptly rather than waiting on
      // the 60s upload interval. A collect failure must never turn an approved release into a
      // failed one, so it's awaited but never allowed to propagate.
      try {
        await this.eventCollectionService.collect(
          EventType.Cipher_ClientSharedWithAgent,
          selected.cipher.id,
          true,
        );
      } catch (e) {
        this.logService.error("Agent Access: failed to record a cipher release event", e);
      }
    } else {
      await this.denyCredentialRequest(requestId);
    }
  }

  // Secret analogue of `resolveCredentialRequest` (agent-access-architecture.md, "M4"/"M4c").
  // Unlike the credential path, candidates carry no value — the dialog shows name/org/project only
  // (see `SecretCandidate`'s doc comment; project is carried so same-named secrets in different
  // projects of the same org render distinguishably) — so the response payload is built here,
  // *after* approval, from a fresh single-secret fetch of exactly the id the user selected. This
  // keeps one approved release equal to exactly one server-side `Secret_Retrieved` audit event.
  // `fieldsShared` is always exactly `["value"]` — there is no per-field release for secrets — and
  // the activity outcome carries `secretId`, never `cipherId`.
  private async resolveSecretRequest(
    message: Record<string, unknown>,
    requestId: number,
    candidates: SecretCandidate[],
    userId: UserId,
    truncated: boolean,
  ): Promise<void> {
    const matches: CredentialMatch[] = candidates.map((candidate) => ({
      kind: "secret",
      secretId: candidate.secretId,
      secretName: candidate.name,
      organizationName: candidate.organizationName,
      projectId: candidate.projectId,
      projectName: candidate.projectName,
    }));

    const dialogRef = ApproveCredentialRequestComponent.open(this.dialogService, {
      requesterName: message.requesterName as string | undefined,
      requesterFingerprint: message.requesterFingerprint as string | undefined,
      ...attestedSignatureLookup(message),
      queryType: message.queryType as CredentialQueryType,
      queryValue: message.queryValue as string,
      matches,
      matchesTruncated: truncated,
    });

    const result = await firstValueFrom(dialogRef.closed);
    const selected =
      result != null && result.approved && result.selectedId != null
        ? candidates.find((candidate) => candidate.secretId === result.selectedId)
        : undefined;

    if (selected == null) {
      await this.denyCredentialRequest(requestId);
      return;
    }

    try {
      // Post-approval, single-secret value fetch (agent-access-architecture.md, "M4c" — the
      // server writes a `Secret_Retrieved` audit event for this call, so it must happen only now,
      // and only for the id the user just approved — never for the other, unselected matches).
      const value = await this.agentAccessSecretsService.getSecretValue(
        selected.secretId,
        selected.organizationId,
        userId,
      );

      const response: agent_access.CredentialResponseData = {
        approved: true,
        secretValue: value.value,
        secretId: value.secretId,
        itemName: value.name,
      };
      await ipc.agentAccess.credentialRequestResponse(requestId, response, {
        status: AgentAccessRequestStatus.Shared,
        secretId: value.secretId,
        fieldsShared: ["value"],
      });
    } catch (e) {
      // A fetch failure after approval must not leave the request hanging until the Rust-side
      // 60s timeout — deny with a generic error and tell the user directly, the same pattern
      // `handleCreateRequest` uses for a create failure after approval.
      this.logService.error(
        "Agent Access: failed to fetch an approved Secrets Manager secret value",
        e,
      );
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("errorOccurred"),
      });
      await this.denyCredentialRequest(requestId);
    }
  }

  private isDescribeFillTargetRequest(message: Record<string, unknown>): boolean {
    return (message.operation as string | undefined) === AgentAccessOperation.DescribeFillTarget;
  }

  // Approval-free, vault-free `describeFillTarget` handler (agent-access-architecture.md, "M5",
  // invariant 12): one round-trip to the browser extension, reply with its description of the
  // active tab. Deliberately NO activity row and NO outcome annotation anywhere on this path —
  // an agent is expected to preflight before every fill, so logging approval-free page metadata
  // would flood the activity log with rows no user decision ever touches (the main process
  // correspondingly never opens a Pending row for this operation).
  private async handleDescribeFillTargetRequest(message: Record<string, unknown>): Promise<void> {
    const requestId = message.requestId as number;
    try {
      const description = await this.agentFillBrowserService.describeTarget();
      const response: agent_access.CredentialResponseData = {
        approved: true,
        // Value-free JSON pass-through — the Rust side never reads into it (napi
        // `CredentialResponseData.fillTarget` docs).
        fillTarget: JSON.stringify(description),
      };
      await ipc.agentAccess.credentialRequestResponse(requestId, response);
    } catch (e) {
      // Everything on this path fails as a value-free `error` denial with an actionable detail
      // (M5: "errors -> deny `error` + denialDetail"): no dialog exists to blame a user for.
      this.logService.error("Agent Access: describeFillTarget failed", e);
      const denialDetail =
        e instanceof NoDescribableTargetError
          ? (e.refusal ?? "no-login-form")
          : e instanceof MultipleBrowsersError
            ? FILL_DETAIL_MULTIPLE_BROWSERS
            : FILL_DETAIL_EXTENSION_UNAVAILABLE;
      await this.denyCredentialRequest(requestId, CredentialDenialReason.Error, {
        denialDetail,
        skipOutcome: true,
      });
    }
  }

  // Fill-delivery branch (agent-access-architecture.md, "M5 — Browser fill delivery"), owning
  // everything after candidate lookup: (1) describe round-trip to the extension, (2) desktop-side
  // origin verdict via the shared `LoginUriView.matchesUri` (M5 decision 3), (3) field-plan
  // pre-check from the description, (4) approval dialog (origin dominant, existing picker for
  // multiple matches), (5) post-approval: resolve the current TOTP code, push the fill payload,
  // await per-field outcomes, respond value-free.
  //
  // SECURITY (M5 invariant 8): the `fill()` call below is the ONLY place a credential value ever
  // transits — renderer memory -> IPC -> extension memory -> DOM write. Nothing on this path
  // logs, persists, or echoes the payload; the response to the agent and the activity annotation
  // carry statuses, role names, and ids only.
  private async resolveFillRequest(
    message: Record<string, unknown>,
    requestId: number,
    candidates: CredentialCandidate[],
  ): Promise<void> {
    // (1) What page would this fill actually land on? Asked before any prompt so the mechanical
    // refusals below never show a dialog a human could be phished into overriding (invariant 10).
    let description: AgentFillTargetDescription;
    try {
      description = await this.agentFillBrowserService.describeTarget();
    } catch (e) {
      this.logService.error("Agent Access: fill preflight describe failed", e);
      if (e instanceof NoDescribableTargetError) {
        // The page has no describable login surface at all — that is `noSafeTarget`, with the
        // extension's machine-readable reason as the detail.
        await this.denyCredentialRequest(requestId, CredentialDenialReason.NoSafeTarget, {
          denialDetail: e.refusal ?? "no-login-form",
        });
        return;
      }
      await this.denyCredentialRequest(requestId, CredentialDenialReason.Error, {
        denialDetail:
          e instanceof MultipleBrowsersError
            ? FILL_DETAIL_MULTIPLE_BROWSERS
            : FILL_DETAIL_EXTENSION_UNAVAILABLE,
      });
      return;
    }

    // (2) Origin filter: only candidates whose own saved URIs match the extension-reported
    // active-tab origin may even be offered. Same matcher + equivalent-domain/default-strategy
    // inputs the rest of the client uses (M5 decision 3 — single implementation, desktop-side).
    const [equivalentDomains, defaultMatchStrategy] = await Promise.all([
      firstValueFrom(this.domainSettingsService.getUrlEquivalentDomains(description.origin)),
      firstValueFrom(this.domainSettingsService.resolvedDefaultUriMatchStrategy$),
    ]);
    const originMatched = candidates.filter(
      (candidate) =>
        candidate.cipher.login?.matchesUri(
          description.origin,
          equivalentDomains,
          defaultMatchStrategy,
        ) === true,
    );
    if (originMatched.length === 0) {
      // Mechanical refusal, no dialog (invariant 10). The detail names the origin only — item
      // names are never enumerated (M5: "value-free: message names the origin only").
      await this.denyCredentialRequest(requestId, CredentialDenialReason.OriginMismatch, {
        denialDetail: description.origin,
      });
      return;
    }

    // (3) Field plan: which requested roles have a §4.1-safe target on the page?
    const requestedRoles = this.requestedFillRoles(message, originMatched);
    const plannedByRole = new Map(
      description.candidates.map((candidate) => [candidate.role, candidate]),
    );
    const plannedRoles = requestedRoles.filter((role) => plannedByRole.has(role));
    if (plannedRoles.length === 0) {
      // Mechanical refusal, no dialog: nothing requested is safely fillable. The detail carries
      // the extension's first machine-readable refusal reason.
      await this.denyCredentialRequest(requestId, CredentialDenialReason.NoSafeTarget, {
        denialDetail: description.refusals[0]?.reason ?? "no-login-form",
      });
      return;
    }
    const skippedRoles = requestedRoles
      .filter((role) => !plannedByRole.has(role))
      .map((role) => ({
        role,
        reason:
          description.refusals.find((refusal) => refusal.role === role)?.reason ?? "no-target",
      }));

    // (4) Approval dialog — only now is there something a user can meaningfully approve.
    const matches: CredentialLoginMatch[] = originMatched.map((candidate) => ({
      kind: "credential",
      cipherId: candidate.cipher.id,
      cipherName: candidate.cipher.name,
      username: candidate.cipher.login?.username ?? undefined,
      // Which planned roles this candidate would actually fill (presence flags only).
      fieldsShared: {
        username: plannedRoles.includes("username") && candidate.cipher.login?.username != null,
        password: plannedRoles.includes("password") && candidate.cipher.login?.password != null,
        totp: plannedRoles.includes("totp") && candidate.cipher.login?.totp != null,
        uri: false,
      },
    }));

    ipc.platform.focusWindow();
    const dialogRef = ApproveFillRequestComponent.open(this.dialogService, {
      requesterName: message.requesterName as string | undefined,
      requesterFingerprint: message.requesterFingerprint as string | undefined,
      ...attestedSignatureLookup(message),
      // The extension-reported origin, never anything from the request (invariant 9).
      origin: description.origin,
      matches,
      fieldPlan: plannedRoles.map((role) => ({
        role,
        target: plannedByRole.get(role)!.target,
      })),
      skipped: skippedRoles,
    });

    const result = await firstValueFrom(dialogRef.closed);
    const selected =
      result != null && result.approved && result.selectedId != null
        ? originMatched.find((candidate) => candidate.cipher.id === result.selectedId)
        : undefined;
    if (selected == null) {
      await this.denyCredentialRequest(requestId);
      return;
    }

    // (5) Build the value payload for exactly the selected item. The TOTP *code* is resolved
    // here, post-approval, and only when the role is requested+planned and the item has a seed —
    // the seed itself never leaves this process (M5 decision 9).
    const login = selected.cipher.login;
    const fields: AgentFillFieldRole[] = [];
    const credential: { username?: string; password?: string; totpCode?: string } = {};
    if (plannedRoles.includes("username") && login?.username) {
      fields.push("username");
      credential.username = login.username;
    }
    if (plannedRoles.includes("password") && login?.password) {
      fields.push("password");
      credential.password = login.password;
    }
    if (plannedRoles.includes("totp") && login?.totp) {
      try {
        const totpResponse = await firstValueFrom(this.totpService.getCode$(login.totp));
        if (totpResponse?.code) {
          fields.push("totp");
          credential.totpCode = totpResponse.code;
        }
      } catch (e) {
        // A bad seed shouldn't fail the whole fill — the other fields are still worth filling.
        this.logService.error("Failed to generate a TOTP code for an Agent Access fill request", e);
      }
    }

    let fillResult: AgentFillWireResult;
    try {
      const executed = await this.agentFillBrowserService.fill({
        origin: description.origin,
        targetToken: description.targetToken,
        fields,
        credential,
      });
      fillResult = executed;
    } catch {
      // Post-approval transport failure (extension gone, round-trip timeout). Per §M5 the reply
      // is still `approved` — the user DID approve — with the execution outcome assembled
      // desktop-side. Deliberately no error object logged on this leg: the failure could
      // conceivably stringify the value-bearing request.
      fillResult = { status: "extension-unavailable", origin: description.origin, fields: [] };
    }

    const filledRoles = fillResult.fields
      .filter((field) => field.status === "filled")
      .map((field) => field.role);
    const filledAnything = filledRoles.length > 0;

    const response: agent_access.CredentialResponseData = {
      approved: true,
      // Value-free: the item pointer for the `bw://item/<id>` reference and its display name for
      // the reply's `item` object — never a username/password/TOTP field for fill mode.
      credentialId: selected.cipher.id,
      itemName: selected.cipher.name,
      fillResult: JSON.stringify(fillResult),
      fillFieldsShared: filledRoles,
    };
    await ipc.agentAccess.credentialRequestResponse(requestId, response, {
      status: filledAnything
        ? AgentAccessRequestStatus.Filled
        : AgentAccessRequestStatus.FillFailed,
      // The item's id, never its name (the reference-model invariant) — and only when something
      // was actually filled; a failed fill released nothing to point at.
      cipherId: filledAnything ? selected.cipher.id : undefined,
      fieldsShared: filledRoles,
      fillOrigin: fillResult.origin,
    });

    if (filledAnything) {
      // Server-visible audit trail, mirroring the Cipher_ClientSharedWithAgent pattern (M4c):
      // one Cipher_ClientAutofilledByAgent event per fill that wrote at least one field. A
      // collect failure must never turn a completed fill into a failed one.
      try {
        await this.eventCollectionService.collect(
          EventType.Cipher_ClientAutofilledByAgent,
          selected.cipher.id,
          true,
        );
      } catch (e) {
        this.logService.error("Agent Access: failed to record a cipher autofill event", e);
      }
    }
  }

  // Which field roles a fill request is asking for: the request's own `fillFields` (unknown role
  // names dropped), or — when absent — every role present on at least one origin-matched
  // candidate (M5 wire: "optional; default: all present & safe").
  private requestedFillRoles(
    message: Record<string, unknown>,
    candidates: CredentialCandidate[],
  ): AgentFillFieldRole[] {
    const requested = message.fillFields as string[] | undefined;
    if (Array.isArray(requested) && requested.length > 0) {
      return FILL_FIELD_ROLES.filter((role) => requested.includes(role));
    }
    return FILL_FIELD_ROLES.filter((role) =>
      candidates.some(({ cipher }) =>
        role === "username"
          ? cipher.login?.username != null
          : role === "password"
            ? cipher.login?.password != null
            : cipher.login?.totp != null,
      ),
    );
  }

  // Dispatches every non-"request" operation (agent-access-architecture.md, "M6 — Full Secrets
  // Manager surface") to its own handler, branching on `resourceType` where an operation applies
  // to more than one resource. Fail-closed by construction: any resource/operation combination
  // not explicitly routed below denies rather than falling through to the credential/secret
  // *lookup* path — a malformed or future-version message must never be silently treated as a
  // read.
  private async handleWriteOrListRequest(
    message: Record<string, unknown>,
    userId: UserId,
    operation: string,
  ): Promise<void> {
    const resourceType =
      (message.resourceType as string | undefined) ?? AgentAccessResourceType.Credential;
    const requestId = message.requestId as number;

    switch (operation) {
      case AgentAccessOperation.Create:
        if (resourceType === AgentAccessResourceType.Project) {
          await this.handleProjectCreateRequest(message, userId);
          return;
        }
        if (resourceType === AgentAccessResourceType.Secret) {
          await this.handleCreateRequest(message, userId);
          return;
        }
        break;
      case AgentAccessOperation.Update:
        if (resourceType === AgentAccessResourceType.Secret) {
          await this.handleUpdateSecretRequest(message, userId);
          return;
        }
        if (resourceType === AgentAccessResourceType.Project) {
          await this.handleUpdateProjectRequest(message, userId);
          return;
        }
        break;
      case AgentAccessOperation.Delete:
        if (
          resourceType === AgentAccessResourceType.Secret ||
          resourceType === AgentAccessResourceType.Project
        ) {
          await this.handleDeleteRequest(message, userId, resourceType);
          return;
        }
        break;
      case AgentAccessOperation.List:
        if (resourceType === AgentAccessResourceType.Project) {
          await this.handleProjectListRequest(message, userId);
          return;
        }
        break;
      default:
        break;
    }

    // Unreachable given the caller's own membership check on `operation`, but every unmatched
    // resourceType above falls through here — fail closed rather than silently no-op.
    this.logService.error(
      `Agent Access: unsupported resourceType/operation combination for a write request (resourceType: ${resourceType}, operation: ${operation})`,
    );
    await this.denyCredentialRequest(requestId);
  }

  // Secret-*creation* branch (agent-access-architecture.md, "M4b — secret creation", extended by
  // "M6" for `generateValue`). Unlike the lookup paths above, there is nothing to match against
  // existing data: the proposed name/value/note/project-hint already rode along on `message`
  // (napi's `CredentialRequestData`, `operation: "create"` fields), so this goes straight to the
  // creation-approval dialog rather than through `lookupCandidates`. Owns its own full lifecycle
  // (dialog, project creation, secret creation, respond/deny) since none of it is shared with the
  // read path.
  private async handleCreateRequest(
    message: Record<string, unknown>,
    userId: UserId,
  ): Promise<void> {
    const requestId = message.requestId as number;
    const secretName = message.newSecretName as string | undefined;
    const secretValue = message.newSecretValue as string | undefined;
    const secretNote = message.newSecretNote as string | undefined;
    // M6: a `generate: true` create request carries no `newSecretValue` at all — the value is
    // born inside this handler, at approval time, and never crosses the napi boundary in either
    // direction (agent-access-architecture.md, invariant 14).
    const generate = message.generateValue === true;

    if (!secretName || (!generate && !secretValue)) {
      // Defensive: the wire contract requires a name always, and EXACTLY ONE of value/generate
      // (agent-access-architecture.md, "M4b"/"M6") — this should be unreachable, but deny rather
      // than open a dialog with nothing to show.
      this.logService.error(
        "Agent Access: create request is missing a proposed secret name or value",
      );
      await this.denyCredentialRequest(requestId);
      return;
    }

    const organizations = await this.agentAccessSecretsService.smOrganizations(userId);
    if (organizations.length === 0) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("agentAccessCreateNoSmAccess"),
      });
      await this.denyCredentialRequest(requestId);
      return;
    }

    ipc.platform.focusWindow();

    const dialogRef = CreateSecretRequestComponent.open(this.dialogService, {
      requesterName: message.requesterName as string | undefined,
      requesterFingerprint: message.requesterFingerprint as string | undefined,
      ...attestedSignatureLookup(message),
      secretName,
      secretValue,
      generated: generate
        ? {
            length: message.generateLength as number | undefined,
            symbols: message.generateSymbols as boolean | undefined,
          }
        : undefined,
      secretNote,
      projectHint: message.projectHint as string | undefined,
      organizations,
      userId,
      lastOrganizationId: this.lastCreateOrganizationId,
      lastProjectId: this.lastCreateProjectId,
    });

    const result: CreateSecretRequestResult | undefined = await firstValueFrom(dialogRef.closed);
    if (result == null || !result.approved || result.organizationId == null) {
      await this.denyCredentialRequest(requestId);
      return;
    }

    try {
      // A brand-new project is created first (self-granting the creator read+write, per M4b
      // server facts) so the secret create below always has a concrete project id to send —
      // never a name the server would have to resolve.
      let projectId: string | null = null;
      if (result.newProjectName) {
        const createdProject = await this.agentAccessSecretsService.createProject(
          result.organizationId,
          userId,
          result.newProjectName,
        );
        projectId = createdProject.id;
      } else if (result.projectId) {
        projectId = result.projectId;
      }
      // A `null` projectId here only ever reaches the API when the dialog's admin relaxation
      // allowed it (`CreateSecretRequestComponent` blocks submit otherwise) — `createSecret`
      // sends `projectIds: undefined` in that case, never an empty array (M4b server facts:
      // project-less creates are denied for non-admin users; >1 project is a 400).

      // The generated value is born HERE, at approval time, in this local variable only — it is
      // encrypted by `createSecret` immediately below and then discarded; it never appears in
      // the response sent to main, never in any outcome, never logged (M6, invariant 14).
      const finalValue = generate
        ? await this.agentAccessSecretsService.generateSecretValue({
            length: message.generateLength as number | undefined,
            symbols: message.generateSymbols as boolean | undefined,
          })
        : (secretValue as string);

      const secretId = await this.agentAccessSecretsService.createSecret(
        result.organizationId,
        userId,
        projectId,
        { name: secretName, value: finalValue, note: secretNote },
      );

      // Session-remembered (in-memory only) so the next create in this session preselects the
      // same destination, matching what a returning user would expect.
      this.lastCreateOrganizationId = result.organizationId;
      this.lastCreateProjectId = projectId ?? undefined;

      const response: agent_access.CredentialResponseData = {
        approved: true,
        secretId,
        itemName: secretName,
      };
      await ipc.agentAccess.credentialRequestResponse(requestId, response, {
        status: AgentAccessRequestStatus.Created,
        secretId,
        operation: AgentAccessOperation.Create,
      });
    } catch (e) {
      // API failure after approval: deny with a generic error rather than leaving the request to
      // time out, and tell the user directly — the agent only ever sees a generic denial either
      // way (agent-access-architecture.md, "M4b": "a server-side create failure after approval ->
      // `error` with a generic message").
      this.logService.error("Agent Access: failed to create a Secrets Manager secret", e);
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("agentAccessCreateFailedToast"),
      });
      await this.denyCredentialRequest(requestId);
    }
  }

  // `projectCreate` branch (agent-access-architecture.md, "M6"). Sibling of `handleCreateRequest`
  // for the other creatable resource: no vault/SM lookup, straight to the creation dialog, own
  // full lifecycle. `CreateProjectRequestComponent` in its default (`create`) mode.
  private async handleProjectCreateRequest(
    message: Record<string, unknown>,
    userId: UserId,
  ): Promise<void> {
    const requestId = message.requestId as number;
    // NOTE (contract deviation, flagged for review): the napi `CredentialRequestData` interface
    // documents `newSecretName` as "Only set for `operation: create`" of a *secret* — there is no
    // separate field for a proposed *project* name. The M6 wire protocol requires one for both
    // `projectCreate` and `projectUpdate` (rename), so this reuses `newSecretName` as the generic
    // "proposed name" carrier for project operations too, on the assumption the M6-B napi/Rust
    // implementation populates it that way. If M6-B lands a dedicated field instead, this (and
    // `handleUpdateProjectRequest` below) need to read that field instead.
    const proposedName = message.newSecretName as string | undefined;
    if (!proposedName) {
      this.logService.error("Agent Access: project create request is missing a proposed name");
      await this.denyCredentialRequest(requestId);
      return;
    }

    const organizations = await this.agentAccessSecretsService.smOrganizations(userId);
    if (organizations.length === 0) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("agentAccessCreateNoSmAccess"),
      });
      await this.denyCredentialRequest(requestId);
      return;
    }

    ipc.platform.focusWindow();

    const dialogRef = CreateProjectRequestComponent.open(this.dialogService, {
      requesterName: message.requesterName as string | undefined,
      requesterFingerprint: message.requesterFingerprint as string | undefined,
      ...attestedSignatureLookup(message),
      mode: "create",
      projectName: proposedName,
      organizations,
      userId,
      lastOrganizationId: this.lastCreateOrganizationId,
    });

    const result: CreateProjectRequestResult | undefined = await firstValueFrom(dialogRef.closed);
    if (result == null || !result.approved || result.organizationId == null) {
      await this.denyCredentialRequest(requestId);
      return;
    }

    try {
      const created = await this.agentAccessSecretsService.createProject(
        result.organizationId,
        userId,
        proposedName,
      );
      this.lastCreateOrganizationId = result.organizationId;

      const response: agent_access.CredentialResponseData = {
        approved: true,
        projectId: created.id,
        itemName: created.name,
      };
      await ipc.agentAccess.credentialRequestResponse(requestId, response, {
        status: AgentAccessRequestStatus.Created,
        projectId: created.id,
        operation: AgentAccessOperation.Create,
      });
    } catch (e) {
      this.logService.error("Agent Access: failed to create a Secrets Manager project", e);
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("agentAccessCreateFailedToast"),
      });
      await this.denyCredentialRequest(requestId);
    }
  }

  // `secretUpdate` branch (agent-access-architecture.md, "M6-D"). Unlike create, the target
  // already exists, so this resolves its current state BEFORE the dialog (TOCTOU discipline:
  // what is approved is what was displayed) — locating the org via `findSecrets` by `id` query
  // (the wire message carries no org context of its own), then fetching the ciphertexts needed
  // for a passthrough PUT via `getSecretForUpdate`. The dialog shows a from -> to summary per
  // changed field, never the secret's current value or note.
  private async handleUpdateSecretRequest(
    message: Record<string, unknown>,
    userId: UserId,
  ): Promise<void> {
    const requestId = message.requestId as number;
    const targetId = message.targetId as string | undefined;
    if (!targetId) {
      this.logService.error("Agent Access: secret update request is missing a target id");
      await this.denyCredentialRequest(requestId);
      return;
    }

    // An `Id` query can never truncate (see `matchSecrets`'s doc) — `truncated` is irrelevant here
    // and intentionally ignored.
    const { matches: located } = await this.agentAccessSecretsService.findSecrets(
      CredentialQueryType.Id,
      targetId,
      userId,
    );
    const match = located[0];
    if (match == null) {
      await this.denyCredentialRequest(requestId, CredentialDenialReason.NotFound);
      return;
    }

    let detail;
    try {
      detail = await this.agentAccessSecretsService.getSecretForUpdate(
        targetId,
        match.organizationId,
        userId,
      );
    } catch (e) {
      this.logService.error("Agent Access: failed to fetch a Secrets Manager secret for update", e);
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("agentAccessUpdateFailedToast"),
      });
      await this.denyCredentialRequest(requestId);
      return;
    }

    const proposedName = message.newSecretName as string | undefined;
    const proposedValue = message.newSecretValue as string | undefined;
    const proposedNote = message.newSecretNote as string | undefined;
    const generate = message.generateValue === true;
    const projectHint = message.projectHint as string | undefined;

    const changes: UpdateSecretRequestChanges = {};
    if (proposedName != null && proposedName !== detail.nameDecrypted) {
      changes.name = { from: detail.nameDecrypted, to: proposedName };
    }
    if (generate) {
      changes.value = "generated";
    } else if (proposedValue != null) {
      changes.value = "agent";
    }
    if (proposedNote !== undefined) {
      changes.note = { to: proposedNote };
    }
    if (projectHint) {
      changes.project = { toHint: projectHint };
    }

    if (Object.keys(changes).length === 0) {
      // Defensive: the wire contract requires >= 1 change field — this should be unreachable,
      // but deny rather than open a dialog with nothing to show.
      this.logService.error("Agent Access: secret update request proposes no changes");
      await this.denyCredentialRequest(requestId);
      return;
    }

    // The project picker (and its hint-match preselect) is resolved BEFORE the dialog only when
    // a move was actually proposed — mirrors `CreateSecretRequestComponent`'s hint-preselect
    // discipline: never trusted silently, always shown and changeable.
    let writableProjects: SmProjectMatch[] | undefined;
    let preselectedProjectId: string | undefined;
    if (changes.project != null) {
      const projects = await this.agentAccessSecretsService.listProjects(
        match.organizationId,
        userId,
      );
      writableProjects = projects.filter((project) => project.write);
      preselectedProjectId = writableProjects.find((project) => project.name === projectHint)?.id;
    }

    ipc.platform.focusWindow();
    const dialogRef = UpdateSecretRequestComponent.open(this.dialogService, {
      requesterName: message.requesterName as string | undefined,
      requesterFingerprint: message.requesterFingerprint as string | undefined,
      ...attestedSignatureLookup(message),
      secretName: detail.nameDecrypted,
      organizationName: match.organizationName,
      changes,
      writableProjects,
      preselectedProjectId,
      userId,
    });

    const result: UpdateSecretRequestResult | undefined = await firstValueFrom(dialogRef.closed);
    if (result == null || !result.approved) {
      await this.denyCredentialRequest(requestId);
      return;
    }

    try {
      // The generated value is born HERE, at approval time, in this local variable only — see
      // the identical comment in `handleCreateRequest` (M6, invariant 14).
      let finalValue: string | undefined;
      if (generate) {
        finalValue = await this.agentAccessSecretsService.generateSecretValue({
          length: message.generateLength as number | undefined,
          symbols: message.generateSymbols as boolean | undefined,
        });
      } else if (proposedValue != null) {
        finalValue = proposedValue;
      }
      // `finalValue` left `undefined` means "unchanged" — `updateSecret` passes the original
      // value ciphertext through verbatim in that case, never decrypting it.

      const finalName = changes.name?.to ?? detail.nameDecrypted;

      await this.agentAccessSecretsService.updateSecret(match.organizationId, userId, targetId, {
        keyEncString: detail.keyEncString,
        name: changes.name?.to,
        valueEncString: detail.valueEncString,
        value: finalValue,
        noteEncString: detail.noteEncString,
        note: changes.note?.to,
        projectId: result.projectId,
        // Without this, an update that proposes no move (e.g. a plain value rotation) sends no
        // `projectIds` at all, which the server reads as "unassign" rather than "unchanged" —
        // silently stripping the secret out of its project. See `updateSecret`'s doc comment.
        currentProjectId: detail.currentProjectId,
      });

      const response: agent_access.CredentialResponseData = {
        approved: true,
        secretId: targetId,
        itemName: finalName,
      };
      await ipc.agentAccess.credentialRequestResponse(requestId, response, {
        status: AgentAccessRequestStatus.Updated,
        secretId: targetId,
        operation: AgentAccessOperation.Update,
      });
    } catch (e) {
      // API failure after approval: deny with a generic error rather than leaving the request to
      // time out (mirrors `handleCreateRequest`'s catch).
      this.logService.error("Agent Access: failed to update a Secrets Manager secret", e);
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("agentAccessUpdateFailedToast"),
      });
      await this.denyCredentialRequest(requestId);
    }
  }

  // `projectUpdate` branch (agent-access-architecture.md, "M6-D") — rename only, mirroring the
  // server. Locates the project (and its org) by scanning every SM org's project list, since
  // (like the secret update path) the wire message carries no org context of its own.
  // `CreateProjectRequestComponent` in `rename` mode shows the current -> proposed name.
  private async handleUpdateProjectRequest(
    message: Record<string, unknown>,
    userId: UserId,
  ): Promise<void> {
    const requestId = message.requestId as number;
    const targetId = message.targetId as string | undefined;
    // See the field-reuse note in `handleProjectCreateRequest` — this is the same assumption.
    const proposedName = message.newSecretName as string | undefined;
    if (!targetId || !proposedName) {
      this.logService.error(
        "Agent Access: project rename request is missing a target id or a proposed name",
      );
      await this.denyCredentialRequest(requestId);
      return;
    }

    const located = await this.locateProject(targetId, userId);
    if (located == null) {
      await this.denyCredentialRequest(requestId, CredentialDenialReason.NotFound);
      return;
    }

    ipc.platform.focusWindow();
    const dialogRef = CreateProjectRequestComponent.open(this.dialogService, {
      requesterName: message.requesterName as string | undefined,
      requesterFingerprint: message.requesterFingerprint as string | undefined,
      ...attestedSignatureLookup(message),
      mode: "rename",
      projectName: located.name,
      newProjectName: proposedName,
      organizations: [],
      userId,
    });

    const result: CreateProjectRequestResult | undefined = await firstValueFrom(dialogRef.closed);
    if (result == null || !result.approved) {
      await this.denyCredentialRequest(requestId);
      return;
    }

    try {
      await this.agentAccessSecretsService.updateProject(
        targetId,
        located.organizationId,
        userId,
        proposedName,
      );

      const response: agent_access.CredentialResponseData = {
        approved: true,
        projectId: targetId,
        itemName: proposedName,
      };
      await ipc.agentAccess.credentialRequestResponse(requestId, response, {
        status: AgentAccessRequestStatus.Updated,
        projectId: targetId,
        operation: AgentAccessOperation.Update,
      });
    } catch (e) {
      this.logService.error("Agent Access: failed to rename a Secrets Manager project", e);
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("agentAccessUpdateFailedToast"),
      });
      await this.denyCredentialRequest(requestId);
    }
  }

  // Shared `secretDelete`/`projectDelete` branch (agent-access-architecture.md, "M6-D"):
  // resolves the target's current name (and, for a project, the contained-secret count) BEFORE
  // the confirm-delete dialog, so what's approved is exactly what's displayed. Consequence
  // labeling truthfulness (invariant 17) lives in `ConfirmDeleteRequestComponent`'s copy — this
  // method only resolves state and performs the call.
  private async handleDeleteRequest(
    message: Record<string, unknown>,
    userId: UserId,
    resourceType: typeof AgentAccessResourceType.Secret | typeof AgentAccessResourceType.Project,
  ): Promise<void> {
    const requestId = message.requestId as number;
    const targetId = message.targetId as string | undefined;
    if (!targetId) {
      this.logService.error("Agent Access: delete request is missing a target id");
      await this.denyCredentialRequest(requestId);
      return;
    }

    let itemName: string;
    let organizationId: string;
    let organizationName: string | undefined;
    let containedSecretCount: number | undefined;

    if (resourceType === AgentAccessResourceType.Secret) {
      // An `Id` query can never truncate (see `matchSecrets`'s doc) — `truncated` is irrelevant
      // here and intentionally ignored.
      const { matches: located } = await this.agentAccessSecretsService.findSecrets(
        CredentialQueryType.Id,
        targetId,
        userId,
      );
      const match = located[0];
      if (match == null) {
        await this.denyCredentialRequest(requestId, CredentialDenialReason.NotFound);
        return;
      }
      itemName = match.name;
      organizationId = match.organizationId;
      organizationName = match.organizationName;
    } else {
      const located = await this.locateProject(targetId, userId);
      if (located == null) {
        await this.denyCredentialRequest(requestId, CredentialDenialReason.NotFound);
        return;
      }
      itemName = located.name;
      organizationId = located.organizationId;
      organizationName = located.organizationName;
      containedSecretCount = await this.agentAccessSecretsService.countSecretsInProject(
        targetId,
        organizationId,
        userId,
      );
    }

    ipc.platform.focusWindow();
    const dialogRef = ConfirmDeleteRequestComponent.open(this.dialogService, {
      requesterName: message.requesterName as string | undefined,
      requesterFingerprint: message.requesterFingerprint as string | undefined,
      ...attestedSignatureLookup(message),
      kind: resourceType,
      itemName,
      organizationName,
      containedSecretCount,
    });

    const result: ConfirmDeleteRequestResult | undefined = await firstValueFrom(dialogRef.closed);
    if (result == null || !result.approved) {
      await this.denyCredentialRequest(requestId);
      return;
    }

    try {
      if (resourceType === AgentAccessResourceType.Secret) {
        await this.agentAccessSecretsService.deleteSecret(targetId, organizationId, userId);
      } else {
        await this.agentAccessSecretsService.deleteProject(targetId, organizationId, userId);
      }

      const response: agent_access.CredentialResponseData = {
        approved: true,
        itemName,
        ...(resourceType === AgentAccessResourceType.Secret
          ? { secretId: targetId }
          : { projectId: targetId }),
      };
      await ipc.agentAccess.credentialRequestResponse(requestId, response, {
        status: AgentAccessRequestStatus.Deleted,
        ...(resourceType === AgentAccessResourceType.Secret
          ? { secretId: targetId }
          : { projectId: targetId }),
        operation: AgentAccessOperation.Delete,
      });
    } catch (e) {
      this.logService.error(`Agent Access: failed to delete a Secrets Manager ${resourceType}`, e);
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("agentAccessDeleteFailedToast"),
      });
      await this.denyCredentialRequest(requestId);
    }
  }

  // `projectList` branch (agent-access-architecture.md, "M6-D") — the sole list-shaped release in
  // the whole M6 surface (invariant 16): gathers every readable project across every SM org the
  // user belongs to, capped at `MAX_PROJECT_LIST_ENTRIES`, and releases the full list in one
  // approval. No per-item picker — `ProjectListRequestComponent` enumerates everything that will
  // go out.
  private async handleProjectListRequest(
    message: Record<string, unknown>,
    userId: UserId,
  ): Promise<void> {
    const requestId = message.requestId as number;

    const orgs = await this.agentAccessSecretsService.smOrganizations(userId);
    const entries: { id: string; name: string; write: boolean; organizationName?: string }[] = [];
    for (const org of orgs) {
      if (entries.length >= MAX_PROJECT_LIST_ENTRIES) {
        break;
      }
      const projects = await this.agentAccessSecretsService.listProjects(org.id, userId);
      for (const project of projects) {
        if (entries.length >= MAX_PROJECT_LIST_ENTRIES) {
          break;
        }
        entries.push({
          id: project.id,
          name: project.name,
          write: project.write,
          organizationName: org.name,
        });
      }
    }

    if (entries.length === 0) {
      await this.denyCredentialRequest(requestId, CredentialDenialReason.NotFound);
      return;
    }

    ipc.platform.focusWindow();
    const dialogRef = ProjectListRequestComponent.open(this.dialogService, {
      requesterName: message.requesterName as string | undefined,
      requesterFingerprint: message.requesterFingerprint as string | undefined,
      ...attestedSignatureLookup(message),
      entries: entries.map((entry) => ({
        name: entry.name,
        organizationName: entry.organizationName,
        write: entry.write,
      })),
    });

    const result: ProjectListRequestResult | undefined = await firstValueFrom(dialogRef.closed);
    if (result == null || !result.approved) {
      await this.denyCredentialRequest(requestId);
      return;
    }

    const response: agent_access.CredentialResponseData = {
      approved: true,
      projects: entries.map((entry) => ({
        id: entry.id,
        name: entry.name,
        write: entry.write,
        organization: entry.organizationName,
      })),
    };
    await ipc.agentAccess.credentialRequestResponse(requestId, response, {
      status: AgentAccessRequestStatus.Listed,
      operation: AgentAccessOperation.List,
    });
  }

  // `projectSecretsRequest` branch (agent-access-architecture.md, "M7 — `bws run` parity"): the
  // sole bulk *value* release on the whole Agent Access surface. Resolves the project selector
  // (id or name — the wire message carries `targetId` for the id form, `projectName` for the
  // name form) and enumerates its readable secret NAMES before the dialog (TOCTOU discipline
  // unchanged: what is approved is exactly what was displayed), then fetches VALUES for exactly
  // that displayed id set only after approval — mirroring `resolveSecretRequest`'s post-approval,
  // id-scoped fetch (M4c's per-fetch audit-event discipline), just for many ids at once instead
  // of one.
  private async handleProjectSecretsRequest(
    message: Record<string, unknown>,
    userId: UserId,
  ): Promise<void> {
    const requestId = message.requestId as number;
    const targetId = message.targetId as string | undefined;
    const projectName = message.projectName as string | undefined;

    if (!targetId && !projectName) {
      // Defensive: the wire contract requires exactly one of `project.id`/`project.name`
      // (agent-access-architecture.md, "M7") — this should be unreachable, but deny rather than
      // resolve against an empty selector.
      this.logService.error(
        "Agent Access: project secrets request is missing both a project id and a project name",
      );
      await this.denyCredentialRequest(requestId);
      return;
    }

    const selector = await this.agentAccessSecretsService.resolveProjectSelector(
      { id: targetId, name: projectName },
      userId,
    );
    if (selector == null) {
      // Zero or ambiguous matches — the agent is expected to use `list_projects` and pass an
      // unambiguous reference (agent-access-architecture.md, "M7").
      await this.denyCredentialRequest(requestId, CredentialDenialReason.NotFound);
      return;
    }

    const secrets = await this.agentAccessSecretsService.listSecretsInProject(
      selector.projectId,
      selector.organizationId,
      userId,
    );
    if (secrets.length === 0) {
      // A project with zero readable secrets denies the same way an unresolvable selector does
      // (agent-access-architecture.md, "M7": "no dialog is shown for a release of nothing").
      await this.denyCredentialRequest(requestId, CredentialDenialReason.NotFound);
      return;
    }
    if (secrets.length > MAX_PROJECT_SECRETS_ENTRIES) {
      // Pre-dialog refusal: don't ask a human to approve a release the wire protocol won't
      // perform (agent-access-architecture.md, "M7").
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("agentAccessBulkTooManySecretsToast"),
      });
      await this.denyCredentialRequest(requestId, CredentialDenialReason.Error);
      return;
    }

    ipc.platform.focusWindow();
    const dialogRef = ProjectSecretsRequestComponent.open(this.dialogService, {
      requesterName: message.requesterName as string | undefined,
      requesterFingerprint: message.requesterFingerprint as string | undefined,
      ...attestedSignatureLookup(message),
      projectName: selector.projectName,
      organizationName: selector.organizationName,
      entries: secrets.map((secret) => ({ name: secret.name })),
    });

    const result: ProjectSecretsRequestResult | undefined = await firstValueFrom(dialogRef.closed);
    if (result == null || !result.approved) {
      await this.denyCredentialRequest(requestId);
      return;
    }

    try {
      // Post-approval, id-filtered bulk fetch (agent-access-architecture.md, "M7"/invariant 22):
      // exactly the ids just displayed and approved, never re-resolved from the selector.
      const ids = secrets.map((secret) => secret.secretId);
      const values = await this.agentAccessSecretsService.getSecretValuesByIds(
        ids,
        selector.organizationId,
        userId,
      );

      const response: agent_access.CredentialResponseData = {
        approved: true,
        projectId: selector.projectId,
        itemName: selector.projectName,
        secrets: values.map((value) => ({ id: value.id, name: value.name, value: value.value })),
      };
      await ipc.agentAccess.credentialRequestResponse(requestId, response, {
        status: AgentAccessRequestStatus.Shared,
        projectId: selector.projectId,
        secretIds: values.map((value) => value.id),
        operation: AgentAccessOperation.BulkRequest,
      });
    } catch (e) {
      // API failure after approval: deny with a generic error rather than leaving the request to
      // time out, mirroring `resolveSecretRequest`'s (M4c) and `handleCreateRequest`'s (M4b)
      // identical catch.
      this.logService.error(
        "Agent Access: failed to fetch approved Secrets Manager secret values for a project bulk release",
        e,
      );
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("errorOccurred"),
      });
      await this.denyCredentialRequest(requestId);
    }
  }

  // Shared by `handleUpdateProjectRequest`/`handleDeleteRequest`: finds a project (and its org)
  // by id, scanning every SM org's project list — the wire message carries no org context for a
  // project target, unlike a secret's `findSecrets` seam. Returns `undefined` (never throws) when
  // the project isn't found in any readable org, letting the caller deny with `NotFound`.
  private async locateProject(
    projectId: string,
    userId: UserId,
  ): Promise<{ name: string; organizationId: string; organizationName?: string } | undefined> {
    const orgs = await this.agentAccessSecretsService.smOrganizations(userId);
    for (const org of orgs) {
      const projects = await this.agentAccessSecretsService.listProjects(org.id, userId);
      const match = projects.find((project) => project.id === projectId);
      if (match != null) {
        return { name: match.name, organizationId: org.id, organizationName: org.name };
      }
    }
    return undefined;
  }

  // Grant check + first-use authorization for a local-origin credential request
  // (agent-access-architecture.md, "Grant store (W2b)"). Relay requests never call this — they
  // have no OS-verified peer to key a grant on and keep the (unchanged) pairing-based model.
  //
  // No grant for this attested peer: opens the first-use dialog. Denied -> the request is denied
  // right here, with nothing persisted, and this returns null so the pipeline stage above
  // short-circuits before lookup/approval ever run. Authorized -> the grant is persisted and this
  // falls through. Grant already exists: `lastUsedAt` is refreshed and this falls through
  // immediately, no dialog shown.
  //
  // Either way the returned message carries the attested display name in `requesterName` — a
  // local request never carries one over the wire (see napi's `CredentialRequestData` docs,
  // "`None` for `origin: "local"`") — so the approval dialog opened further down the pipeline
  // (unchanged from W4) shows who is actually asking instead of falling back to a fingerprint
  // local requests don't have.
  //
  // IMPORTANT: the per-request approval dialog still runs after this for every request, granted
  // or not. A grant authorizes the agent to *ask* — it is never a standing "always allow"
  // (agent-access-desktop-plan.md, W5: no such option exists in v1).
  private async authorizeLocalRequest(
    message: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    const requestId = message.requestId as number;
    const localPeer = message.localPeer as agent_access.LocalPeerInfoData | undefined;

    if (localPeer == null) {
      // The local listener always attaches peer attestation for `origin: "local"` requests
      // (agent-access-architecture.md, "Attestation model (W2a)") — this should be unreachable,
      // but deny rather than let a malformed message reach lookup/approval below.
      this.logService.error("Agent Access: local credential request is missing peer attestation");
      await this.denyCredentialRequest(requestId);
      return null;
    }

    const displayName =
      deriveAgentAccessDisplayName(localPeer) ??
      this.i18nService.t("agentAccessUnknownApplication");
    const exePath = localPeer.parent?.exePath ?? localPeer.exePath;
    const key = deriveAgentAccessAttestationKey(localPeer);

    const existingGrant = await ipc.agentAccess.findGrant(key);
    if (existingGrant != null) {
      await this.persistGrant({
        ...key,
        displayName,
        exePath,
        scope: existingGrant.scope,
      });
      return { ...message, requesterName: displayName };
    }

    ipc.platform.focusWindow();
    const dialogRef = FirstUseAuthorizationDialogComponent.open(this.dialogService, {
      displayName,
      exePath,
      signatureKind: localPeer.signature?.kind,
      signatureIdentity: localPeer.signature?.identity,
      signatureValid: localPeer.signature?.valid,
    });

    const result = await firstValueFrom(dialogRef.closed);
    if (result == null || !result.authorized) {
      // Explicit denial (or the dialog closing without a decision): nothing is persisted, so the
      // next request from this peer prompts again rather than silently remembering the refusal.
      await this.denyCredentialRequest(requestId);
      return null;
    }

    await this.persistGrant({
      ...key,
      displayName,
      exePath,
      scope: result.scope ?? AgentAccessGrantScope.AllLogins,
    });
    return { ...message, requesterName: displayName };
  }

  // Writes a grant and tells the renderer's own listeners it changed. The notification is what
  // makes a first-use authorization show up on an Agent Access page that is *already* open: that
  // page holds grants in per-route state fetched when it was entered
  // (`AgentAccessPageStateService`), and a credential request arrives from the main process on its
  // own schedule — nothing about it is tied to the page's lifecycle. Without this the new agent
  // only appeared after the page was navigated away from and back.
  //
  // Both call sites notify, not just the new-grant one: refreshing an existing grant moves its
  // `lastUsedAt`, which the connected-agents table renders as a "last used" column.
  private async persistGrant(input: UpsertAgentAccessGrantInput): Promise<void> {
    await ipc.agentAccess.upsertGrant(input);
    // No payload: the message says "re-read the store", never what changed — the listener holds no
    // grant data of its own to reconcile against, and the store is the only source of truth.
    this.messageSender.send(GRANTS_CHANGED_COMMAND, {});
  }

  private async denyCredentialRequest(
    requestId: number,
    reason: CredentialDenialReason = CredentialDenialReason.Denied,
    options?: {
      /** Machine-readable, value-free detail for `originMismatch`/`noSafeTarget`/`error`
       *  denials (M5) — the mismatched origin, a refusal reason code, or an actionable static
       *  message. Never vault data. */
      denialDetail?: string;
      /** `describeFillTarget` denials carry no outcome annotation: no activity row was ever
       *  opened for a describe (see `handleDescribeFillTargetRequest`). */
      skipOutcome?: boolean;
    },
  ): Promise<void> {
    try {
      const response: agent_access.CredentialResponseData = {
        approved: false,
        reason,
        ...(options?.denialDetail != null ? { denialDetail: options.denialDetail } : {}),
      };
      if (options?.skipOutcome) {
        await ipc.agentAccess.credentialRequestResponse(requestId, response);
        return;
      }
      await ipc.agentAccess.credentialRequestResponse(requestId, response, {
        // The activity log distinguishes a no-match from every other denial the same way the
        // protocol reply does, so "nothing matched" doesn't read as "the user said no" (W4).
        // The fill-mode mechanical refusals (originMismatch/noSafeTarget) and error denials all
        // record as Denied — no dialog was shown, but nothing was released either.
        status:
          reason === CredentialDenialReason.NotFound
            ? AgentAccessRequestStatus.NotFound
            : AgentAccessRequestStatus.Denied,
      });
    } catch (e) {
      this.logService.error("Failed to deny Agent Access credential request", e);
    }
  }

  // Branches the lookup step on `message.resourceType` (agent-access-architecture.md, "M4"):
  // a Secrets Manager secret request routes to `lookupSecret`, everything else (including a
  // relay request, which is always `"credential"`) keeps the existing `lookupCredential` path
  // unchanged. This is the only branch point — everything above it (enable gate, unlock gate,
  // grant/first-use) and below it (deny paths, `concatMap` queueing) is shared.
  private async lookupCandidates(
    message: Record<string, unknown>,
    userId: UserId,
  ): Promise<ResolvedCandidates> {
    if ((message.resourceType as string | undefined) === AgentAccessResourceType.Secret) {
      const { candidates, truncated } = await this.lookupSecret(message, userId);
      return { resourceType: AgentAccessResourceType.Secret, candidates, truncated };
    }
    const { candidates, truncated } = await this.lookupCredential(message, userId);
    return { resourceType: AgentAccessResourceType.Credential, candidates, truncated };
  }

  // Looks up every active Login cipher matching the request's query and, for each, builds the
  // (unapproved) response payload it would receive if selected. Building every candidate's
  // payload before the dialog opens preserves the invariant that what's approved is exactly
  // what's released. Returns an empty array when nothing matches, which the caller treats as an
  // automatic "not found" deny with no approval dialog. NEVER logs the returned responses — they
  // may carry live passwords. `truncated` passes `findCiphers`'s cap signal straight through so
  // the approval dialog can report it truthfully (see `ResolvedCandidates`'s doc).
  private async lookupCredential(
    message: Record<string, unknown>,
    userId: UserId,
  ): Promise<{ candidates: CredentialCandidate[]; truncated: boolean }> {
    const queryType = message.queryType as CredentialQueryType;
    const queryValue = message.queryValue as string;

    const { ciphers, truncated } = await this.findCiphers(queryType, queryValue, userId);
    const candidates = await Promise.all(ciphers.map((cipher) => this.buildCandidate(cipher)));
    return { candidates, truncated };
  }

  // Secrets Manager analogue of `lookupCredential` (agent-access-architecture.md, "M4"/"M4c").
  // Finds every readable secret matching the query — name/org only, no values (see
  // `AgentAccessSecretsService.findSecrets`'s doc comment) — so this is safe to call for every
  // incoming request regardless of whether anything ends up approved: unlike the credential path,
  // a value is fetched only once, after approval, for the single selected secret (see
  // `resolveSecretRequest`), so that the server's per-fetch `Secret_Retrieved` audit event stays
  // accurate. Returns an empty array when nothing matches (or the user has no Secrets Manager
  // access), which the caller treats as an automatic "not found" deny.
  //
  // `truncated` now passes straight through from `findSecrets`, which computes it exactly the
  // same way `findCiphers` (below, same file) does for the credential path — `findSecrets`'s
  // internal `matchSecrets` sees the full, uncapped candidate list before it applies
  // `MAX_SM_MATCHES`, so it's an exact signal, not a guess from `matches.length` landing on the
  // cap.
  private async lookupSecret(
    message: Record<string, unknown>,
    userId: UserId,
  ): Promise<{ candidates: SecretCandidate[]; truncated: boolean }> {
    const queryType = message.queryType as CredentialQueryType;
    const queryValue = message.queryValue as string;

    const { matches, truncated } = await this.agentAccessSecretsService.findSecrets(
      queryType,
      queryValue,
      userId,
    );
    const candidates = matches.map((match) => ({
      secretId: match.secretId,
      name: match.name,
      organizationId: match.organizationId,
      organizationName: match.organizationName,
      projectId: match.projectId,
      projectName: match.projectName,
    }));
    return { candidates, truncated };
  }

  private async buildCandidate(cipher: CipherView): Promise<CredentialCandidate> {
    const login = cipher.login;
    let totp: string | undefined;
    if (login?.totp) {
      try {
        const totpResponse = await firstValueFrom(this.totpService.getCode$(login.totp));
        totp = totpResponse?.code;
      } catch (e) {
        // Missing/invalid TOTP seeds shouldn't fail the whole credential response — the other
        // fields are still useful to the requester.
        this.logService.error("Failed to generate a TOTP code for an Agent Access request", e);
      }
    }

    return {
      cipher,
      response: {
        approved: true,
        username: login?.username ?? undefined,
        password: login?.password ?? undefined,
        totp,
        uri: login?.uris?.[0]?.uri ?? undefined,
        // `notes` is deliberately never included — it frequently carries unrelated secrets, and
        // per-field release control (grant-store opt-in) hasn't landed yet.
        credentialId: cipher.id,
      },
    };
  }

  // Returns every active Login cipher matching the query, capped at MAX_CREDENTIAL_MATCHES, plus
  // whether the cap actually cut off further matches — this is the one place that both applies
  // the cap and can see the pre-cap count, so it's the exact (not heuristic) source for
  // `ResolvedCandidates.truncated` on the credential path (contrast `lookupSecret`, which cannot
  // get an equally exact signal without reaching into `agent-access-secrets.service.ts`). Domain
  // /Id queries are ordered by the underlying lookup; Search ranks exact name matches before
  // substring matches, with duplicates removed. Returning `{ ciphers, truncated }` rather than
  // just `CipherView[]` is a pure reporting addition — the returned `ciphers` list, its order, and
  // which items match are unchanged from before.
  private async findCiphers(
    queryType: CredentialQueryType,
    queryValue: string,
    userId: UserId,
  ): Promise<{ ciphers: CipherView[]; truncated: boolean }> {
    const isActiveLogin = (c: CipherView) =>
      c.type === CipherType.Login && !c.isDeleted && !c.isArchived;

    switch (queryType) {
      case CredentialQueryType.Domain: {
        const url = /^[a-z][a-z0-9+.-]*:\/\//i.test(queryValue)
          ? queryValue
          : `https://${queryValue}`;
        const matches = await this.cipherService.getAllDecryptedForUrl(url, userId);
        const filtered = matches.filter(isActiveLogin);
        return {
          ciphers: filtered.slice(0, MAX_CREDENTIAL_MATCHES),
          truncated: filtered.length > MAX_CREDENTIAL_MATCHES,
        };
      }
      case CredentialQueryType.Id: {
        const all = await this.cipherService.getAllDecrypted(userId);
        const match = all.find((c) => c.id === queryValue && isActiveLogin(c));
        return { ciphers: match != null ? [match] : [], truncated: false };
      }
      case CredentialQueryType.Search: {
        const all = (await this.cipherService.getAllDecrypted(userId)).filter(isActiveLogin);
        const lowerQuery = queryValue.toLowerCase();

        const ordered: CipherView[] = [];
        const seenIds = new Set<string>();
        // Previously returned as soon as the cap was hit — a pure optimization, since no further
        // item would ever have been pushed past that point anyway. Kept scanning (instead of
        // returning) so a match found after the cap can still flip `truncated`, without changing
        // which items land in `ordered` or their order.
        let truncated = false;
        const addMatches = (predicate: (c: CipherView) => boolean) => {
          for (const cipher of all) {
            if (cipher.id == null || seenIds.has(cipher.id) || !predicate(cipher)) {
              continue;
            }
            if (ordered.length >= MAX_CREDENTIAL_MATCHES) {
              truncated = true;
              continue;
            }
            seenIds.add(cipher.id);
            ordered.push(cipher);
          }
        };

        addMatches((c) => c.name?.toLowerCase() === lowerQuery);
        addMatches((c) => !!c.name?.toLowerCase().includes(lowerQuery));
        return { ciphers: ordered, truncated };
      }
      default:
        return { ciphers: [], truncated: false };
    }
  }

  // Starts the agent server unless it is already running.
  private async ensureAgentRunning(): Promise<void> {
    try {
      if (!(await ipc.agentAccess.isLoaded())) {
        await ipc.agentAccess.init({ relayUrl: DEFAULT_RELAY_URL });
      }
    } catch (e) {
      this.logService.error("Failed to start the Agent Access server", e);
    }
  }

  // Stops the agent server if it is running.
  private async stopAgent(): Promise<void> {
    try {
      if (await ipc.agentAccess.isLoaded()) {
        await ipc.agentAccess.stop();
      }
    } catch (e) {
      this.logService.error("Failed to stop the Agent Access server", e);
    }
  }
}
