import { Injectable, OnDestroy } from "@angular/core";
import {
  catchError,
  combineLatest,
  concatMap,
  EMPTY,
  filter,
  from,
  map,
  of,
  Subject,
  switchMap,
  takeUntil,
  timeout,
  TimeoutError,
  timer,
  withLatestFrom,
} from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CommandDefinition, MessageListener } from "@bitwarden/common/platform/messaging";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { DialogService, ToastService } from "@bitwarden/components";

import { ApproveSshRequestComponent } from "../components/approve-ssh-request";

import { DesktopSettingsService } from "./desktop-settings.service";

@Injectable({
  providedIn: "root",
})
export class SshAgentService implements OnDestroy {
  SSH_REFRESH_INTERVAL = 1000;
  SSH_VAULT_UNLOCK_REQUEST_TIMEOUT = 1000 * 60;
  SSH_REQUEST_UNLOCK_POLLING_INTERVAL = 100;

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
  ) {}

  init() {
    this.messageListener
      .messages$(new CommandDefinition("sshagent.signrequest"))
      .pipe(
        withLatestFrom(this.authService.activeAccountStatus$),
        // This switchMap handles unlocking the vault if it is locked:
        //   - If the vault is locked, we will wait for it to be unlocked.
        //   - If the vault is not unlocked within the timeout, we will abort the flow.
        //   - If the vault is unlocked, we will continue with the flow.
        // switchMap is used here to prevent multiple requests from being processed at the same time,
        // and will cancel the previous request if a new one is received.
        switchMap(([message, status]) => {
          if (status !== AuthenticationStatus.Unlocked) {
            ipc.platform.focusWindow();
            this.toastService.showToast({
              variant: "info",
              title: null,
              message: this.i18nService.t("sshAgentUnlockRequired"),
            });
            return this.authService.activeAccountStatus$.pipe(
              filter((status) => status === AuthenticationStatus.Unlocked),
              timeout(this.SSH_VAULT_UNLOCK_REQUEST_TIMEOUT),
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
              map(() => message),
            );
          }

          return of(message);
        }),
        // This switchMap handles fetching the ciphers from the vault.
        switchMap((message) =>
          from(this.cipherService.getAllDecrypted()).pipe(
            map((ciphers) => [message, ciphers] as const),
          ),
        ),
        // This concatMap handles showing the dialog to approve the request.
        concatMap(([message, decryptedCiphers]) => {
          const cipherId = message.cipherId as string;
          const requestId = message.requestId as number;

          if (decryptedCiphers === undefined) {
            return of(false).pipe(
              switchMap((result) =>
                ipc.platform.sshAgent.signRequestResponse(requestId, Boolean(result)),
              ),
            );
          }

          const cipher = decryptedCiphers.find((cipher) => cipher.id == cipherId);

          ipc.platform.focusWindow();
          const dialogRef = ApproveSshRequestComponent.open(
            this.dialogService,
            cipher.name,
            this.i18nService.t("unknownApplication"),
          );

          return dialogRef.closed.pipe(
            switchMap((result) => {
              return ipc.platform.sshAgent.signRequestResponse(requestId, Boolean(result));
            }),
          );
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    combineLatest([
      timer(0, this.SSH_REFRESH_INTERVAL),
      this.desktopSettingsService.sshAgentEnabled$,
    ])
      .pipe(
        concatMap(async ([, enabled]) => {
          if (!enabled) {
            await ipc.platform.sshAgent.setKeys([]);
            return;
          }

          const ciphers = await this.cipherService.getAllDecrypted();
          if (ciphers == null) {
            await ipc.platform.sshAgent.lock();
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
}
