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

  private authorizedSshKeys: Record<string, Date> = {};

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
          }
          return { message, enabled };
        }),
        filter(({ enabled }) => enabled),
        map(({ message }) => message),
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
        // This switchMap handles fetching the ciphers from the vault.
        switchMap(([message, userId]: [Record<string, unknown>, UserId]) =>
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

          if (await this.needsAuthorization(cipherId, isAgentForwarding)) {
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
              await this.rememberAuthorization(cipherId);
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

    // Shared: reset sign-approval state on account switch; v1 also clears the agent keystore.
    // skip(1) prevents this from firing on the initial account load.
    this.accountService.activeAccount$.pipe(skip(1), takeUntil(this.destroy$)).subscribe({
      // Triggered when the user switches the active account.
      // authorizedSshKeys is always reset so approval prompts reappear for the new session.
      // In v1, the agent keystore is cleared immediately; in v2 the reactive block below
      // handles keystore updates when the switched-to account's vault status changes.
      next: (account) => {
        this.authorizedSshKeys = {};
        if (!useV2) {
          this.logService.info("Active account changed, clearing SSH keys");
          ipc.autofill.sshAgent
            .clearKeys()
            .catch((e) => this.logService.error("Failed to clear SSH keys", e));
        }
      },
      // Triggered by an unexpected error propagating from the account service observable
      error: (e: unknown) => {
        this.logService.error("Error in active account observable", e);
        if (useV2) {
          this.stopAgent().catch((e: unknown) =>
            this.logService.error("Failed to clear and stop SSH agent", e),
          );
        } else {
          ipc.autofill.sshAgent
            .clearKeys()
            .catch((e) => this.logService.error("Failed to clear SSH keys", e));
        }
      },
      // Triggered when the service is torn down: ngOnDestroy emits on destroy$, which
      // completes this observable via takeUntil. Happens on app quit or service teardown.
      complete: () => {
        this.logService.info("Active account observable completed, clearing SSH keys");
        this.authorizedSshKeys = {};
        if (useV2) {
          this.stopAgent().catch((e: unknown) =>
            this.logService.error("Failed to clear and stop SSH agent", e),
          );
        } else {
          ipc.autofill.sshAgent
            .clearKeys()
            .catch((e) => this.logService.error("Failed to clear SSH keys", e));
        }
      },
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
                // Vault locked or logged out: leave existing keys in place, wait for unlock.
                if (status !== AuthenticationStatus.Unlocked) {
                  return EMPTY;
                }
                // Vault unlocked: start the server on first unlock; no-op if already running.
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

  private async rememberAuthorization(cipherId: string): Promise<void> {
    this.authorizedSshKeys[cipherId] = new Date();
  }

  private async needsAuthorization(cipherId: string, isForward: boolean): Promise<boolean> {
    // Agent forwarding ALWAYS needs authorization because it is a remote machine
    if (isForward) {
      return true;
    }

    const promptType = await firstValueFrom(this.desktopSettingsService.sshAgentPromptBehavior$);
    switch (promptType) {
      case SshAgentPromptType.Never:
        return false;
      case SshAgentPromptType.Always:
        return true;
      case SshAgentPromptType.RememberUntilLock:
        return !(cipherId in this.authorizedSshKeys);
    }
  }
}
