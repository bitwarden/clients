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
  of,
  skip,
  Subject,
  switchMap,
  takeUntil,
  timeout,
  TimeoutError,
  timer,
  withLatestFrom,
} from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CommandDefinition, MessageListener } from "@bitwarden/common/platform/messaging";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, ToastService } from "@bitwarden/components";

import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";
import { ApproveSshRequestComponent } from "../components/approve-ssh-request";
import { SSH_AGENT_IPC_CHANNELS } from "../models/ipc-channels";
import { SshAgentPromptType } from "../models/ssh-agent-setting";

@Injectable({
  providedIn: "root",
})
export class SshAgentService implements OnDestroy {
  SSH_REFRESH_INTERVAL = 1000;
  SSH_VAULT_UNLOCK_REQUEST_TIMEOUT = 60_000;

  private static readonly LOCAL_HOST_KEY = "local";
  // map of cipherId to set of authorized host keys.
  // Local connections use LOCAL_HOST_KEY; forwarded connections use the remote host's fingerprint.
  private authorizedKeys: Map<string, Set<string>> = new Map();

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
    private configService: ConfigService,
  ) {}

  async init() {
    const useV2 = await this.configService.getFeatureFlag(FeatureFlag.SSHAgentV2);

    // V1 only: eagerly start the server on enable; v2 defers to first vault unlock.
    if (!useV2) {
      this.desktopSettingsService.sshAgentEnabled$
        .pipe(
          concatMap(async (enabled) => {
            if (!(await ipc.autofill.sshAgent.isLoaded()) && enabled) {
              await ipc.autofill.sshAgent.init(useV2);
            }
          }),
          takeUntil(this.destroy$),
        )
        .subscribe();
    }

    await this.initListeners(useV2);
  }

  private async initListeners(useV2: boolean) {
    // Shared: sign request approval — renderer shows the approval dialog.
    // Contains v1-only sections marked below.
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
        // V1, delete with PM-30758: in v2 sign requests arrive only after the user
        // has been prompted via the native sign callback flow.
        // When v1 is removed, replace this entire switchMap with: of([message, account.id])
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
                    map(() => EMPTY),
                  );
                }

                throw error;
              }),
              concatMap(async () => {
                // The active account may have switched with account switching during unlock
                const updatedAccount = await firstValueFrom(this.accountService.activeAccount$);
                return [message, updatedAccount.id] as const;
              }),
            );
          }

          return of([message, account.id]);
        }),
        concatMap(([message, userId]: [Record<string, unknown>, UserId]) =>
          from(this.cipherService.getAllDecrypted(userId)).pipe(
            map((ciphers) => [message, ciphers] as const),
          ),
        ),
        // This concatMap handles showing the dialog to approve the request.
        concatMap(async ([message, ciphers]) => {
          const cipherId = message.cipherId as string;
          const isListRequest = message.isListRequest as boolean;
          const requestId = message.requestId as number;
          let application = message.processName as string;
          const namespace = message.namespace as string;
          const isAgentForwarding = message.isAgentForwarding as boolean;
          const hostFingerprint = message.hostFingerprint as string | undefined;
          if (application == "") {
            application = this.i18nService.t("unknownApplication");
          }

          // V1, delete with PM-30758: isListRequest is not present in v2.
          if (isListRequest) {
            await ipc.autofill.sshAgent.replace(this.toAgentKeys(ciphers));
            await ipc.autofill.sshAgent.signRequestResponse(requestId, true);
            return;
          }

          if (ciphers === undefined) {
            ipc.autofill.sshAgent
              .signRequestResponse(requestId, false)
              .catch((e) => this.logService.error("Failed to respond to SSH request", e));
          }

          if (await this.needsAuthorization(cipherId, isAgentForwarding, hostFingerprint)) {
            ipc.platform.focusWindow();
            const cipher = ciphers.find((cipher) => cipher.id == cipherId);
            const dialogRef = ApproveSshRequestComponent.open(
              this.dialogService,
              cipher.name,
              application,
              isAgentForwarding,
              namespace,
            );

            if (await firstValueFrom(dialogRef.closed)) {
              await this.rememberAuthorization(cipherId, isAgentForwarding, hostFingerprint);
              return ipc.autofill.sshAgent.signRequestResponse(requestId, true);
            } else {
              return ipc.autofill.sshAgent.signRequestResponse(requestId, false);
            }
          } else {
            return ipc.autofill.sshAgent.signRequestResponse(requestId, true);
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
    // v1 clears the agent keystore here; v2 handles it in the reactive block below.
    this.accountService.activeAccount$
      .pipe(
        // Dedupe by id because activeAccount$ also re-emits when
        // AccountInfo fields change (email/name/emailVerified/creationDate).
        distinctUntilChanged((a, b) => a?.id === b?.id),
        // prevents from triggering on the initial account load
        skip(1),
        withLatestFrom(this.desktopSettingsService.sshAgentEnabled$),
        concatMap(async ([, enabled]) => {
          this.logService.debug("Active account changed, resetting SSH sign approval state");
          this.authorizedKeys = new Map();
          // the V1 sshagent.clearkeys handler isn't registered in the main process
          // until sshagent.init is called (which only happens when the feature is enabled).
          if (enabled && !useV2) {
            this.logService.info("Active account changed, clearing SSH keys");
            try {
              await ipc.autofill.sshAgent.clearKeys();
            } catch (e) {
              this.logService.error("Failed to clear SSH keys", e);
            }
          }
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        error: (e: unknown) => {
          this.logService.error("Error in active account observable", e);
          this.authorizedKeys = new Map();
        },
        // on completion the service is being torn down with the rest of the app and the main process will release agent state on exit.
        complete: () => {
          this.authorizedKeys = new Map();
        },
      });

    // Clear remembered sign-approvals whenever the vault is not unlocked
    this.authService.activeAccountStatus$
      .pipe(
        filter((status) => status !== AuthenticationStatus.Unlocked),
        takeUntil(this.destroy$),
      )
      .subscribe(() => {
        this.authorizedKeys = new Map();
      });

    // V1 only: periodic key refresh. V2 manages keys reactively — see block below.
    if (!useV2) {
      combineLatest([
        timer(0, this.SSH_REFRESH_INTERVAL),
        this.desktopSettingsService.sshAgentEnabled$,
      ])
        .pipe(
          concatMap(async ([, enabled]) => {
            if (!enabled) {
              await ipc.autofill.sshAgent.clearKeys();
              return;
            }

            const activeAccount = await firstValueFrom(this.accountService.activeAccount$);
            const authStatus = await firstValueFrom(
              this.authService.authStatusFor$(activeAccount.id),
            );
            if (authStatus !== AuthenticationStatus.Unlocked) {
              return;
            }

            const ciphers = await this.cipherService.getAllDecrypted(activeAccount.id);
            if (ciphers == null) {
              await ipc.autofill.sshAgent.lock();
              return;
            }

            await ipc.autofill.sshAgent.replace(this.toAgentKeys(ciphers));
          }),
          takeUntil(this.destroy$),
        )
        .subscribe();
    }

    // V2: handle list-keys requests when the vault is locked (BFU case).
    // The Rust agent fires a list callback when its keystore is empty. The renderer then prompts
    // for unlock, pushes keys once unlocked, and signals the agent to return them.
    if (useV2) {
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
              map((ciphers) => [message, ciphers] as const),
            ),
          ),
          concatMap(async ([message, ciphers]) => {
            const requestId = message.requestId as number;
            await ipc.autofill.sshAgent.replace(this.toAgentKeys(ciphers ?? []));
            await ipc.autofill.sshAgent.listRequestResponse(requestId, true);
          }),
          catchError((error: unknown, source) => {
            this.logService.error("Unexpected error during SSH agent list keys request", error);
            return source;
          }),
          takeUntil(this.destroy$),
        )
        .subscribe();
    }

    // V2: push SSH keys to the agent reactively whenever cipher data changes while unlocked.
    // Keys are kept in the agent's keystore on vault lock so ssh-add -L still works locked.
    // Keys are cleared only when the feature is disabled or the active account changes.
    if (useV2) {
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
                return from(ipc.autofill.sshAgent.isLoaded()).pipe(
                  concatMap(async (loaded) => {
                    if (!loaded) {
                      await ipc.autofill.sshAgent.init(useV2);
                    }
                  }),
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
                    await ipc.autofill.sshAgent.replace(keys);
                  }),
                );
              }),
            );
          }),
          catchError((error: unknown, source) => {
            this.logService.error("Unexpected error in SSH agent replace keys", error);
            return source;
          }),
          takeUntil(this.destroy$),
        )
        .subscribe();
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async stopAgent(): Promise<void> {
    const loaded = await ipc.autofill.sshAgent.isLoaded();
    if (loaded) {
      await ipc.autofill.sshAgent.stop();
    }
  }

  private toAgentKeys(
    ciphers: CipherView[],
  ): { name: string; privateKey: string; cipherId: string }[] {
    return ciphers
      .filter((c) => c.type === CipherType.SshKey && !c.isDeleted && !c.isArchived)
      .map((c) => ({ name: c.name, privateKey: c.sshKey.privateKey, cipherId: c.id }));
  }

  private async rememberAuthorization(
    cipherId: string,
    isForwarded: boolean,
    hostFingerprint?: string,
  ): Promise<void> {
    const key = isForwarded ? hostFingerprint : SshAgentService.LOCAL_HOST_KEY;
    if (!key) {
      return;
    }
    const approved = this.authorizedKeys.get(cipherId) ?? new Set<string>();
    approved.add(key);
    this.authorizedKeys.set(cipherId, approved);
  }

  private async needsAuthorization(
    cipherId: string,
    isForwarded: boolean,
    hostFingerprint?: string,
  ): Promise<boolean> {
    const promptType = await firstValueFrom(this.desktopSettingsService.sshAgentPromptBehavior$);
    switch (promptType) {
      case SshAgentPromptType.Never:
        return false;
      case SshAgentPromptType.Always:
        return true;
      case SshAgentPromptType.RememberUntilLock: {
        const key = isForwarded ? hostFingerprint : SshAgentService.LOCAL_HOST_KEY;
        // key will only ever be undefined for forwarded requests in the v1, re-prompt.
        if (!key) {
          return true;
        }
        return !(this.authorizedKeys.get(cipherId)?.has(key) ?? false);
      }
    }
  }
}
