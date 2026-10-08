// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable, OnDestroy } from "@angular/core";
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
  mergeMap,
  of,
  Subject,
  switchMap,
  takeUntil,
} from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CommandDefinition, MessageListener } from "@bitwarden/common/platform/messaging";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";

import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";
import { ApproveAgentRequestComponent } from "../components/approve-agent-request.component";
import { AgentOutcomeStatus, AgentRequest, AgentSshSign } from "../models/agent-request";
import { AGENT_ACCESS_IPC_CHANNELS, SSH_AGENT_IPC_CHANNELS } from "../models/ipc-channels";
import { SshAgentPromptType } from "../models/ssh-agent-setting";

import { AgentRequestGate } from "./agent-request-gate.service";

/**
 * Namespacing for cached sign authorizations.
 */
const AuthorizationScope = Object.freeze({
  Local: "local",
  Forwarded: "forwarded",
} as const);
type AuthorizationScope = (typeof AuthorizationScope)[keyof typeof AuthorizationScope];

@Injectable({
  providedIn: "root",
})
export class SshAgentService implements OnDestroy {
  private destroy$ = new Subject<void>();

  constructor(
    private cipherService: CipherService,
    private logService: LogService,
    private dialogService: DialogService,
    private messageListener: MessageListener,
    private authService: AuthService,
    private i18nService: I18nService,
    private desktopSettingsService: DesktopSettingsService,
    private accountService: AccountService,
    private gate: AgentRequestGate,
  ) {}

  async init() {
    await this.initListeners();
    await ipc.autofill.sshAgent.ready();
  }

  private async initListeners() {
    // Sign requests arrive through main's agent request broker, shared with agent access.
    this.messageListener
      .messages$(new CommandDefinition<AgentRequest>(AGENT_ACCESS_IPC_CHANNELS.REQUEST))
      .pipe(
        filter((request): request is AgentRequest<AgentSshSign> => request.kind.type === "sshSign"),
        // Keys are retained in the agent's keystore across vault lock, so the agent can serve a sign request while the vault is locked without ever firing the list callback.
        mergeMap((request) =>
          this.gate.run({
            label: "SSH sign request",
            requestId: request.requestId,
            enabled: this.desktopSettingsService.sshAgentEnabled$,
            deadline: request.deadline,
            unlock: {
              requiredMessage: "sshAgentUnlockRequired",
              timeoutMessage: "sshAgentUnlockTimeout",
            },
            refused: false,
            handle: async (userId) =>
              this.processSignRequest(request, await this.cipherService.getAllDecrypted(userId)),
            respond: (approved) =>
              ipc.autofill.agentAccess.respond(request.requestId, {
                status: approved ? AgentOutcomeStatus.Approved : AgentOutcomeStatus.Denied,
              }),
          }),
        ),
        catchError((error: unknown, source) => {
          this.logService.error("Unexpected error during SSH agent sign request", error);
          return source;
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    // Handle list-keys requests when the vault is locked (BFU case).
    // The Rust agent fires a list callback when its keystore is empty. Main's broker delivers it
    // here, opening a window if needed; the renderer prompts for unlock, pushes keys once
    // unlocked, and signals the agent to return them.
    this.messageListener
      .messages$(
        new CommandDefinition<{ requestId: number; deadline: number }>(
          SSH_AGENT_IPC_CHANNELS.LIST_KEYS_REQUEST,
        ),
      )
      .pipe(
        mergeMap(({ requestId, deadline }) =>
          this.gate.run({
            label: "SSH list keys request",
            requestId,
            enabled: of(true),
            deadline,
            unlock: { requiredMessage: "sshAgentUnlockRequired" },
            refused: false,
            exclusive: false,
            // A failed push throws, so the gate refuses rather than leaving the SSH client waiting.
            handle: async (userId) => {
              const ciphers = await this.cipherService.getAllDecrypted(userId);
              await ipc.autofill.sshAgent.replace(this.toAgentKeys(ciphers ?? []));
              return true;
            },
            respond: (pushed) => ipc.autofill.sshAgent.listRequestResponse(requestId, pushed),
          }),
        ),
        catchError((error: unknown, source) => {
          this.logService.error("Unexpected error during SSH agent list keys request", error);
          return source;
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    // Push SSH keys to the agent reactively whenever cipher data changes while unlocked.
    // Keys are kept in the agent's keystore on vault lock so ssh-add -L still works locked.
    // Keys are cleared only when the feature is disabled or the active account changes.
    this.accountService.activeAccount$
      .pipe(
        // Re-evaluate the entire pipeline whenever the active account changes or is cleared.
        switchMap((account) => {
          // All accounts logged out: clear keys and stop the server if it was running.
          if (account == null) {
            return from(this.stopAgent());
          }
          // React to vault status and feature toggle changes for the active account.
          return combineLatest([
            this.authService.authStatusFor$(account.id),
            this.desktopSettingsService.sshAgentEnabled$,
          ]).pipe(
            // Cancel the previous inner pipeline whenever status or enabled changes.
            switchMap(([status, enabled]) => {
              // Feature disabled: stop the server if running, then idle.
              if (!enabled) {
                return from(this.stopAgent());
              }
              // Logged out: no vault present, nothing to serve.
              if (status === AuthenticationStatus.LoggedOut) {
                return EMPTY;
              }
              // Start the agent socket server if not already running.
              // Covers the locked-at-startup case: socket must be up so SSH clients
              // can connect and the app can prompt for vault unlock when needed.
              // When locked, cipherViews$ emits null (caught by the filter below),
              // so replace() is not called and existing keys are left in the native store.
              return from(this.ensureAgentRunning()).pipe(
                // Subscribe to live cipher data for the active account.
                switchMap(() => this.cipherService.cipherViews$(account.id)),
                // Skip emissions before cipher data is available (e.g. during initial decrypt).
                filter((views) => views != null),
                // Project to the SSH key fields needed by the agent.
                map((views) => this.toAgentKeys(views)),
                // Skip re-push when the SSH key set hasn't actually changed.
                distinctUntilChanged((prev, curr) => {
                  // if the length is different, replace keys
                  if (prev.length !== curr.length) {
                    return false;
                  }
                  const prevMap = new Map(
                    prev.map((k) => [k.cipherId, { privateKey: k.privateKey, name: k.name }]),
                  );
                  // if any has either private key changed or the name changed, replace keys
                  return curr.every((k) => {
                    const p = prevMap.get(k.cipherId);
                    return p?.privateKey === k.privateKey && p?.name === k.name;
                  });
                }),
                concatMap(async (keys) => {
                  try {
                    await ipc.autofill.sshAgent.replace(keys);
                  } catch (e) {
                    // if the agent fails to parse the keys and errors out, it's a deterministic
                    // error state, we don't want to retry without the input keys changing
                    this.logService.error("Failed to push SSH keys to the agent", e);
                  }
                }),
                // calls in this chain should not be re-tried as they're deterministic in their scope
                catchError((error: unknown) => {
                  this.logService.error("Unexpected error while syncing SSH keys", error);
                  return EMPTY;
                }),
              );
            }),
          );
        }),
        // calls in this chain should not be re-tried as they're deterministic in their scope
        catchError((error: unknown) => {
          this.logService.error("SSH agent key pipeline stopped by an unrecoverable error", error);
          return EMPTY;
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Starts the agent server unless it is already running.
  private async ensureAgentRunning(): Promise<void> {
    try {
      if (!(await ipc.autofill.sshAgent.isLoaded())) {
        await ipc.autofill.sshAgent.init();
      }
    } catch (e) {
      this.logService.error("Failed to start the SSH agent server", e);
    }
  }

  // Stops the agent server if it is running.
  private async stopAgent(): Promise<void> {
    try {
      if (await ipc.autofill.sshAgent.isLoaded()) {
        await ipc.autofill.sshAgent.stop();
      }
    } catch (e) {
      this.logService.error("Failed to stop the SSH agent server", e);
    }
  }

  private toAgentKeys(
    ciphers: CipherView[],
  ): { name: string; privateKey: string; cipherId: string }[] {
    return ciphers
      .filter((c) => c.type === CipherType.SshKey && !c.isDeleted && !c.isArchived)
      .map((c) => ({ name: c.name, privateKey: c.sshKey.privateKey, cipherId: c.id }));
  }

  // Shows the approval dialog if the prompt setting calls for it; resolves to the agent's answer.
  private async processSignRequest(
    { kind, requester, deadline }: AgentRequest<AgentSshSign>,
    ciphers: CipherView[],
  ) {
    const { cipherId, namespace, isForwarding, hostFingerprint } = kind;

    // Resolve the key before deciding on authorization. The agent derives cipherId from its own
    // keystore, which outlives a vault lock and an account switch, so a cipher received in the
    // request might not be present in the active vault.
    const cipher = ciphers?.find((cipher) => cipher.id == cipherId);
    if (cipher == null) {
      this.logService.error(
        "SSH sign request received for key not in the active vault; rejecting.",
      );
      return false;
    }

    if (await this.needsAuthorization(cipherId, isForwarding, hostFingerprint)) {
      const name = requester.app.name || this.i18nService.t("unknownApplication");
      const result = await this.gate.confirm(
        () =>
          ApproveAgentRequestComponent.open(this.dialogService, {
            requester: { ...requester, app: { ...requester.app, name } },
            ssh: { cipherName: cipher.name, namespace, isForwarding },
          }),
        deadline,
      );

      if (result?.approved) {
        await this.storeAuthorizedHost(cipherId, isForwarding, hostFingerprint);
        return true;
      } else {
        return false;
      }
    } else {
      return true;
    }
  }

  private static authorizationScope(isForwarded: boolean): AuthorizationScope {
    return isForwarded ? AuthorizationScope.Forwarded : AuthorizationScope.Local;
  }

  // Builds the cache's key for storing RememberUntilLock authorizations.
  // The agent supplies a fingerprint whenever it verified a session-bind@openssh.com extension.
  // These are the four cache key formats and the scenarios that lead to them:
  //
  //   # | isForwarded | fingerprint | cache key
  //   --|-------------|-------------|----------------
  //   1 | true        | present     | forwarded:<fingerprint>
  //   2 | true        | absent      | undefined
  //   3 | false       | present     | local:<fingerprint>
  //   4 | false       | absent      | local
  //
  // 1. Agent forwarded request to a host (`ssh -A <host>`)
  // 2. Only reachable if an error happens in IPC.
  // 3. Non-forwarded request to a host (`ssh <host>`)
  // 4. Sign request without a host. (e.g. Local git/file signing)
  private static authorizedHostsCacheKey(
    isForwarded: boolean,
    hostFingerprint?: string,
  ): string | undefined {
    const scope = SshAgentService.authorizationScope(isForwarded);

    if (hostFingerprint) {
      return `${scope}:${hostFingerprint}`;
    }

    // defensive check- in practice, isForwarded is only populated when hostFingerprint is also provided.
    if (isForwarded) {
      return undefined;
    }

    return AuthorizationScope.Local;
  }

  // Stores the authorized host in the cache.
  private async storeAuthorizedHost(
    cipherId: string,
    isForwarded: boolean,
    hostFingerprint?: string,
  ): Promise<void> {
    const key = SshAgentService.authorizedHostsCacheKey(isForwarded, hostFingerprint);
    if (!key) {
      return;
    }

    this.gate.remembered.add(`ssh:${cipherId}:${key}`);
  }

  private logAuthorizationDecision(
    scope: AuthorizationScope,
    promptType: SshAgentPromptType,
    outcome: string,
  ) {
    this.logService.debug(
      `SSH sign authorization (${scope}, prompt setting: ${promptType}): ${outcome}`,
    );
  }

  // Evaluates the request's parameters in conjunction with the user's setting for Authorization.
  // True if authorization from the user is required, false otherwise.
  private async needsAuthorization(
    cipherId: string,
    isForwarded: boolean,
    hostFingerprint?: string,
  ): Promise<boolean> {
    const scope = SshAgentService.authorizationScope(isForwarded);
    const promptType = await firstValueFrom(this.desktopSettingsService.sshAgentPromptBehavior$);

    switch (promptType) {
      case SshAgentPromptType.Never:
        this.logAuthorizationDecision(scope, promptType, "approving.");
        return false;

      case SshAgentPromptType.Always:
        this.logAuthorizationDecision(scope, promptType, "prompting.");
        return true;

      case SshAgentPromptType.RememberUntilLock: {
        const key = SshAgentService.authorizedHostsCacheKey(isForwarded, hostFingerprint);

        // defensive check. The API for the agent doesn't allow `key` to not be defined, thus if an IPC
        // error resulted in the key not being defined, then without this guard we'd
        // silently approve forwarded requests to any host for this vault item.
        if (!key) {
          this.logAuthorizationDecision(scope, promptType, "prompting- no host key from request.");
          return true;
        }

        if (this.gate.remembered.has(`ssh:${cipherId}:${key}`)) {
          this.logAuthorizationDecision(scope, promptType, "approving remembered host.");
          return false;
        }

        this.logAuthorizationDecision(scope, promptType, "prompting- new host.");
        return true;
      }
    }
  }
}
