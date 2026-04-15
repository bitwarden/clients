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
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CommandDefinition, MessageListener } from "@bitwarden/common/platform/messaging";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
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

    await this.initListeners();
  }

  private async initListeners() {
    // Shared: sign request approval — renderer shows the approval dialog.
    // Contains v1-only sections marked below; see sshagent.unlockrequest for the v2 unlock flow.
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
        // V1, delete with PM-30758: in v2 the native agent calls unlockCallback before
        // signCallback, so the vault is always unlocked before a sign request arrives.
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
            const sshCiphers = ciphers.filter(
              (cipher) => cipher.type === CipherType.SshKey && !cipher.isDeleted,
            );
            const keys = sshCiphers.map((cipher) => {
              return {
                name: cipher.name,
                privateKey: cipher.sshKey.privateKey,
                cipherId: cipher.id,
              };
            });
            await ipc.autofill.sshAgent.setKeys(keys);
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
        takeUntil(this.destroy$),
      )
      .subscribe();

    // V2 only: v1 has no unlock callback; it handles unlock inline in sshagent.signrequest above.
    this.messageListener
      .messages$(new CommandDefinition(SSH_AGENT_IPC_CHANNELS.UNLOCK_REQUEST))
      .pipe(
        withLatestFrom(this.desktopSettingsService.sshAgentEnabled$),
        concatMap(async ([message, enabled]) => {
          const requestId = message.requestId as number;
          if (!enabled) {
            await ipc.autofill.sshAgent.signRequestResponse(requestId, false);
            return;
          }

          const status = await firstValueFrom(this.authService.activeAccountStatus$);
          if (status === AuthenticationStatus.Unlocked) {
            await ipc.autofill.sshAgent.signRequestResponse(requestId, true);
            return;
          }

          ipc.platform.focusWindow();
          this.toastService.showToast({
            variant: "info",
            title: null,
            message: this.i18nService.t("sshAgentUnlockRequired"),
          });

          const unlocked = await firstValueFrom(
            this.authService.activeAccountStatus$.pipe(
              filter((s) => s === AuthenticationStatus.Unlocked),
              timeout({ first: this.SSH_VAULT_UNLOCK_REQUEST_TIMEOUT }),
              map(() => true),
              catchError((error: unknown) => {
                if (error instanceof TimeoutError) {
                  this.toastService.showToast({
                    variant: "error",
                    title: null,
                    message: this.i18nService.t("sshAgentUnlockTimeout"),
                  });
                }
                return of(false);
              }),
            ),
          );

          await ipc.autofill.sshAgent.signRequestResponse(requestId, unlocked);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    // Shared: clear keys on account switch.
    this.accountService.activeAccount$.pipe(skip(1), takeUntil(this.destroy$)).subscribe({
      next: (account) => {
        this.authorizedSshKeys = {};
        this.logService.info("Active account changed, clearing SSH keys");
        ipc.autofill.sshAgent
          .clearKeys()
          .catch((e) => this.logService.error("Failed to clear SSH keys", e));
      },
      error: (e: unknown) => {
        this.logService.error("Error in active account observable", e);
        ipc.autofill.sshAgent
          .clearKeys()
          .catch((e) => this.logService.error("Failed to clear SSH keys", e));
      },
      complete: () => {
        this.logService.info("Active account observable completed, clearing SSH keys");
        this.authorizedSshKeys = {};
        ipc.autofill.sshAgent
          .clearKeys()
          .catch((e) => this.logService.error("Failed to clear SSH keys", e));
      },
    });

    // Shared: periodic key refresh. In v2, setKeys() is a no-op pending PM-30755.
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

          const sshCiphers = ciphers.filter(
            (cipher) => cipher.type === CipherType.SshKey && !cipher.isDeleted,
          );
          const keys = sshCiphers.map((cipher) => {
            return {
              name: cipher.name,
              privateKey: cipher.sshKey.privateKey,
              cipherId: cipher.id,
            };
          });
          await ipc.autofill.sshAgent.setKeys(keys);
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
