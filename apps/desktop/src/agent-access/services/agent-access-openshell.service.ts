import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { EventCollectionService, EventType } from "@bitwarden/common/dirt/event-logs";
import { DeviceType } from "@bitwarden/common/enums";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CommandDefinition, MessageSender } from "@bitwarden/common/platform/messaging";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";
import type { agent_access } from "@bitwarden/desktop-napi";

import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";
import {
  ApproveOpenShellResolveComponent,
  ApproveOpenShellResolveMode,
  ApproveOpenShellResolveParams,
} from "../components/approve-openshell-resolve.component";
import {
  AgentAccessRequestStatus,
  CredentialRequestOutcome,
} from "../models/agent-access-activity";
import {
  AgentAccessGrant,
  AgentAccessGrantScope,
  AgentAccessOpenShellGrantDetails,
} from "../models/agent-access-grant";
import { CredentialDenialReason } from "../models/credential-denial-reason";
import { CredentialQueryType } from "../models/credential-query-type";
import { AGENT_ACCESS_IPC_CHANNELS } from "../models/ipc-channels";
import {
  OPENSHELL_CARRY_WINDOW_MS,
  OPENSHELL_DELIVERED_DEDUPE_MS,
  OPENSHELL_DIALOG_MAX_MS,
  OPENSHELL_PER_REQUEST_WINDOW_MS,
  OPENSHELL_TTL_REUSE_MARGIN_MS,
  OpenShellApprovalLifetime,
  OpenShellLifetimeMode,
  OpenShellProviderTarget,
  OpenShellRequestContext,
} from "../models/openshell";
import {
  deriveAgentAccessAttestationKey,
  deriveAgentAccessDisplayName,
} from "../utils/agent-access-attestation.util";
import { openShellCoalescingKey } from "../utils/openshell-coalescing-key.util";
import { computeOpenShellPolicyDigest } from "../utils/openshell-policy-digest.util";

import { AgentAccessSecretsService } from "./agent-access-secrets.service";
import { OpenShellResolveCoalescer, OpenShellWaitResult } from "./openshell-resolve-coalescer";

// Value-free, actionable `denialDetail`s relayed to aac (and from there to the gateway's gRPC
// status). Not localized: they go to a machine, not to the UI.
export const OPENSHELL_DETAIL_OFF = "OpenShell integration is off";
export const OPENSHELL_DETAIL_MISSING_CONTEXT = "OpenShell request is missing required context";
export const OPENSHELL_DETAIL_DIGEST_MISMATCH = "policy fingerprint mismatch";
export const OPENSHELL_DETAIL_REPROMPT =
  "This item requires master password re-prompt and can't be used by OpenShell";
export const OPENSHELL_DETAIL_HIDDEN_PASSWORD =
  "This item's password is hidden from you and can't be used by OpenShell";
export const OPENSHELL_DETAIL_FAILED = "Request could not be completed";

/** See `GRANTS_CHANGED` in models/ipc-channels.ts. */
const GRANTS_CHANGED_COMMAND = new CommandDefinition<Record<string, never>>(
  AGENT_ACCESS_IPC_CHANNELS.GRANTS_CHANGED,
);

/** Below this much remaining deadline the dialog isn't worth opening: the gateway will have
 *  given up before a human can read it. */
const MIN_DIALOG_DEADLINE_MS = 3_000;

/** With a Secrets Manager target the value is fetched over the network after Approve, so the
 *  dialog closes this much earlier than the deadline to leave time for the fetch. */
const SECRET_FETCH_RESERVE_MS = 5_000;

/** Longest span from opening a dialog to the last reply that may carry its decision (§M8.18). */
const DECISION_USE_SPAN_MS =
  OPENSHELL_DIALOG_MAX_MS + OPENSHELL_CARRY_WINDOW_MS + OPENSHELL_DELIVERED_DEDUPE_MS;

/** The reply must be on its way this long before Rust's own timeout (`deadlineMs` from when main
 *  handed the request over) fires; later than that, nothing is sent and nothing is recorded. */
const REPLY_MARGIN_MS = 1_000;

/** What `handle` decided: the response for Rust plus the activity-log annotation. The response
 *  may carry live values — the caller sends it and drops it; nothing else may read it. */
export interface OpenShellHandleResult {
  response: agent_access.CredentialResponseData;
  outcome: CredentialRequestOutcome;
  /** Approved only: persists the grant and records the release events. The caller runs it only
   *  once main confirms the reply reached a request Rust was still waiting for, so a reply that
   *  arrived too late opens no ttl window and logs no release. */
  onDelivered?: () => Promise<void>;
  /** Set for the request that opened the coalesced dialog: settles when that dialog has closed.
   *  The caller holds the serialized renderer pipeline until then (§M8.18), so no other approval
   *  dialog stacks on top of it while identical retries attach to it. */
  holdUntil?: Promise<void>;
}

/** One target with everything the dialog shows and, for items, the value already resolved. */
interface ResolvedTarget {
  target: OpenShellProviderTarget;
  label: string;
  fieldLabel: string;
  /** Items: resolved before the dialog. Secrets: fetched after approval (§M4c retrieval trail). */
  itemValue?: string;
  cipherId?: string;
  secret?: { secretId: string; organizationId: string };
}

type TargetResolution =
  | { kind: "ok"; targets: ResolvedTarget[] }
  | { kind: "notFound" }
  | { kind: "reprompt" }
  | { kind: "hiddenPassword" };

/**
 * Handles one `origin: "openshell"`, `operation: "providerResolve"` request
 * (agent-access-architecture.md, §M8.9). The steps run in a fixed order and every failure before
 * the dialog fails closed without one:
 *
 * 1. setting on, darwin/linux;  2. context, targets and attested gateway present;
 * 3. policy digest recomputed over the endpoints about to be shown;  4. every target resolved;
 * 5. grant + lifetime select the dialog mode;  6. one combined dialog;  7. approve → lifetime,
 * grant upsert, values in target order;  8. deny/timeout/close → no values.
 *
 * A grant is the right to *ask*. Every credential load gets a human decision; §M8.18 lets the
 * identical retries and the second resolve of one load share it (`OpenShellResolveCoalescer`):
 * they attach to the open dialog or take its carried / just-delivered decision. No layer caches
 * a value — they are resolved again for each request and live only in its closure.
 */
@Injectable({ providedIn: "root" })
export class AgentAccessOpenShellService {
  private readonly desktopSettingsService = inject(DesktopSettingsService);
  private readonly cipherService = inject(CipherService);
  private readonly agentAccessSecretsService = inject(AgentAccessSecretsService);
  private readonly dialogService = inject(DialogService);
  private readonly cryptoFunctionService = inject(CryptoFunctionService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly eventCollectionService = inject(EventCollectionService);
  private readonly messageSender = inject(MessageSender);

  /** In memory only; holds decisions and open dialogs, never values (§M8.18). */
  private readonly coalescer = new OpenShellResolveCoalescer(() => this.now());

  /** Test seam for the clock. */
  protected now(): number {
    return Date.now();
  }

  /**
   * `mayOpenDialog: false` is for a request handled outside the serialized pipeline (see
   * `canAnswerWithoutQueue`): if its carried decision or dialog is gone by the time it gets
   * here, it times out rather than open a dialog that could stack on another one.
   */
  async handle(
    message: Record<string, unknown>,
    userId: UserId,
    { mayOpenDialog = true }: { mayOpenDialog?: boolean } = {},
  ): Promise<OpenShellHandleResult> {
    // 1. Setting and platform.
    const enabled = await firstValueFrom(this.desktopSettingsService.agentAccessOpenShellEnabled$);
    if (!enabled || !this.platformSupported()) {
      return this.fail(CredentialDenialReason.Error, OPENSHELL_DETAIL_OFF);
    }

    // 2. Context, targets and the attested gateway.
    const context = message.openshell as OpenShellRequestContext | undefined;
    const targets = message.providerTargets as OpenShellProviderTarget[] | undefined;
    const localPeer = message.localPeer as agent_access.LocalPeerInfoData | undefined;
    if (
      context == null ||
      !Array.isArray(context.endpoints) ||
      targets == null ||
      !Array.isArray(targets) ||
      targets.length === 0 ||
      localPeer?.parent == null ||
      localPeer.signature == null
    ) {
      return this.fail(CredentialDenialReason.Error, OPENSHELL_DETAIL_MISSING_CONTEXT);
    }

    // 3. The fingerprint the user approves is the list the user sees.
    let digest: string;
    try {
      digest = await computeOpenShellPolicyDigest(this.cryptoFunctionService, context.endpoints);
    } catch (e) {
      this.logService.error("Agent Access: failed to compute an OpenShell policy digest", e);
      return this.fail(CredentialDenialReason.Error, OPENSHELL_DETAIL_FAILED);
    }
    if (digest !== context.policyDigest) {
      return this.fail(CredentialDenialReason.Error, OPENSHELL_DETAIL_DIGEST_MISMATCH);
    }

    // 4. Resolve every target before any dialog.
    let resolution: TargetResolution;
    try {
      resolution = await this.resolveTargets(targets, userId);
    } catch (e) {
      this.logService.error("Agent Access: OpenShell target lookup failed", e);
      return this.fail(CredentialDenialReason.Error, OPENSHELL_DETAIL_FAILED);
    }
    if (resolution.kind === "reprompt") {
      return this.fail(CredentialDenialReason.Denied, OPENSHELL_DETAIL_REPROMPT);
    }
    if (resolution.kind === "hiddenPassword") {
      return this.fail(CredentialDenialReason.Denied, OPENSHELL_DETAIL_HIDDEN_PASSWORD);
    }
    if (resolution.kind === "notFound") {
      return this.fail(CredentialDenialReason.NotFound);
    }

    // How much of the gateway's deadline is left once this request reaches the front of the
    // (serialized) renderer pipeline.
    const receivedAtMs =
      typeof message.receivedAtMs === "number" ? message.receivedAtMs : this.now();
    const replyByMs = receivedAtMs + context.deadlineMs - REPLY_MARGIN_MS;
    const hasSecretTargets = resolution.targets.some((resolved) => resolved.secret != null);
    // The decision must come early enough to leave room for a post-approval secret fetch.
    const decisionByMs = hasSecretTargets ? replyByMs - SECRET_FETCH_RESERVE_MS : replyByMs;
    const key = openShellCoalescingKey(userId, message);
    if (key == null) {
      return this.fail(CredentialDenialReason.Error, OPENSHELL_DETAIL_MISSING_CONTEXT);
    }

    // §M8.18: an identical request is answered from a carried decision, or attaches to the
    // dialog that is already open for it. Only otherwise does it open a dialog of its own.
    let waited: OpenShellWaitResult;
    let holdUntil: Promise<void> | undefined;
    if (this.coalescer.isKnown(key)) {
      waited = await this.coalescer.wait(key, decisionByMs);
    } else {
      // Too little time left (or not allowed to open one) → time out without a dialog nobody
      // can answer. The supervisor's retry gets a fresh chance.
      if (!mayOpenDialog || decisionByMs - this.now() < MIN_DIALOG_DEADLINE_MS) {
        return this.fail(CredentialDenialReason.Timeout);
      }

      // 5. Grant + lifetime setting → dialog mode.
      const grantKey = deriveAgentAccessAttestationKey(localPeer, {
        gatewayEndpoint: context.gatewayEndpoint,
        sandboxId: context.sandboxId,
        providerId: context.providerId,
      });
      const grant = await ipc.agentAccess.findGrant(grantKey);
      const setting = await firstValueFrom(
        this.desktopSettingsService.agentAccessOpenShellApprovalLifetime$,
      );
      const mode = this.selectMode(grant, context, setting);

      // 6. One combined dialog, shared with any identical retry.
      const params: Omit<ApproveOpenShellResolveParams, "deadlineMs"> = {
        mode,
        gatewayIdentity: {
          signatureKind: localPeer.signature.kind,
          signatureIdentity: localPeer.signature.identity,
          exePath: localPeer.parent.exePath,
          signatureValid: localPeer.signature.valid,
        },
        context,
        targets: resolution.targets.map(({ target, label, fieldLabel }) => ({
          credentialKey: target.credentialKey,
          label,
          fieldLabel,
        })),
        previousPolicyDigest: mode === "policyChanged" ? grant?.openshell?.policyDigest : undefined,
        lifetime: this.previewLifetime(mode, grant, setting),
      };
      const opened = this.coalescer.open(
        key,
        decisionByMs,
        (initialRemainingMs, deadlineUpdates) => {
          ipc.platform.focusWindow();
          const dialogRef = ApproveOpenShellResolveComponent.open(this.dialogService, {
            ...params,
            deadlineMs: initialRemainingMs,
            deadlineUpdates,
          });
          return {
            closed: firstValueFrom(dialogRef.closed, { defaultValue: undefined }),
            close: () => void dialogRef.close?.(),
          };
        },
        // The released lifetime is fixed when the user approves.
        () => this.approvalLifetime(mode, grant, setting),
      );
      holdUntil = opened.closed;
      waited = await opened.result;
    }

    // 8. Anything but an approval releases nothing.
    if (waited.kind === "timeout") {
      return { ...this.fail(CredentialDenialReason.Timeout), holdUntil };
    }
    const carried = waited.carried;
    if (carried.decision.kind !== "approved") {
      return { ...this.fail(CredentialDenialReason.Denied), holdUntil };
    }

    // 7. Approved: the decided lifetime, values (resolved for *this* request) in target order.
    const lifetime = carried.decision.lifetime;
    const values: agent_access.ProviderValueData[] = [];
    for (const resolved of resolution.targets) {
      let value: string | undefined = resolved.itemValue;
      if (resolved.secret != null) {
        try {
          // One released reply == one server-side retrieval event (M4c).
          const fetched = await this.agentAccessSecretsService.getSecretValue(
            resolved.secret.secretId,
            resolved.secret.organizationId,
            userId,
          );
          value = fetched.value;
        } catch (e) {
          this.logService.error("Agent Access: failed to fetch an approved OpenShell secret", e);
          return { ...this.fail(CredentialDenialReason.Error, OPENSHELL_DETAIL_FAILED), holdUntil };
        }
      }
      if (value == null || value.length === 0) {
        return { ...this.fail(CredentialDenialReason.Error, OPENSHELL_DETAIL_FAILED), holdUntil };
      }
      values.push({ credentialKey: resolved.target.credentialKey, value });
    }

    // Too late for Rust to still be waiting: send nothing, record nothing. The decision stays
    // carried for the supervisor's retry.
    if (this.now() > replyByMs) {
      return { ...this.fail(CredentialDenialReason.Timeout), holdUntil };
    }

    return {
      response: {
        approved: true,
        openshellValues: values,
        openshellLifetime: {
          mode: this.toNapiLifetimeMode(lifetime.mode),
          ...(lifetime.expiresAtMs != null ? { expiresAtMs: `${lifetime.expiresAtMs}` } : {}),
        },
      },
      outcome: { status: AgentAccessRequestStatus.Shared },
      // Grant and release events once per approval: only the first confirmed delivery of this
      // decision records them; a deduplicated second resolve of the same load records nothing.
      onDelivered: async () => {
        if (!this.coalescer.markDelivered(carried)) {
          return;
        }
        await this.persistGrant(localPeer, context, lifetime);
        await this.recordReleaseEvents(resolution.targets);
      },
      holdUntil,
    };
  }

  /**
   * §M8.18: whether `message` would be answered from a carried decision or by attaching to an
   * open dialog — so the caller can handle it at once, outside the serialized pipeline (which is
   * held by that very dialog). Synchronous and value-free.
   */
  canAnswerWithoutQueue(message: Record<string, unknown>, userId: UserId): boolean {
    const key = openShellCoalescingKey(userId, message);
    return key != null && this.coalescer.isKnown(key);
  }

  /** §M8.18: drops every carried decision and closes every coalesced dialog (lock, logout,
   *  account switch, Agent Access or OpenShell toggled off). */
  resetCoalescing(): void {
    this.coalescer.clear();
  }

  private platformSupported(): boolean {
    const platform = ipc.platform;
    return (
      (platform.deviceType === DeviceType.MacOsDesktop ||
        platform.deviceType === DeviceType.LinuxDesktop) &&
      !platform.isSnapStore &&
      !platform.isAppImage
    );
  }

  private fail(reason: CredentialDenialReason, detail?: string): OpenShellHandleResult {
    return {
      response: {
        approved: false,
        reason,
        ...(detail != null ? { denialDetail: detail } : {}),
      },
      outcome: {
        status:
          reason === CredentialDenialReason.NotFound
            ? AgentAccessRequestStatus.NotFound
            : AgentAccessRequestStatus.Denied,
      },
    };
  }

  /**
   * Resolves items by id (login, not deleted or archived, non-empty requested field, no master
   * password reprompt, password only when the user may view it) and secrets by id (value-less here). Any reprompt item wins over a miss
   * (so the user learns why), and any miss refuses the whole batch — OpenShell batches are
   * all-or-nothing.
   */
  private async resolveTargets(
    targets: OpenShellProviderTarget[],
    userId: UserId,
  ): Promise<TargetResolution> {
    const needsCiphers = targets.some((target) => target.resourceType === "credential");
    const ciphers: CipherView[] = needsCiphers
      ? await this.cipherService.getAllDecrypted(userId)
      : [];

    const resolved: ResolvedTarget[] = [];
    let missing = false;
    for (const target of targets) {
      if (target.resourceType === "credential") {
        if (target.field !== "username" && target.field !== "password") {
          missing = true;
          continue;
        }
        const cipher = ciphers.find(
          (c) => c.id === target.id && c.type === CipherType.Login && !c.isDeleted && !c.isArchived,
        );
        if (cipher == null) {
          missing = true;
          continue;
        }
        if (cipher.reprompt !== CipherRepromptType.None) {
          return { kind: "reprompt" };
        }
        // "Can view, except passwords": releasing the password to a sandbox would hand the user
        // (through the gateway or supervisor) a value their organization hides from them.
        if (target.field === "password" && cipher.viewPassword !== true) {
          return { kind: "hiddenPassword" };
        }
        const value = target.field === "username" ? cipher.login?.username : cipher.login?.password;
        if (value == null || value.length === 0) {
          missing = true;
          continue;
        }
        resolved.push({
          target,
          label: cipher.name,
          fieldLabel: this.i18nService.t(
            target.field === "username"
              ? "agentAccessOpenShellFieldUsername"
              : "agentAccessOpenShellFieldPassword",
          ),
          itemValue: value,
          cipherId: cipher.id,
        });
      } else if (target.resourceType === "secret" && target.field === "value") {
        const matches = await this.agentAccessSecretsService.findSecrets(
          CredentialQueryType.Id,
          target.id,
          userId,
        );
        const match = matches.find((candidate) => candidate.secretId === target.id);
        if (match == null) {
          missing = true;
          continue;
        }
        resolved.push({
          target,
          label: match.name,
          fieldLabel: this.i18nService.t("agentAccessOpenShellFieldSecret"),
          secret: { secretId: match.secretId, organizationId: match.organizationId },
        });
      } else {
        missing = true;
      }
    }
    return missing ? { kind: "notFound" } : { kind: "ok", targets: resolved };
  }

  /**
   * §M8.6 dialog-mode rules. A ttl window is reused only while it outlasts everything that can
   * pass between opening the dialog and the last reply that may carry the decision (the longest
   * coalesced dialog, the carry window and the dedupe window, §M8.18) plus the 30 s the Rust reply
   * builder requires — so a reused window can never expire before a reply that uses it.
   */
  private selectMode(
    grant: AgentAccessGrant | null,
    context: OpenShellRequestContext,
    setting: OpenShellApprovalLifetime,
  ): ApproveOpenShellResolveMode {
    const details = grant?.openshell;
    if (grant == null || details == null) {
      return "firstRequest";
    }
    if (details.policyDigest !== context.policyDigest) {
      return "policyChanged";
    }
    // An expired ttl grant always needs a fresh approval, whatever the setting is now; a ttl
    // setting over a non-ttl grant must open a new window the same way.
    if (
      (details.lifetimeMode === "ttl" || setting.mode === "ttl") &&
      !this.windowStillOpen(details)
    ) {
      return "windowExpired";
    }
    return "previouslyApproved";
  }

  private windowStillOpen(details: AgentAccessOpenShellGrantDetails): boolean {
    return (
      details.lifetimeMode === "ttl" &&
      details.windowExpiresAtMs != null &&
      details.windowExpiresAtMs > this.now() + OPENSHELL_TTL_REUSE_MARGIN_MS + DECISION_USE_SPAN_MS
    );
  }

  /** What the dialog states before approval (re-computed at approval time). */
  private previewLifetime(
    mode: ApproveOpenShellResolveMode,
    grant: AgentAccessGrant | null,
    setting: OpenShellApprovalLifetime,
  ): ApproveOpenShellResolveParams["lifetime"] {
    const lifetime = this.approvalLifetime(mode, grant, setting);
    if (lifetime.mode !== "ttl") {
      return lifetime;
    }
    // A reused window is not extended: state its end only, never the setting's full duration.
    const reusedWindow =
      mode === "previouslyApproved" && grant?.openshell?.windowExpiresAtMs != null;
    return reusedWindow
      ? { ...lifetime, reusedWindow: true }
      : { ...lifetime, ttlMinutes: setting.ttlMinutes };
  }

  /** §M8.6: the lifetime released with an approval. A reused ttl window is never extended. */
  private approvalLifetime(
    mode: ApproveOpenShellResolveMode,
    grant: AgentAccessGrant | null,
    setting: OpenShellApprovalLifetime,
  ): { mode: OpenShellLifetimeMode; expiresAtMs?: number } {
    const now = this.now();
    switch (setting.mode) {
      case "perRequest":
        return { mode: "perRequest", expiresAtMs: now + OPENSHELL_PER_REQUEST_WINDOW_MS };
      case "ttl": {
        const window = grant?.openshell?.windowExpiresAtMs;
        if (mode === "previouslyApproved" && window != null) {
          return { mode: "ttl", expiresAtMs: window };
        }
        return { mode: "ttl", expiresAtMs: now + setting.ttlMinutes * 60_000 };
      }
      case "sandboxLifetime":
        return { mode: "sandboxLifetime" };
    }
  }

  private async persistGrant(
    localPeer: agent_access.LocalPeerInfoData,
    context: OpenShellRequestContext,
    lifetime: { mode: OpenShellLifetimeMode; expiresAtMs?: number },
  ): Promise<void> {
    const details: AgentAccessOpenShellGrantDetails = {
      gatewayEndpoint: context.gatewayEndpoint,
      sandboxId: context.sandboxId,
      providerId: context.providerId,
      gatewayName: context.gatewayName,
      sandboxName: context.sandboxName,
      providerName: context.providerName,
      policyDigest: context.policyDigest,
      lifetimeMode: lifetime.mode,
      ...(lifetime.mode === "ttl" ? { windowExpiresAtMs: lifetime.expiresAtMs } : {}),
    };
    const key = deriveAgentAccessAttestationKey(localPeer, details);
    try {
      await ipc.agentAccess.upsertGrant({
        ...key,
        displayName:
          deriveAgentAccessDisplayName(localPeer) ??
          this.i18nService.t("agentAccessUnknownApplication"),
        exePath: localPeer.parent?.exePath ?? localPeer.exePath,
        scope: AgentAccessGrantScope.OpenShellSandbox,
        openshell: details,
      });
      this.messageSender.send(GRANTS_CHANGED_COMMAND, {});
    } catch (e) {
      // A failed write only means the next request starts from `firstRequest` again.
      this.logService.error("Agent Access: failed to persist an OpenShell grant", e);
    }
  }

  /** Server-visible audit trail for released org-vault items, as on the plain credential path. */
  private async recordReleaseEvents(targets: ResolvedTarget[]): Promise<void> {
    const cipherIds = new Set(
      targets.map((target) => target.cipherId).filter((id): id is string => id != null),
    );
    for (const cipherId of cipherIds) {
      try {
        await this.eventCollectionService.collect(
          EventType.Cipher_ClientSharedWithAgent,
          cipherId,
          true,
        );
      } catch (e) {
        this.logService.error("Agent Access: failed to record an OpenShell release event", e);
      }
    }
  }

  private toNapiLifetimeMode(mode: OpenShellLifetimeMode): agent_access.OpenShellLifetimeMode {
    // napi's `OpenShellLifetimeMode` is an ambient const enum whose values are these strings.
    return mode as agent_access.OpenShellLifetimeMode;
  }
}
