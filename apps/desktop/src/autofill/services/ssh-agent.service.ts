// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable, OnDestroy, Optional } from "@angular/core";
import {
  catchError,
  combineLatest,
  concat,
  concatMap,
  defer,
  distinctUntilChanged,
  EMPTY,
  filter,
  firstValueFrom,
  from,
  ignoreElements,
  map,
  Observable,
  of,
  race,
  skip,
  startWith,
  Subject,
  switchMap,
  take,
  takeUntil,
  tap,
  timeout,
  TimeoutError,
  timer,
  withLatestFrom,
} from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CommandDefinition, MessageListener } from "@bitwarden/common/platform/messaging";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, ToastService } from "@bitwarden/components";

import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";
import { LeasedSshKey, LeasedSshKeyService } from "../abstractions/leased-ssh-key.service";
import { ApproveSshRequestComponent } from "../components/approve-ssh-request";
import { SSH_AGENT_IPC_CHANNELS } from "../models/ipc-channels";
import { SshAgentKey } from "../models/ssh-agent-key";
import { SshAgentPromptType } from "../models/ssh-agent-setting";

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
  SSH_VAULT_UNLOCK_REQUEST_TIMEOUT = 60_000;

  // map of cipherId to set of host key fingerprints who's sign requests have been authorized.
  private authorizedHosts: Map<string, Set<string>> = new Map();

  private destroy$ = new Subject<void>();

  constructor(
    private cipherService: CipherService,
    private logService: LogService,
    private dialogService: DialogService,
    private messageListener: MessageListener,
    private authService: AuthService,
    private toastService: ToastService,
    private i18nService: I18nService,
    private desktopSettingsService: DesktopSettingsService,
    private accountService: AccountService,
    // Filled only by a licensed build; unprovided, the agent serves ordinary keys only.
    @Optional() private leasedSshKeyService?: LeasedSshKeyService,
  ) {}

  /**
   * Live cipher views paired with the leased keys, after removing leased keys when not unlocked.
   */
  private keySources$(userId: UserId, status: AuthenticationStatus) {
    return concat(
      status === AuthenticationStatus.Unlocked ? EMPTY : this.leasedKeysRemoved$(),
      combineLatest([
        // Subscribe to live cipher data for the account.
        this.cipherService
          .cipherViews$(userId)
          // Skip emissions before cipher data is available (e.g. during initial decrypt).
          .pipe(filter((views) => views != null)),
        this.leasedKeys$(userId, status),
      ]),
    );
  }

  async init() {
    await this.initListeners();
  }

  private async initListeners() {
    // Sign request approval — renderer shows the approval dialog.
    this.messageListener
      .messages$(new CommandDefinition(SSH_AGENT_IPC_CHANNELS.SIGN_REQUEST))
      .pipe(
        withLatestFrom(this.desktopSettingsService.sshAgentEnabled$),
        concatMap(async ([message, enabled]) => {
          if (!enabled) {
            await ipc.autofill.sshAgent.signRequestResponse(message.requestId as number, false);
            return null;
          }
          return message;
        }),
        filter((message) => message != null),
        withLatestFrom(this.authService.activeAccountStatus$, this.accountService.activeAccount$),
        // This switchMap handles unlocking the vault if it is not unlocked:
        //   - If the vault is locked or logged out, we will wait for it to be unlocked:
        //   - If the vault is not unlocked in within the timeout, we will abort the flow.
        //   - If the vault is unlocked, we will continue with the flow.
        // switchMap is used here to prevent multiple requests from being processed at the same time,
        // and will cancel the previous request if a new one is received.
        //
        // Keys are retained in the agent's keystore across vault lock, so the agent can serve a sign request while the vault is locked without ever firing the list callback.
        switchMap(([message, status, account]) => {
          if (status !== AuthenticationStatus.Unlocked || account == null) {
            ipc.platform.focusWindow();
            this.toastService.showToast({
              variant: "info",
              title: null,
              message: this.i18nService.t("sshAgentUnlockRequired"),
            });
            return this.authService.activeAccountStatus$.pipe(
              filter((status) => status === AuthenticationStatus.Unlocked),
              // Resolve on the first unlock. Without this, account switching in combination with sign
              // requests can result in rogue re-prompts for the prior request.
              take(1),
              timeout({
                first: this.SSH_VAULT_UNLOCK_REQUEST_TIMEOUT,
              }),
              catchError((error: unknown) => {
                if (error instanceof TimeoutError) {
                  this.toastService.showToast({
                    variant: "error",
                    title: null,
                    message: this.i18nService.t("sshAgentUnlockTimeout"),
                  });
                  const requestId = message.requestId as number;
                  // Abort flow by sending a false response.
                  // Returning an empty observable this will prevent the rest of the flow from executing
                  return from(ipc.autofill.sshAgent.signRequestResponse(requestId, false)).pipe(
                    switchMap(() => EMPTY),
                  );
                }

                throw error;
              }),
              concatMap(async () => {
                // The active account may have switched with account switching during unlock
                const updatedAccount = await firstValueFrom(this.accountService.activeAccount$);
                return [message, updatedAccount.id] as const;
              }),
              // A catch-all in case of unexpected errors we don't leave the caller hanging or timeout.
              catchError((error: unknown) =>
                from(
                  this.refuseSignRequest(
                    message.requestId as number,
                    "Failed while waiting for the vault to unlock",
                    error,
                  ),
                ).pipe(switchMap(() => EMPTY)),
              ),
            );
          }

          return of([message, account.id]);
        }),
        concatMap(([message, userId]: [Record<string, unknown>, UserId]) =>
          from(this.cipherService.getAllDecrypted(userId)).pipe(
            map((ciphers) => [message, ciphers, userId] as const),
            catchError((error: unknown) =>
              from(
                this.refuseSignRequest(
                  message.requestId as number,
                  "Failed to decrypt the vault for an SSH sign request",
                  error,
                ),
              ).pipe(switchMap(() => EMPTY)),
            ),
          ),
        ),
        // This concatMap handles showing the dialog to approve the request.
        concatMap(async ([message, ciphers, userId]) => {
          try {
            return await this.processSignRequest(message, ciphers, userId);
          } catch (error: unknown) {
            await this.refuseSignRequest(
              message.requestId as number,
              "Failed to process approval for an SSH sign request",
              error,
            );
          }
        }),
        catchError((error: unknown, source) => {
          this.logService.error("Unexpected error during SSH agent sign request", error);
          return source;
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    // Reset sign-approval state on account switch.
    // account switch is a vault-lock boundary and RememberUntilLock approvals must not survive
    // it regardless of the user's current SSH-agent setting.
    this.accountService.activeAccount$
      .pipe(
        // Dedupe by id because activeAccount$ also re-emits when
        // AccountInfo fields change (email/name/emailVerified/creationDate).
        distinctUntilChanged((a, b) => a?.id === b?.id),
        // prevents from triggering on the initial account load
        skip(1),
        tap(() => {
          this.logService.debug("Active account changed, resetting SSH sign approval state");
          this.authorizedHosts = new Map();
          // A leased key belongs to the account that held the lease; it must not wait for the
          // next account's keys to replace it. Ordinary keys are untouched.
          void this.removeLeasedKeysIfProvided();
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        error: (e: unknown) => {
          this.logService.error("Error in active account observable", e);
          this.authorizedHosts = new Map();
        },
        // on completion the service is being torn down with the rest of the app and the main process will release agent state on exit.
        complete: () => {
          this.authorizedHosts = new Map();
        },
      });

    // Clear remembered sign-approvals whenever the vault is not unlocked
    this.authService.activeAccountStatus$
      .pipe(
        filter((status) => status !== AuthenticationStatus.Unlocked),
        takeUntil(this.destroy$),
      )
      .subscribe(() => {
        this.authorizedHosts = new Map();
      });

    // Handle list-keys requests when the vault is locked (BFU case).
    // The Rust agent fires a list callback when its keystore is empty. The renderer then prompts
    // for unlock, pushes keys once unlocked, and signals the agent to return them.
    this.messageListener
      .messages$(new CommandDefinition(SSH_AGENT_IPC_CHANNELS.LIST_KEYS_REQUEST))
      .pipe(
        withLatestFrom(this.authService.activeAccountStatus$, this.accountService.activeAccount$),
        switchMap(([message, status, account]) => {
          const requestId = message.requestId as number;
          if (status !== AuthenticationStatus.Unlocked || account == null) {
            ipc.platform.focusWindow();
            this.toastService.showToast({
              variant: "info",
              title: null,
              message: this.i18nService.t("sshAgentUnlockRequired"),
            });
            return this.authService.activeAccountStatus$.pipe(
              filter((s) => s === AuthenticationStatus.Unlocked),
              timeout({ first: this.SSH_VAULT_UNLOCK_REQUEST_TIMEOUT }),
              catchError((error: unknown) => {
                if (error instanceof TimeoutError) {
                  return from(ipc.autofill.sshAgent.listRequestResponse(requestId, false)).pipe(
                    switchMap(() => EMPTY),
                  );
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
        concatMap(([message, userId]: [Record<string, unknown>, UserId]) =>
          from(this.cipherService.getAllDecrypted(userId)).pipe(
            map((ciphers) => [message, ciphers, userId] as const),
          ),
        ),
        concatMap(async ([message, ciphers, userId]) => {
          const requestId = message.requestId as number;
          try {
            // Pushes the same set the reactive pipeline does, so a list request cannot drop a key
            // under a live lease, nor revive one whose lease has ended.
            await ipc.autofill.sshAgent.replace(
              this.withLeasedKeys(
                this.toAgentKeys(ciphers ?? []),
                this.leasedSshKeyService?.liveKeys(userId) ?? [],
              ),
            );
          } catch (e) {
            // Refuse the request rather than leaving the agent's list callback unresolved, which
            // would hang the SSH client that is waiting on it.
            this.logService.error("Failed to push SSH keys to the agent", e);
            await ipc.autofill.sshAgent.listRequestResponse(requestId, false);
            return;
          }
          await ipc.autofill.sshAgent.listRequestResponse(requestId, true);
        }),
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
    // Leased keys are the exception: they carry their lease's end, are re-pushed whenever their
    // lease set changes, and leave the keystore on lock, logout and account switch.
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
                return this.leasedKeysRemoved$();
              }
              // Start the agent socket server if not already running.
              // Covers the locked-at-startup case: socket must be up so SSH clients
              // can connect and the app can prompt for vault unlock when needed.
              // When locked, cipherViews$ emits null (caught by the filter below),
              // so replace() is not called and existing keys are left in the native store,
              // except leased keys, which are removed first.
              return from(this.ensureAgentRunning()).pipe(
                // Not unlocked: ordinary keys stay for ssh-add -L, but a leased key leaves now.
                switchMap(() => this.keySources$(account.id, status)),
                // Project to the SSH key fields needed by the agent.
                map(([views, leased]) => this.withLeasedKeys(this.toAgentKeys(views), leased)),
                // Skip re-push when the SSH key set hasn't actually changed.
                distinctUntilChanged((prev, curr) => {
                  // if the length is different, replace keys
                  if (prev.length !== curr.length) {
                    return false;
                  }
                  const prevMap = new Map(
                    prev.map((k) => [
                      k.cipherId,
                      { privateKey: k.privateKey, name: k.name, expiresAt: k.expiresAt },
                    ]),
                  );
                  // if any has its private key, name or lease end changed, replace keys
                  return curr.every((k) => {
                    const p = prevMap.get(k.cipherId);
                    return (
                      p?.privateKey === k.privateKey &&
                      p?.name === k.name &&
                      p?.expiresAt === k.expiresAt
                    );
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

  private toAgentKeys(ciphers: CipherView[]): SshAgentKey[] {
    return ciphers
      .filter((c) => c.type === CipherType.SshKey && !c.isDeleted && !c.isArchived)
      .map((c) => ({ name: c.name, privateKey: c.sshKey.privateKey, cipherId: c.id }));
  }

  // The user's leased keys while the vault is unlocked; none otherwise or without a provider.
  // Starts empty so ordinary keys never wait on a lease read.
  private leasedKeys$(userId: UserId, status: AuthenticationStatus): Observable<LeasedSshKey[]> {
    if (this.leasedSshKeyService == null || status !== AuthenticationStatus.Unlocked) {
      return of([]);
    }
    return this.leasedSshKeyService.leasedKeys$(userId).pipe(startWith([]));
  }

  // Appends the live leased keys, each carrying its lease's end so the native agent refuses it
  // afterwards even if this renderer never pushes again. An ordinary key of the same cipher wins.
  private withLeasedKeys(ordinary: SshAgentKey[], leased: LeasedSshKey[]): SshAgentKey[] {
    if (leased.length === 0) {
      return ordinary;
    }
    const ordinaryIds = new Set(ordinary.map((k) => k.cipherId));
    const nowMs = Date.now();
    return [
      ...ordinary,
      ...leased
        .filter((k) => k.leaseEndsAt > nowMs && !ordinaryIds.has(k.cipherId))
        .map((k) => ({
          name: k.name,
          privateKey: k.privateKey,
          cipherId: k.cipherId,
          expiresAt: k.leaseEndsAt,
        })),
    ];
  }

  // Completes once the agent has dropped every leased key (the keys carrying an expiry), keeping
  // ordinary keys. Completes at once without a provider, so the OSS flow is unchanged.
  private leasedKeysRemoved$(): Observable<never> {
    if (this.leasedSshKeyService == null) {
      return EMPTY;
    }
    return defer(() => this.removeLeasedKeys()).pipe(ignoreElements());
  }

  private async removeLeasedKeysIfProvided(): Promise<void> {
    if (this.leasedSshKeyService != null) {
      await this.removeLeasedKeys();
    }
  }

  private async removeLeasedKeys(): Promise<void> {
    try {
      await ipc.autofill.sshAgent.removeExpiring();
    } catch (e) {
      // Fail closed: a leased key must not outlive a lock, so stop the agent (clearing every key)
      // rather than leave it in place.
      this.logService.error("Failed to remove leased SSH keys from the agent; stopping it", e);
      await this.stopAgent();
    }
  }

  // Shows the approval dialog if the prompt setting calls for it, then answers the agent.
  private async processSignRequest(
    message: Record<string, unknown>,
    ciphers: CipherView[],
    userId: UserId,
  ) {
    const cipherId = message.cipherId as string;
    const requestId = message.requestId as number;
    let application = message.processName as string;
    const namespace = message.namespace as string;
    const isAgentForwarding = message.isAgentForwarding as boolean;
    const hostFingerprint = message.hostFingerprint as string | undefined;

    if (application == "") {
      application = this.i18nService.t("unknownApplication");
    }

    // Resolve the key before deciding on authorization. The agent derives cipherId from its own
    // keystore, which outlives a vault lock and an account switch, so a cipher received in the
    // request might not be present in the active vault.
    const cipher = ciphers?.find((cipher) => cipher.id == cipherId);
    if (cipher == null) {
      // A gated item's key is never in the decrypted vault; it is served only under a live lease.
      const leased = this.leasedSshKeyService?.liveKey(userId, cipherId as CipherId);
      if (leased != null) {
        return this.processLeasedSignRequest(
          leased,
          userId,
          requestId,
          application,
          isAgentForwarding,
          namespace,
        );
      }
      this.logService.error(
        "SSH sign request received for key not in the active vault; rejecting.",
      );
      return ipc.autofill.sshAgent.signRequestResponse(requestId, false);
    }

    if (await this.needsAuthorization(cipherId, isAgentForwarding, hostFingerprint)) {
      ipc.platform.focusWindow();
      const dialogRef = ApproveSshRequestComponent.open(
        this.dialogService,
        cipher.name,
        application,
        isAgentForwarding,
        namespace,
      );

      if (await firstValueFrom(dialogRef.closed)) {
        await this.storeAuthorizedHost(cipherId, isAgentForwarding, hostFingerprint);
        return ipc.autofill.sshAgent.signRequestResponse(requestId, true);
      } else {
        return ipc.autofill.sshAgent.signRequestResponse(requestId, false);
      }
    } else {
      return ipc.autofill.sshAgent.signRequestResponse(requestId, true);
    }
  }

  // A leased key asks every time, whatever the prompt setting, and its approval is never
  // remembered, so a remembered host can never carry it past its lease or a lock. The lease is
  // checked again once the user answers, and the dialog closes as denied when the lease ends.
  private async processLeasedSignRequest(
    leased: LeasedSshKey,
    userId: UserId,
    requestId: number,
    application: string,
    isAgentForwarding: boolean,
    namespace: string,
  ) {
    this.authorizedHosts.delete(leased.cipherId);
    this.logService.debug("SSH sign authorization (leased key): prompting.");

    ipc.platform.focusWindow();
    const dialogRef = ApproveSshRequestComponent.open(
      this.dialogService,
      leased.name,
      application,
      isAgentForwarding,
      namespace,
    );
    const leaseEnded = Symbol("leaseEnded");
    const answer = await firstValueFrom(
      race(dialogRef.closed, timer(new Date(leased.leaseEndsAt)).pipe(map(() => leaseEnded))),
    );
    if (answer === leaseEnded) {
      void dialogRef.close(false);
      this.logService.debug("SSH sign authorization (leased key): lease ended while prompting.");
      return ipc.autofill.sshAgent.signRequestResponse(requestId, false);
    }

    const approved =
      answer === true &&
      this.leasedSshKeyService?.liveKey(userId, leased.cipherId) != null &&
      (await this.isActiveAndUnlocked(userId));
    return ipc.autofill.sshAgent.signRequestResponse(requestId, approved);
  }

  private async isActiveAndUnlocked(userId: UserId): Promise<boolean> {
    const [account, status] = await Promise.all([
      firstValueFrom(this.accountService.activeAccount$),
      firstValueFrom(this.authService.authStatusFor$(userId)),
    ]);
    return account?.id === userId && status === AuthenticationStatus.Unlocked;
  }

  private async refuseSignRequest(requestId: number, context: string, error: unknown) {
    this.logService.error(`${context}; refusing the SSH sign request`, error);
    try {
      await ipc.autofill.sshAgent.signRequestResponse(requestId, false);
    } catch (e) {
      this.logService.error("Failed to refuse the SSH sign request", e);
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

    // get the set of host fingerprints for this cipher or create if this is the first.
    const authorized = this.authorizedHosts.get(cipherId) ?? new Set<string>();
    authorized.add(key);

    this.authorizedHosts.set(cipherId, authorized);
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

        if (this.authorizedHosts.get(cipherId)?.has(key) ?? false) {
          this.logAuthorizationDecision(scope, promptType, "approving remembered host.");
          return false;
        }

        this.logAuthorizationDecision(scope, promptType, "prompting- new host.");
        return true;
      }
    }
  }
}
