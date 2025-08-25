// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable, OnDestroy } from "@angular/core";
import {
  catchError,
  combineLatest,
  concatMap,
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
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CommandDefinition, MessageListener } from "@bitwarden/common/platform/messaging";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { DialogService, ToastService } from "@bitwarden/components";

import { ApproveSshRequestComponent } from "../../platform/components/approve-ssh-request";
import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";
import { SshAgentPromptType } from "../models/ssh-agent-setting";
import { decrypt_ssh_key_for_agent } from "@bitwarden/sdk-internal";

@Injectable({
  providedIn: "root",
})
export class SshAgentService implements OnDestroy {
  SSH_REFRESH_INTERVAL = 1000;
  SSH_VAULT_UNLOCK_REQUEST_TIMEOUT = 60_000;
  SSH_REQUEST_UNLOCK_POLLING_INTERVAL = 100;

  private authorizedSshKeys: Record<string, Date> = {};

  private isFeatureFlagEnabled = false;

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
  ) {}

  async init() {
    this.desktopSettingsService.sshAgentEnabled$
      .pipe(
        concatMap(async (enabled) => {
          if (!(await ipc.platform.sshAgent.isLoaded()) && enabled) {
            await ipc.platform.sshAgent.init();
          }
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    await this.initListeners();
  }

  private async initListeners() {
    this.messageListener
      .messages$(new CommandDefinition("sshagent.signrequest"))
      .pipe(
        withLatestFrom(this.desktopSettingsService.sshAgentEnabled$),
        concatMap(async ([message, enabled]) => {
          if (!enabled) {
            await ipc.platform.sshAgent.signRequestResponse(message.requestId as number, false);
          }
          return { message, enabled };
        }),
        filter(({ enabled }) => enabled),
        map(({ message }) => message),
        withLatestFrom(this.authService.activeAccountStatus$, this.accountService.activeAccount$),
        // This switchMap handles unlocking the vault if it is locked:
        //   - If the vault is locked, we will wait for it to be unlocked.
        //   - If the vault is not unlocked within the timeout, we will abort the flow.
        //   - If the vault is unlocked, we will continue with the flow.
        // switchMap is used here to prevent multiple requests from being processed at the same time,
        // and will cancel the previous request if a new one is received.
        switchMap(([message, status, account]) => {
          if (status !== AuthenticationStatus.Unlocked) {
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
                  return from(ipc.platform.sshAgent.signRequestResponse(requestId, false)).pipe(
                    map(() => EMPTY),
                  );
                }

                throw error;
              }),
              map(() => [message, account.id]),
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

          if (isListRequest) {
            const sshCiphers = ciphers.filter(
              (cipher) =>
                cipher.type === CipherType.SshKey &&
                !cipher.isDeleted &&
                cipher.organizationId == null,
            );
            const keys = await Promise.all(
              sshCiphers.map(async (cipher: any) => {
                let pk = cipher.sshKey.privateKey;
                const original = (cipher.sshKey as any).originalPrivateKey ?? cipher.sshKey.privateKey;
                const pass = (cipher.sshKey as any).sshKeyPassphrase;
                if (pass) {
                  try {
                    pk = await decrypt_ssh_key_for_agent(original, pass);
                  } catch {
                    // leave pk as-is if decryption fails
                  }
                }
                return {
                  name: cipher.name,
                  privateKey: pk,
                  cipherId: cipher.id,
                };
              }),
            );
            await ipc.platform.sshAgent.setKeys(keys);
            await ipc.platform.sshAgent.signRequestResponse(requestId, true);
            return;
          }

          if (ciphers === undefined) {
            ipc.platform.sshAgent
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
              return ipc.platform.sshAgent.signRequestResponse(requestId, true);
            } else {
              return ipc.platform.sshAgent.signRequestResponse(requestId, false);
            }
          } else {
            return ipc.platform.sshAgent.signRequestResponse(requestId, true);
          }
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.accountService.activeAccount$.pipe(skip(1), takeUntil(this.destroy$)).subscribe({
      next: (account: any) => {
        if (!this.isFeatureFlagEnabled) {
          return;
        }

        this.authorizedSshKeys = {};
        this.logService.info("Active account changed, clearing SSH keys");
        ipc.platform.sshAgent
          .clearKeys()
          .catch((e) => this.logService.error("Failed to clear SSH keys", e));
      },
      error: (e: unknown) => {
        if (!this.isFeatureFlagEnabled) {
          return;
        }

        this.logService.error("Error in active account observable", e);
        ipc.platform.sshAgent
          .clearKeys()
          .catch((e) => this.logService.error("Failed to clear SSH keys", e));
      },
      complete: () => {
        if (!this.isFeatureFlagEnabled) {
          return;
        }

        this.logService.info("Active account observable completed, clearing SSH keys");
        this.authorizedSshKeys = {};
        ipc.platform.sshAgent
          .clearKeys()
          .catch((e) => this.logService.error("Failed to clear SSH keys", e));
      },
    });

    combineLatest([
      timer(0, this.SSH_REFRESH_INTERVAL),
      this.desktopSettingsService.sshAgentEnabled$,
    ])
      .pipe(
        concatMap(async ([, enabled]: [unknown, boolean]) => {
          if (!this.isFeatureFlagEnabled) {
            return;
          }

          if (!enabled) {
            await ipc.platform.sshAgent.clearKeys();
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
            await ipc.platform.sshAgent.lock();
            return;
          }

          const sshCiphers = ciphers.filter(
            (cipher) =>
              cipher.type === CipherType.SshKey &&
              !cipher.isDeleted &&
              cipher.organizationId == null,
          );
          const keys = await Promise.all(
            sshCiphers.map(async (cipher: any) => {
              let pk = cipher.sshKey.privateKey;
              const original = (cipher.sshKey as any).originalPrivateKey ?? cipher.sshKey.privateKey;
              const pass = (cipher.sshKey as any).sshKeyPassphrase;
              if (pass) {
                try {
                  pk = await decrypt_ssh_key_for_agent(original, pass);
                } catch {
                  // leave pk as-is if decryption fails
                }
              }
              return {
                name: cipher.name,
                privateKey: pk,
                cipherId: cipher.id,
              };
            }),
          );
          await ipc.platform.sshAgent.setKeys(keys);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
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
