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
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CommandDefinition, MessageListener } from "@bitwarden/common/platform/messaging";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, ToastService } from "@bitwarden/components";

import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";
import { ApproveCredentialRequestComponent } from "../components/approve-credential-request";
import {
  CredentialAgentCredential,
  CredentialAgentRequest,
  CredentialRequestStatus,
} from "../models/credential-agent-request";
import { CredentialAgentPromptType } from "../models/credential-agent-setting";
import { CREDENTIAL_AGENT_IPC_CHANNELS } from "../models/ipc-channels";

/**
 * Serves credential requests coming from the native credential agent.
 *
 * ```text
 * credential_client --[ipc]--> agent --[napi]--> main --[message]--> this service
 * ```
 *
 * The service owns everything the agent deliberately does not: unlocking, the approval
 * prompt (per {@link CredentialAgentPromptType}), and the vault lookup.
 */
@Injectable({
  providedIn: "root",
})
export class CredentialAgentService implements OnDestroy {
  /** How long a client waits while the user unlocks their vault before the request is refused. */
  private static readonly UNLOCK_REQUEST_TIMEOUT = 60_000;

  /**
   * Ciphers the user approved for the current unlock session, used by
   * {@link CredentialAgentPromptType.RememberUntilLock}. Cleared on lock and account switch.
   */
  private authorizedCiphers = new Set<string>();

  private destroy$ = new Subject<void>();

  constructor(
    private cipherService: CipherService,
    private totpService: TotpService,
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
    this.listenForRequests();
    this.manageAgentLifecycle();
    this.clearApprovalsOnLockBoundaries();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private listenForRequests() {
    this.messageListener
      .messages$(new CommandDefinition(CREDENTIAL_AGENT_IPC_CHANNELS.REQUEST))
      .pipe(
        withLatestFrom(this.desktopSettingsService.credentialAgentEnabled$),
        concatMap(async ([message, enabled]) => {
          const request = message as unknown as CredentialAgentRequest;
          if (enabled) {
            return request;
          }

          // The agent should not be running at all when disabled; refuse defensively.
          await this.respond(request.requestId, CredentialRequestStatus.Denied);
          return null;
        }),
        filter((request) => request != null),
        switchMap((request) => this.withUnlockedVault(request)),
        concatMap(([request, userId]) => this.serve(request, userId)),
        catchError((error: unknown, source) => {
          this.logService.error("Unexpected error during a credential request", error);
          return source;
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  /**
   * Waits for the vault to be unlocked, prompting the user if necessary. Requests that are
   * not unlocked within {@link UNLOCK_REQUEST_TIMEOUT} are refused and dropped.
   */
  private withUnlockedVault(request: CredentialAgentRequest) {
    return combineLatest([
      this.authService.activeAccountStatus$,
      this.accountService.activeAccount$,
    ]).pipe(
      take(1),
      switchMap(([status, account]) => {
        if (status === AuthenticationStatus.Unlocked && account != null) {
          return of([request, account.id] as const);
        }

        ipc.platform.focusWindow();
        this.toastService.showToast({
          variant: "info",
          title: null,
          message: this.i18nService.t("credentialAgentUnlockRequired"),
        });

        return this.authService.activeAccountStatus$.pipe(
          filter((s) => s === AuthenticationStatus.Unlocked),
          timeout({ first: CredentialAgentService.UNLOCK_REQUEST_TIMEOUT }),
          catchError((error: unknown) => {
            if (!(error instanceof TimeoutError)) {
              throw error;
            }

            return from(this.respond(request.requestId, CredentialRequestStatus.Denied)).pipe(
              switchMap(() => EMPTY),
            );
          }),
          concatMap(async () => {
            // The active account may have changed while the user was unlocking.
            const account = await firstValueFrom(this.accountService.activeAccount$);
            return [request, account.id] as const;
          }),
        );
      }),
    );
  }

  /** Matches the request against the vault, asks for approval, and answers the client. */
  private async serve(request: CredentialAgentRequest, userId: UserId): Promise<void> {
    const ciphers = await this.cipherService.getAllDecrypted(userId);
    const cipher = this.findCipher(ciphers ?? [], request);

    if (cipher == null) {
      await this.respond(request.requestId, CredentialRequestStatus.NotFound);
      return;
    }

    if (!(await this.isApproved(cipher, request))) {
      await this.respond(request.requestId, CredentialRequestStatus.Denied);
      return;
    }

    await this.respond(
      request.requestId,
      CredentialRequestStatus.Granted,
      await this.toCredential(cipher),
    );
  }

  /**
   * Finds the single best match for the request. A request may filter by URI, by name, or
   * both; when both are given the item must satisfy both.
   */
  private findCipher(ciphers: CipherView[], request: CredentialAgentRequest): CipherView | null {
    const name = request.name?.toLowerCase();

    const matches = ciphers.filter((cipher) => {
      if (cipher.type !== CipherType.Login || cipher.isDeleted || cipher.isArchived) {
        return false;
      }
      if (request.uri != null && !cipher.login.matchesUri(request.uri, new Set<string>())) {
        return false;
      }
      if (name != null && !cipher.name?.toLowerCase().includes(name)) {
        return false;
      }
      return true;
    });

    if (matches.length > 1) {
      this.logService.info(
        `Credential request matched ${matches.length} items; serving the first match.`,
      );
    }

    return matches[0] ?? null;
  }

  private async isApproved(cipher: CipherView, request: CredentialAgentRequest): Promise<boolean> {
    const promptType = await firstValueFrom(
      this.desktopSettingsService.credentialAgentPromptBehavior$,
    );

    if (promptType === CredentialAgentPromptType.Never) {
      return true;
    }

    if (
      promptType === CredentialAgentPromptType.RememberUntilLock &&
      this.authorizedCiphers.has(cipher.id)
    ) {
      return true;
    }

    ipc.platform.focusWindow();
    const application = request.processName || this.i18nService.t("unknownApplication");
    const dialogRef = ApproveCredentialRequestComponent.open(
      this.dialogService,
      cipher.name,
      application,
    );

    const approved = (await firstValueFrom(dialogRef.closed)) === true;
    if (approved && promptType === CredentialAgentPromptType.RememberUntilLock) {
      this.authorizedCiphers.add(cipher.id);
    }

    return approved;
  }

  private async toCredential(cipher: CipherView): Promise<CredentialAgentCredential> {
    return {
      cipherId: cipher.id,
      name: cipher.name,
      username: cipher.login.username ?? undefined,
      password: cipher.login.password ?? undefined,
      totp: await this.currentTotpCode(cipher),
    };
  }

  /** Returns the current TOTP code, or undefined when the item has none or it cannot be generated. */
  private async currentTotpCode(cipher: CipherView): Promise<string | undefined> {
    if (!cipher.login.totp) {
      return undefined;
    }

    try {
      const response = await firstValueFrom(this.totpService.getCode$(cipher.login.totp));
      return response?.code;
    } catch (e) {
      this.logService.error("Failed to generate a TOTP code for a credential request", e);
      return undefined;
    }
  }

  private async respond(
    requestId: number,
    status: CredentialRequestStatus,
    credential?: CredentialAgentCredential,
  ): Promise<void> {
    try {
      await ipc.autofill.credentialAgent.requestResponse({ requestId, status, credential });
    } catch (e) {
      this.logService.error("Failed to answer a credential request", e);
    }
  }

  /** Starts the agent while the setting is on and an account is present; stops it otherwise. */
  private manageAgentLifecycle() {
    combineLatest([
      this.desktopSettingsService.credentialAgentEnabled$,
      this.accountService.activeAccount$,
    ])
      .pipe(
        concatMap(async ([enabled, account]) => {
          if (enabled && account != null) {
            await this.ensureAgentRunning();
            return;
          }
          await this.stopAgent();
        }),
        catchError((error: unknown) => {
          this.logService.error("Credential agent lifecycle stopped by an error", error);
          return EMPTY;
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  /**
   * Remembered approvals must not outlive the unlock session they were granted in, so they
   * are dropped whenever the vault leaves the unlocked state or the active account changes.
   */
  private clearApprovalsOnLockBoundaries() {
    this.authService.activeAccountStatus$
      .pipe(
        filter((status) => status !== AuthenticationStatus.Unlocked),
        takeUntil(this.destroy$),
      )
      .subscribe(() => this.authorizedCiphers.clear());

    this.accountService.activeAccount$
      .pipe(
        // activeAccount$ also re-emits on unrelated AccountInfo changes.
        distinctUntilChanged((a, b) => a?.id === b?.id),
        // Ignore the initial account load.
        skip(1),
        takeUntil(this.destroy$),
      )
      .subscribe(() => this.authorizedCiphers.clear());
  }

  private async ensureAgentRunning(): Promise<void> {
    try {
      if (!(await ipc.autofill.credentialAgent.isLoaded())) {
        await ipc.autofill.credentialAgent.init();
      }
    } catch (e) {
      this.logService.error("Failed to start the credential agent", e);
    }
  }

  private async stopAgent(): Promise<void> {
    try {
      if (await ipc.autofill.credentialAgent.isLoaded()) {
        await ipc.autofill.credentialAgent.stop();
      }
    } catch (e) {
      this.logService.error("Failed to stop the credential agent", e);
    }
  }
}
