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
import { LoadSomeKeysComponent } from "../../platform/components/load-some-keys";
import { SelectSshKeyComponent } from "../../platform/components/select-ssh-key";
import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";
import { SshAgentKeySelectionMode, SshAgentPromptType } from "../models/ssh-agent-setting";

@Injectable({
  providedIn: "root",
})
export class SshAgentService implements OnDestroy {
  SSH_REFRESH_INTERVAL = 1000;
  SSH_VAULT_UNLOCK_REQUEST_TIMEOUT = 60_000;
  SSH_REQUEST_UNLOCK_POLLING_INTERVAL = 100;

  private authorizedSshKeys: Record<string, Date> = {};
  private currentlySelectedSshKeyId: string | null = null;

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

    // Clear selected keys when vault locks in LoadSomeKeys mode
    this.authService.activeAccountStatus$
      .pipe(
        filter((status) => status === AuthenticationStatus.Locked),
        concatMap(async () => {
          const mode = await firstValueFrom(this.desktopSettingsService.sshAgentKeySelectionMode$);
          if (mode === SshAgentKeySelectionMode.LoadSomeKeys) {
            await this.desktopSettingsService.setSshAgentSelectedKeyIds([]);
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
        // This switchMap handles unlocking the vault if it is not unlocked:
        //   - If the vault is locked or logged out, we will wait for it to be unlocked:
        //   - If the vault is not unlocked in within the timeout, we will abort the flow.
        //   - If the vault is unlocked, we will continue with the flow.
        // switchMap is used here to prevent multiple requests from being processed at the same time,
        // and will cancel the previous request if a new one is received.
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
                  return from(ipc.platform.sshAgent.signRequestResponse(requestId, false)).pipe(
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
        // Get the key selection mode setting
        withLatestFrom(this.desktopSettingsService.sshAgentKeySelectionMode$),
        // This concatMap handles showing the dialog to approve the request.
        concatMap(async ([[message, ciphers], keySelectionMode]) => {
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
              (cipher) => cipher.type === CipherType.SshKey && !cipher.isDeleted,
            );

            let keysToSend;
            if (keySelectionMode === SshAgentKeySelectionMode.SelectKey) {
              // Clear any previously selected key to force selection on each new connection
              this.currentlySelectedSshKeyId = null;

              // In SelectKey mode, we need to prompt the user to select a key
              if (sshCiphers.length === 0) {
                this.toastService.showToast({
                  variant: "error",
                  title: null,
                  message: this.i18nService.t("noSshKeysFound"),
                });
                await ipc.platform.sshAgent.signRequestResponse(requestId, false);
                return;
              }

              ipc.platform.focusWindow();
              const selectDialogRef = SelectSshKeyComponent.open(
                this.dialogService,
                sshCiphers,
                application,
                namespace,
              );

              const selectedKeyId = await firstValueFrom(selectDialogRef.closed);
              if (!selectedKeyId) {
                await ipc.platform.sshAgent.signRequestResponse(requestId, false);
                return;
              }

              this.currentlySelectedSshKeyId = selectedKeyId;

              // Send only the selected key
              const selectedCipher = sshCiphers.find(
                (cipher) => cipher.id === this.currentlySelectedSshKeyId,
              );
              keysToSend = selectedCipher
                ? [
                    {
                      name: selectedCipher.name,
                      privateKey: selectedCipher.sshKey.privateKey,
                      cipherId: selectedCipher.id,
                    },
                  ]
                : [];
            } else if (keySelectionMode === SshAgentKeySelectionMode.LoadSomeKeys) {
              // In LoadSomeKeys mode, check if keys are already selected
              const selectedKeyIds = await firstValueFrom(
                this.desktopSettingsService.sshAgentSelectedKeyIds$,
              );

              if (!selectedKeyIds || selectedKeyIds.length === 0) {
                // No keys selected yet - prompt user to select
                ipc.platform.focusWindow();
                const dialogRef = LoadSomeKeysComponent.open(this.dialogService, sshCiphers);
                const newSelectedIds = await firstValueFrom(dialogRef.closed);

                if (!newSelectedIds || newSelectedIds.length === 0) {
                  await ipc.platform.sshAgent.signRequestResponse(requestId, false);
                  return;
                }

                await this.desktopSettingsService.setSshAgentSelectedKeyIds(newSelectedIds);

                const selectedCiphers = sshCiphers.filter((cipher) =>
                  newSelectedIds.includes(cipher.id),
                );
                keysToSend = selectedCiphers.map((cipher) => ({
                  name: cipher.name,
                  privateKey: cipher.sshKey.privateKey,
                  cipherId: cipher.id,
                }));
              } else {
                // Keys already selected - use them
                const selectedCiphers = sshCiphers.filter((cipher) =>
                  selectedKeyIds.includes(cipher.id),
                );
                keysToSend = selectedCiphers.map((cipher) => ({
                  name: cipher.name,
                  privateKey: cipher.sshKey.privateKey,
                  cipherId: cipher.id,
                }));
              }
            } else {
              // In AllKeys mode, send all keys
              keysToSend = sshCiphers.map((cipher) => {
                return {
                  name: cipher.name,
                  privateKey: cipher.sshKey.privateKey,
                  cipherId: cipher.id,
                };
              });
            }

            await ipc.platform.sshAgent.setKeys(keysToSend);
            await ipc.platform.sshAgent.signRequestResponse(requestId, true);
            return;
          }

          if (ciphers === undefined) {
            ipc.platform.sshAgent
              .signRequestResponse(requestId, false)
              .catch((e) => this.logService.error("Failed to respond to SSH request", e));
          }

          const sshCiphers = ciphers.filter(
            (cipher) => cipher.type === CipherType.SshKey && !cipher.isDeleted,
          );

          if (keySelectionMode === SshAgentKeySelectionMode.SelectKey) {
            // Only ask user to select if no key is currently selected
            if (!this.currentlySelectedSshKeyId) {
              ipc.platform.focusWindow();
              const selectDialogRef = SelectSshKeyComponent.open(
                this.dialogService,
                sshCiphers,
                application,
                namespace,
              );

              const selectedKeyId = await firstValueFrom(selectDialogRef.closed);
              if (!selectedKeyId) {
                return ipc.platform.sshAgent.signRequestResponse(requestId, false);
              }

              this.currentlySelectedSshKeyId = selectedKeyId;
            }

            const selectedCipher = sshCiphers.find(
              (cipher) => cipher.id === this.currentlySelectedSshKeyId,
            );

            // The key was already set during the list request, no need to set it again

            if (await this.needsAuthorization(this.currentlySelectedSshKeyId, isAgentForwarding)) {
              const approveDialogRef = ApproveSshRequestComponent.open(
                this.dialogService,
                selectedCipher.name,
                application,
                isAgentForwarding,
                namespace,
              );

              if (await firstValueFrom(approveDialogRef.closed)) {
                await this.rememberAuthorization(this.currentlySelectedSshKeyId);
                await ipc.platform.sshAgent.signRequestResponse(requestId, true);
                // Don't clear keys here - they're needed for the actual signing
                // Keys will be cleared on next list request
                return;
              } else {
                this.currentlySelectedSshKeyId = null;
                return ipc.platform.sshAgent.signRequestResponse(requestId, false);
              }
            } else {
              await ipc.platform.sshAgent.signRequestResponse(requestId, true);
              // Don't clear keys here - they're needed for the actual signing
              // Keys will be cleared on next list request
              return;
            }
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
      next: (account) => {
        this.authorizedSshKeys = {};
        this.logService.info("Active account changed, clearing SSH keys");
        ipc.platform.sshAgent
          .clearKeys()
          .catch((e) => this.logService.error("Failed to clear SSH keys", e));
      },
      error: (e: unknown) => {
        this.logService.error("Error in active account observable", e);
        ipc.platform.sshAgent
          .clearKeys()
          .catch((e) => this.logService.error("Failed to clear SSH keys", e));
      },
      complete: () => {
        this.logService.info("Active account observable completed, clearing SSH keys");
        this.authorizedSshKeys = {};
        this.currentlySelectedSshKeyId = null;
        ipc.platform.sshAgent
          .clearKeys()
          .catch((e) => this.logService.error("Failed to clear SSH keys", e));
      },
    });

    combineLatest([
      timer(0, this.SSH_REFRESH_INTERVAL),
      this.desktopSettingsService.sshAgentEnabled$,
      this.desktopSettingsService.sshAgentKeySelectionMode$,
    ])
      .pipe(
        concatMap(async ([, enabled, keySelectionMode]) => {
          if (!enabled) {
            await ipc.platform.sshAgent.clearKeys();
            this.currentlySelectedSshKeyId = null;
            return;
          }

          const activeAccount = await firstValueFrom(this.accountService.activeAccount$);
          const authStatus = await firstValueFrom(
            this.authService.authStatusFor$(activeAccount.id),
          );
          if (authStatus !== AuthenticationStatus.Unlocked) {
            this.currentlySelectedSshKeyId = null;
            return;
          }

          const ciphers = await this.cipherService.getAllDecrypted(activeAccount.id);
          if (ciphers == null) {
            await ipc.platform.sshAgent.lock();
            this.currentlySelectedSshKeyId = null;
            return;
          }

          if (keySelectionMode === SshAgentKeySelectionMode.SelectKey) {
            return;
          }

          const sshCiphers = ciphers.filter(
            (cipher) => cipher.type === CipherType.SshKey && !cipher.isDeleted,
          );

          if (keySelectionMode === SshAgentKeySelectionMode.LoadSomeKeys) {
            const selectedKeyIds = await firstValueFrom(
              this.desktopSettingsService.sshAgentSelectedKeyIds$,
            );

            if (!selectedKeyIds || selectedKeyIds.length === 0) {
              await ipc.platform.sshAgent.clearKeys();
              return;
            }

            const selectedCiphers = sshCiphers.filter((cipher) =>
              selectedKeyIds.includes(cipher.id),
            );

            const keys = selectedCiphers.map((cipher) => ({
              name: cipher.name,
              privateKey: cipher.sshKey.privateKey,
              cipherId: cipher.id,
            }));

            await ipc.platform.sshAgent.setKeys(keys);
            return;
          }

          // AllKeys mode
          const keys = sshCiphers.map((cipher) => {
            return {
              name: cipher.name,
              privateKey: cipher.sshKey.privateKey,
              cipherId: cipher.id,
            };
          });
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
