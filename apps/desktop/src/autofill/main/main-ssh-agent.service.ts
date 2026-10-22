// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import * as path from "path";

import { ipcMain, Notification } from "electron";
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
  skip,
  Subject,
  switchMap,
  take,
  takeUntil,
  tap,
  timeout,
  TimeoutError,
} from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { sshagent } from "@bitwarden/desktop-napi";

import { WindowMain } from "../../main/window.main";
import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";
import { SSH_AGENT_IPC_CHANNELS } from "../models/ipc-channels";
import { SshAgentPromptType } from "../models/ssh-agent-setting";

/**
 * Namespacing for cached sign authorizations.
 */
const AuthorizationScope = Object.freeze({
  Local: "local",
  Forwarded: "forwarded",
} as const);
type AuthorizationScope = (typeof AuthorizationScope)[keyof typeof AuthorizationScope];

/**
 * The SSH agent, owned entirely by the main process.
 *
 * The socket server, protocol parsing, and signing run in Rust (via napi). This service now also
 * provisions the agent's keys (decrypting vault SSH-key ciphers), owns the sign-authorization cache
 * and prompt-behavior decision, and — only when a prompt is genuinely needed — force-shows the
 * renderer and delegates the approval dialog to it over the `SIGN_REQUEST`/`SIGN_REQUEST_RESPONSE`
 * round-trip. The renderer is therefore a pure dialog host.
 */
export class MainSshAgentService {
  private static readonly UNLOCK_REQUEST_TIMEOUT = 60_000;

  // The napi callback requestSign() is awaited directly by the Rust agent, so it must return a
  // Promise that resolves with the user's decision. When a dialog is needed the renderer responds
  // over IPC, so this map correlates each in-flight request id back to its waiting Promise.
  private pendingRequests = new Map<number, (accepted: boolean) => void>();
  private requestId = 0;
  private agentState: sshagent.SshAgentState;
  private authorizedHosts: Map<string, Set<string>> = new Map();
  private destroy$ = new Subject<void>();

  constructor(
    private logService: LogService,
    private messagingService: MessagingService,
    private cipherService: CipherService,
    private authService: AuthService,
    private accountService: AccountService,
    private desktopSettingsService: DesktopSettingsService,
    private i18nService: I18nService,
    private windowMain: WindowMain,
  ) {
    this.registerIpcHandlers();
  }

  /** Starts the reactive key-provisioning and authorization-reset pipelines. */
  init(): void {
    // Reset sign-approval state on account switch.
    this.accountService.activeAccount$
      .pipe(
        distinctUntilChanged((a, b) => a?.id === b?.id),
        skip(1),
        tap(() => {
          this.logService.debug("Active account changed, resetting SSH sign approval state");
          this.authorizedHosts = new Map();
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        error: (e: unknown) => {
          this.logService.error("Error in active account observable", e);
          this.authorizedHosts = new Map();
        },
        complete: () => {
          this.authorizedHosts = new Map();
        },
      });

    // Clear remembered sign-approvals whenever the vault is locked.
    this.authService.activeAccountStatus$
      .pipe(
        filter((status) => status !== AuthenticationStatus.Unlocked),
        takeUntil(this.destroy$),
      )
      .subscribe(() => {
        this.authorizedHosts = new Map();
      });

    // Push SSH keys to the agent reactively whenever cipher data changes while unlocked.
    this.accountService.activeAccount$
      .pipe(
        switchMap((account) => {
          if (account == null) {
            return from(this.stopAgent());
          }
          return combineLatest([
            this.authService.authStatusFor$(account.id),
            this.desktopSettingsService.sshAgentEnabled$,
          ]).pipe(
            switchMap(([status, enabled]) => {
              if (!enabled) {
                return from(this.stopAgent());
              }
              if (status === AuthenticationStatus.LoggedOut) {
                return EMPTY;
              }
              return from(this.ensureAgentRunning()).pipe(
                switchMap(() => this.cipherService.cipherViews$(account.id)),
                filter((views) => views != null),
                map((views) => this.toAgentKeys(views)),
                distinctUntilChanged((prev, curr) => {
                  if (prev.length !== curr.length) {
                    return false;
                  }
                  const prevMap = new Map(
                    prev.map((k) => [k.cipherId, { privateKey: k.privateKey, name: k.name }]),
                  );
                  return curr.every((k) => {
                    const p = prevMap.get(k.cipherId);
                    return p?.privateKey === k.privateKey && p?.name === k.name;
                  });
                }),
                concatMap(async (keys) => {
                  try {
                    this.replace(keys);
                  } catch (e) {
                    this.logService.error("Failed to push SSH keys to the agent", e);
                  }
                }),
                catchError((error: unknown) => {
                  this.logService.error("Unexpected error while syncing SSH keys", error);
                  return EMPTY;
                }),
              );
            }),
          );
        }),
        catchError((error: unknown) => {
          this.logService.error("SSH agent key pipeline stopped by an unrecoverable error", error);
          return EMPTY;
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  dispose(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private registerIpcHandlers() {
    ipcMain.handle(
      SSH_AGENT_IPC_CHANNELS.SIGN_REQUEST_RESPONSE,
      async (_, { requestId, accepted }: { requestId: number; accepted: boolean }) => {
        this.pendingRequests.get(requestId)?.(accepted);
        this.pendingRequests.delete(requestId);
      },
    );
  }

  private async initAgent(): Promise<void> {
    const signCb = (_err: Error | null, data: sshagent.SignRequestData) => this.requestSign(data);
    const listCb = (_err: Error | null) => this.requestListKeys();
    try {
      this.agentState = await sshagent.SshAgentState.serve(signCb, listCb);
      this.logService.info("SSH agent started");
    } catch (e: unknown) {
      this.logService.error("SSH agent encountered an error: ", e);
    }
  }

  private async ensureAgentRunning(): Promise<void> {
    if (this.agentState == null || !this.agentState.isRunning()) {
      await this.initAgent();
    }
  }

  private async stopAgent(): Promise<void> {
    if (this.agentState != null) {
      this.agentState.stop();
      this.agentState = null;
    }
  }

  private replace(keys: { name: string; privateKey: string; cipherId: string }[]): void {
    if (this.agentState != null && this.agentState.isRunning()) {
      this.agentState.replace(keys);
    }
  }

  private toAgentKeys(
    ciphers: CipherView[],
  ): { name: string; privateKey: string; cipherId: string }[] {
    return ciphers
      .filter((c) => c.type === CipherType.SshKey && !c.isDeleted && !c.isArchived)
      .map((c) => ({ name: c.name, privateKey: c.sshKey.privateKey, cipherId: c.id }));
  }

  private async requestListKeys(): Promise<boolean> {
    if (!(await this.waitForUnlock())) {
      return false;
    }

    try {
      const account = await firstValueFrom(this.accountService.activeAccount$);
      if (account == null) {
        return false;
      }
      const ciphers = await this.cipherService.getAllDecrypted(account.id);
      this.replace(this.toAgentKeys(ciphers ?? []));
      return true;
    } catch (e) {
      this.logService.error("Failed to push SSH keys to the agent", e);
      return false;
    }
  }

  private async requestSign(data: sshagent.SignRequestData): Promise<boolean> {
    if (!(await firstValueFrom(this.desktopSettingsService.sshAgentEnabled$))) {
      return false;
    }
    if (!(await this.waitForUnlock())) {
      return false;
    }

    let ciphers: CipherView[];
    try {
      const account = await firstValueFrom(this.accountService.activeAccount$);
      if (account == null) {
        return false;
      }
      ciphers = await this.cipherService.getAllDecrypted(account.id);
    } catch (e) {
      this.logService.error("Failed to decrypt the vault for an SSH sign request", e);
      return false;
    }

    // The agent derives cipherId from its own keystore, which outlives a vault lock and an account
    // switch, so a cipher received in the request might not be present in the active vault.
    const cipher = ciphers?.find((c) => c.id === data.cipherId);
    if (cipher == null) {
      this.logService.error(
        "SSH sign request received for key not in the active vault; rejecting.",
      );
      return false;
    }

    let application = data.signRequest.processName;
    if (application === "") {
      application = this.i18nService.t("unknownApplication");
    }

    await this.showSignRequestNotification(cipher.name, application);

    const isAgentForwarding = data.signRequest.isForwarding;
    const hostFingerprint = data.signRequest.hostFingerprint;
    if (!(await this.needsAuthorization(data.cipherId, isAgentForwarding, hostFingerprint))) {
      return true;
    }

    const id = ++this.requestId;
    return new Promise((resolve) => {
      this.pendingRequests.set(id, (accepted) => {
        if (accepted) {
          this.storeAuthorizedHost(data.cipherId, isAgentForwarding, hostFingerprint);
        }
        resolve(accepted);
      });
      void this.windowMain.ensureRenderer();
      this.messagingService.send(SSH_AGENT_IPC_CHANNELS.SIGN_REQUEST, {
        requestId: id,
        cipherName: cipher.name,
        application: application,
        isAgentForwarding: isAgentForwarding,
        namespace: data.signRequest.namespace,
      });
    });
  }

  private async showSignRequestNotification(cipherName: string, application: string): Promise<void> {
    try {
      const alert = new Notification({
        title: this.i18nService.t("sshAgentApprovalNotificationTitle"),
        body: this.i18nService.t("sshAgentApprovalNotificationBody", application, cipherName),
        closeButtonText: this.i18nService.t("close"),
        icon: path.join(__dirname, "images/icon.png"),
      });
      alert.addListener("click", () => {
        void this.windowMain.ensureRenderer();
      });
      alert.show();
    } catch (e) {
      this.logService.error("Failed to show the SSH agent sign request notification", e);
    }
  }

  private async waitForUnlock(): Promise<boolean> {
    const status = await firstValueFrom(this.authService.activeAccountStatus$);
    if (status === AuthenticationStatus.Unlocked) {
      return true;
    }

    await this.windowMain.ensureRenderer();
    try {
      await firstValueFrom(
        this.authService.activeAccountStatus$.pipe(
          filter((s) => s === AuthenticationStatus.Unlocked),
          take(1),
          timeout({ first: MainSshAgentService.UNLOCK_REQUEST_TIMEOUT }),
        ),
      );
      return true;
    } catch (e: unknown) {
      if (e instanceof TimeoutError) {
        this.logService.info("SSH agent sign request timed out waiting for unlock");
      }
      return false;
    }
  }

  private async needsAuthorization(
    cipherId: string,
    isForwarded: boolean,
    hostFingerprint?: string,
  ): Promise<boolean> {
    const scope = MainSshAgentService.authorizationScope(isForwarded);
    const promptType = await firstValueFrom(this.desktopSettingsService.sshAgentPromptBehavior$);

    switch (promptType) {
      case SshAgentPromptType.Never:
        this.logAuthorizationDecision(scope, promptType, "approving.");
        return false;

      case SshAgentPromptType.Always:
        this.logAuthorizationDecision(scope, promptType, "prompting.");
        return true;

      case SshAgentPromptType.RememberUntilLock: {
        const key = MainSshAgentService.authorizedHostsCacheKey(isForwarded, hostFingerprint);
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

  private storeAuthorizedHost(
    cipherId: string,
    isForwarded: boolean,
    hostFingerprint?: string,
  ): void {
    const key = MainSshAgentService.authorizedHostsCacheKey(isForwarded, hostFingerprint);
    if (!key) {
      return;
    }
    const authorized = this.authorizedHosts.get(cipherId) ?? new Set<string>();
    authorized.add(key);
    this.authorizedHosts.set(cipherId, authorized);
  }

  private static authorizationScope(isForwarded: boolean): AuthorizationScope {
    return isForwarded ? AuthorizationScope.Forwarded : AuthorizationScope.Local;
  }

  private static authorizedHostsCacheKey(
    isForwarded: boolean,
    hostFingerprint?: string,
  ): string | undefined {
    const scope = MainSshAgentService.authorizationScope(isForwarded);
    if (hostFingerprint) {
      return `${scope}:${hostFingerprint}`;
    }
    if (isForwarded) {
      return undefined;
    }
    return AuthorizationScope.Local;
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
}
