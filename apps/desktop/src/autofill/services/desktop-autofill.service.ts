import { Injectable, OnDestroy } from "@angular/core";
import {
  Subject,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  filter,
  firstValueFrom,
  map,
  mergeMap,
  switchMap,
  takeUntil,
  tap,
} from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { DeviceType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { UriMatchStrategy } from "@bitwarden/common/models/domain/domain-service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  Fido2AuthenticatorGetAssertionParams,
  Fido2AuthenticatorGetAssertionResult,
  Fido2AuthenticatorMakeCredentialResult,
  Fido2AuthenticatorMakeCredentialsParams,
  Fido2AuthenticatorService as Fido2AuthenticatorServiceAbstraction,
} from "@bitwarden/common/platform/abstractions/fido2/fido2-authenticator.service.abstraction";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { getCredentialsForAutofill } from "@bitwarden/common/platform/services/fido2/fido2-autofill-utils";
import { Fido2Utils } from "@bitwarden/common/platform/services/fido2/fido2-utils";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { autofill, passkey_authenticator } from "@bitwarden/desktop-napi";
type OtpAutofillRequest = autofill.OtpAutofillRequest;
type OtpAutofillResponse = autofill.OtpAutofillResponse;
type PasskeyAssertionRequest = autofill.PasskeyAssertionRequest;
type PasskeyAssertionResponse = autofill.PasskeyAssertionResponse;
type PasskeyRegistrationResponse = autofill.PasskeyRegistrationResponse;
type PasskeyRegistrationRequest = autofill.PasskeyRegistrationRequest;
type PasskeyAssertionWithoutUserInterfaceRequest =
  autofill.PasskeyAssertionWithoutUserInterfaceRequest;
type PasswordAutofillRequest = autofill.PasswordAutofillRequest;
type PasswordAutofillResponse = autofill.PasswordAutofillResponse;
type NativeStatus = autofill.NativeStatus;
export type PasskeyProviderState = passkey_authenticator.PasskeyProviderState;

import {
  AutofillOpenSettingsCommand,
  AutofillRequestEnableCommand,
} from "../models/autofill-settings.command";
import { AutofillStatusCommand } from "../models/autofill-status.command";
import {
  AutofillFido2Credential,
  AutofillOtpCredential,
  AutofillPasswordCredential,
  AutofillSyncCommand,
} from "../models/autofill-sync.command";
import { IpcListenerBindFn } from "../models/ipc-handler.type";

import { AutofillWindowObject, DesktopAutofillUiService } from "./desktop-autofill-ui.service";
import type { NativeWindowObject } from "./desktop-fido2-user-interface.service";

/** Any native request carrying the window and context every ceremony needs. */
type AutofillRequest = {
  clientWindow: autofill.WindowDetails;
  context: string;
};

/**
 * What a plain (non-passkey) fill needs from a cipher, and where its picker
 * lives. Password and one-time-code fills differ only in these two things.
 */
type FillKind = {
  /** Route of the picker shown when the user browses their credentials. */
  route: string;
  /** Whether this cipher holds the kind of secret being asked for. */
  fillable: (cipher: CipherView) => boolean;
};

/**
 * A login is usable for autofill at all when it isn't deleted and carries a
 * username plus at least one URI the OS could have matched on. Both fill kinds
 * start here and then look for their own secret.
 *
 * This is the single definition shared by {@link DesktopAutofillService.sync},
 * which tells the OS what exists, and the picker, which lists what the user can
 * choose — so the two can't disagree about what is fillable.
 */
function isFillableLogin(cipher: CipherView): boolean {
  return (
    !cipher.isDeleted &&
    cipher.type === CipherType.Login &&
    cipher.login.uris?.length > 0 &&
    cipher.login.uris.some(
      (uri) => uri.match !== UriMatchStrategy.Never && !Utils.isNullOrWhitespace(uri.uri),
    ) &&
    !Utils.isNullOrWhitespace(cipher.login.username)
  );
}

const PasswordFill: FillKind = {
  route: "/password-autofill",
  fillable: (cipher) => isFillableLogin(cipher) && !Utils.isNullOrWhitespace(cipher.login.password),
};

const OtpFill: FillKind = {
  route: "/otp-autofill",
  fillable: (cipher) => isFillableLogin(cipher) && cipher.login.hasTotp,
};

/**
 * macOS reports a service either as a bare domain or as a URL. Cipher URI
 * matching expects something URL-shaped, so give a bare domain a scheme.
 */
function toUrl(serviceIdentifier: string): string {
  return serviceIdentifier.includes("://") ? serviceIdentifier : `https://${serviceIdentifier}`;
}

/**
 * The URI registered with the OS for a cipher {@link isFillableLogin} accepted.
 *
 * TODO: The OS is only told about the first matchable URI, so a login with
 * several only autofills on one of its sites.
 */
function registrableUri(cipher: CipherView): string {
  return cipher.login.uris.find(
    (uri) => uri.match !== UriMatchStrategy.Never && !Utils.isNullOrWhitespace(uri.uri),
  )!.uri as string;
}

type NativeCredentialSyncFeatureFlag =
  typeof FeatureFlag.MacOsNativeCredentialSync | typeof FeatureFlag.WindowsNativeCredentialSync;

@Injectable()
export class DesktopAutofillService implements OnDestroy {
  private destroy$ = new Subject<void>();
  private featureFlag?: NativeCredentialSyncFeatureFlag;
  private isEnabled: boolean = false;
  /** Whether syncing and IPC listeners have been started. */
  private started = false;
  private readonly inFlightRequests: Record<string, AbortController> = {};

  constructor(
    private logService: LogService,
    private cipherService: CipherService,
    private configService: ConfigService,
    private fido2AuthenticatorService: Fido2AuthenticatorServiceAbstraction<NativeWindowObject>,
    private accountService: AccountService,
    private authService: AuthService,
    private totpService: TotpService,
    private autofillUiService: DesktopAutofillUiService,
    platformUtilsService: PlatformUtilsService,
  ) {
    const deviceType = platformUtilsService.getDevice();
    if (deviceType === DeviceType.MacOsDesktop) {
      this.featureFlag = FeatureFlag.MacOsNativeCredentialSync;
    } else if (deviceType === DeviceType.WindowsDesktop) {
      this.featureFlag = FeatureFlag.WindowsNativeCredentialSync;
    }
  }

  async init() {
    if (!this.featureFlag) {
      return;
    }

    // Enable as soon as the flag turns on, so a flag value that arrives after startup takes
    // effect without restarting the app.
    this.configService
      .getFeatureFlag$(this.featureFlag)
      .pipe(
        distinctUntilChanged(),
        filter((enabled) => enabled === true),
        mergeMap(() => this.ensureEnabled()),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  /**
   * Signals the main process to register the native OS credential provider and start the autofill
   * IPC server, then starts syncing and listening for requests. Safe to call repeatedly: each call
   * re-submits the registration, but syncing and listeners are only started once.
   *
   * @returns whether native autofill is running.
   */
  private async ensureEnabled(): Promise<boolean> {
    if (!this.featureFlag) {
      return false;
    }
    this.isEnabled = (await this.configService.getFeatureFlag(this.featureFlag)) === true;
    if (!this.isEnabled) {
      return false;
    }

    // Gated here because the main process cannot evaluate the feature flag itself.
    const running = await ipc.autofill.desktopAutofill.setEnabled(true);
    if (!running) {
      this.logService.error(
        "[DesktopAutofillService]",
        "Main process failed to enable native autofill",
      );
      return false;
    }

    if (!this.started) {
      this.started = true;
      this.startSync(this.featureFlag);
      this.listenIpc();
    }
    return true;
  }

  /**
   * Re-submits the passkey provider registration with the OS, enabling native autofill if needed.
   *
   * @returns the app's status as a passkey provider with the OS.
   */
  async refreshPasskeyProviderState(): Promise<PasskeyProviderState> {
    if (!(await this.ensureEnabled())) {
      return { registered: false, enabled: false };
    }
    return this.getPasskeyProviderState();
  }

  /** Gets the app's status as a passkey provider with the OS, without re-submitting registration. */
  getPasskeyProviderState(): Promise<PasskeyProviderState> {
    return ipc.autofill.desktopAutofill.getPasskeyProviderState();
  }

  /**
   * Asks the user to turn on the app as a credential provider.
   *
   * @returns whether the app is enabled, or `undefined` if the OS cannot prompt.
   */
  async requestEnableCredentialProvider(): Promise<boolean | undefined> {
    const result = await ipc.autofill.desktopAutofill.runCommand<AutofillRequestEnableCommand>({
      namespace: "autofill",
      command: "requestEnable",
      params: {},
    });
    if (result.type === "error") {
      throw new Error(result.error);
    }
    return result.value.supported ? result.value.enabled : undefined;
  }

  /** Opens the OS settings for credential providers. */
  async openCredentialProviderSettings(): Promise<void> {
    const result = await ipc.autofill.desktopAutofill.runCommand<AutofillOpenSettingsCommand>({
      namespace: "autofill",
      command: "openSettings",
      params: {},
    });
    if (result.type === "error") {
      throw new Error(result.error);
    }
  }

  private startSync(featureFlag: NativeCredentialSyncFeatureFlag) {
    this.configService
      .getFeatureFlag$(featureFlag)
      .pipe(
        distinctUntilChanged(),
        tap((enabled) => (this.isEnabled = enabled === true)),
        filter((enabled) => enabled === true), // Only proceed if feature is enabled
        switchMap(() => {
          return combineLatest([
            this.accountService.activeAccount$.pipe(
              map((account) => account?.id),
              filter((userId): userId is UserId => userId != null),
            ),
            this.authService.activeAccountStatus$,
          ]).pipe(
            // Only proceed when the vault is unlocked
            filter(([, status]) => status === AuthenticationStatus.Unlocked),
            // Then get cipher views
            switchMap(([userId]) => this.cipherService.cipherViews$(userId)),
          );
        }),
        // No filter for empty arrays here - we want to sync even if there are 0 items
        filter((cipherViewMap) => cipherViewMap !== null),
        debounceTime(100),

        mergeMap((cipherViewMap) => this.sync(Object.values(cipherViewMap ?? []))),
        takeUntil(this.destroy$),
      )
      .subscribe();

    // Listen for sign out to clear credentials
    this.authService.activeAccountStatus$
      .pipe(
        filter((status) => status === AuthenticationStatus.LoggedOut),
        mergeMap(() => this.sync([])), // sync an empty array
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  async adHocSync(): Promise<any> {
    this.logService.debug("Performing AdHoc sync");
    const account = await firstValueFrom(this.accountService.activeAccount$);
    const userId = account?.id;

    if (!userId) {
      throw new Error("No active user found");
    }

    const cipherViewMap = await firstValueFrom(this.cipherService.cipherViews$(userId));
    this.logService.info(`Performing AdHoc sync over ${cipherViewMap?.length ?? 0} ciphers`);
    await this.sync(Object.values(cipherViewMap ?? []));
  }

  /** Give metadata about all available credentials in the users vault */
  async sync(cipherViews: CipherView[]) {
    const status = await this.status();
    if (status.type === "error") {
      return this.logService.error("Error getting autofill status", status.error);
    }

    if (!status.value.state.enabled) {
      // Autofill is disabled
      return;
    }

    let fido2Credentials: AutofillFido2Credential[] = [];
    let passwordCredentials: AutofillPasswordCredential[] = [];
    let otpCredentials: AutofillOtpCredential[] = [];

    if (status.value.support.password) {
      passwordCredentials = cipherViews.filter(PasswordFill.fillable).map((cipher) => ({
        type: "password",
        cipherId: cipher.id,
        uri: registrableUri(cipher),
        username: cipher.login.username as string,
      }));
    }

    if (status.value.support.fido2) {
      fido2Credentials = (await getCredentialsForAutofill(cipherViews)).map((credential) => ({
        type: "fido2",
        ...credential,
      }));
    }

    if (status.value.support.otp) {
      otpCredentials = cipherViews.filter(OtpFill.fillable).map((cipher) => ({
        type: "otp",
        cipherId: cipher.id,
        uri: registrableUri(cipher),
        username: cipher.login.username as string,
      }));
    }

    this.logService.info("Syncing autofill credentials", {
      fido2Credentials: fido2Credentials.length,
      passwordCredentials: passwordCredentials.length,
      otpCredentials: otpCredentials.length,
    });

    const syncResult = await ipc.autofill.desktopAutofill.runCommand<AutofillSyncCommand>({
      namespace: "autofill",
      command: "sync",
      params: {
        credentials: [...fido2Credentials, ...passwordCredentials, ...otpCredentials],
      },
    });

    if (syncResult.type === "error") {
      return this.logService.error("Error syncing autofill credentials", syncResult.error);
    }

    this.logService.debug(`Synced ${syncResult.value.added} autofill credentials`);
  }

  /** Get autofill status from OS */
  private status() {
    // TODO: Investigate why this type needs to be explicitly set
    return ipc.autofill.desktopAutofill.runCommand<AutofillStatusCommand>({
      namespace: "autofill",
      command: "status",
      params: {},
    });
  }

  async doCancelRequest(context: string): Promise<void> {
    const controller = this.inFlightRequests[context];
    if (controller) {
      this.logService.debug("[DesktopAutofillService]", `Cancelling request ${context}`);
      controller.abort("Operation cancelled");
    } else {
      this.logService.debug(
        "[DesktopAutofillService]",
        `Ignoring cancellation of unknown request: ${context}`,
      );
    }
  }

  async doLockStatus(): Promise<autofill.LockStatusResponse> {
    const isUnlocked =
      (await firstValueFrom(this.authService.activeAccountStatus$)) ===
      AuthenticationStatus.Unlocked;
    return { isUnlocked };
  }

  async doOtpAutofill(
    request: OtpAutofillRequest,
    abortController: AbortController,
  ): Promise<OtpAutofillResponse> {
    const cipher = await this.resolveCipherToFill(request, abortController, OtpFill);

    const totpSecret = cipher.login?.totp;
    if (!cipher.login?.hasTotp || !totpSecret) {
      throw new Error("Cipher does not have TOTP code");
    }
    const { code } = await firstValueFrom(this.totpService.getCode$(totpSecret));
    return { code };
  }

  async doPasskeyRegistration(
    request: PasskeyRegistrationRequest,
    abortController: AbortController,
  ): Promise<PasskeyRegistrationResponse> {
    const response = await this.fido2AuthenticatorService.makeCredential(
      this.convertRegistrationRequest(request),
      await this.nativeWindowObject(request),
      abortController,
    );
    return this.convertRegistrationResponse(request, response);
  }

  async doPasskeyAssertion(
    request: PasskeyAssertionRequest,
    abortController: AbortController,
  ): Promise<PasskeyAssertionResponse> {
    const assumeUserPresence = false;

    const response = await this.fido2AuthenticatorService.getAssertion(
      this.convertAssertionRequest(request, assumeUserPresence),
      await this.nativeWindowObject(request),
      abortController,
    );

    return this.convertAssertionResponse(request, response);
  }

  async doPasskeyAssertionWithoutUserInterface(
    request: PasskeyAssertionWithoutUserInterfaceRequest,
    abortController: AbortController,
  ): Promise<PasskeyAssertionResponse> {
    const assumeUserPresence = true;

    const response = await this.fido2AuthenticatorService.getAssertion(
      this.convertAssertionRequest(request, assumeUserPresence),
      await this.nativeWindowObject(request),
      abortController,
    );

    return this.convertAssertionResponse(request, response);
  }

  async doPasswordAutofill(
    request: PasswordAutofillRequest,
    abortController: AbortController,
  ): Promise<PasswordAutofillResponse> {
    const cipher = await this.resolveCipherToFill(request, abortController, PasswordFill);

    const username = cipher.login?.username;
    const password = cipher.login?.password;
    if (!username || !password) {
      throw new Error("Cipher does not contain username and password");
    }
    return { username, password };
  }

  /**
   * Determines which cipher a plain fill should use.
   *
   * The OS either already picked an identity from its suggestion bar — in which
   * case no Bitwarden UI is needed — or the user asked to browse, and we show
   * the picker over the services the request named. Either way the vault is
   * unlocked first, and the chosen cipher's master-password reprompt (if any) is
   * enforced before its secret leaves this method.
   *
   * @throws when no usable cipher was produced, which cancels the native request.
   */
  private async resolveCipherToFill(
    request: PasswordAutofillRequest | OtpAutofillRequest,
    abortController: AbortController,
    fill: FillKind,
  ): Promise<CipherView> {
    // TODO: we need to pin to the user ID too instead of assuming the active account.
    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);
    if (!activeAccount) {
      throw new Error("No active account");
    }
    const userId = activeAccount.id;

    const session = this.autofillUiService.newSession(
      await this.autofillWindowObject(request),
      abortController,
    );

    try {
      // Unlocking is user verification, so anything the user picks afterwards
      // needs no further prompt beyond a master-password reprompt.
      await session.ensureUnlockedVault();

      const suggested = await this.suggestedCipher(request, userId);
      if (suggested) {
        return suggested;
      }

      const candidates = await this.fillCandidates(request.serviceIdentifiers, userId, fill);
      const chosen = await session.pickCipher(
        candidates.map((cipher) => cipher.id).filter((id): id is string => id != null),
        fill.route,
      );
      if (!chosen) {
        throw new Error("No credential was selected");
      }

      // `pickCipher` hands back the list view the picker rendered, which holds no
      // secrets; re-read the full cipher to get at them.
      return await this.requireCipherView(userId, chosen.id as CipherId);
    } finally {
      // `pickCipher` tears its own picker down, but the lock screen
      // `ensureUnlockedVault` may have shown belongs to no other owner — and a
      // suggestion fill returns without ever reaching the picker. Clearing here
      // is idempotent and inert when this ceremony showed nothing, so the app
      // can't be left stuck in modal mode either way.
      await session.hideUi();
      await session.close();
    }
  }

  /**
   * The cipher the OS already chose, when this request came from a suggestion.
   *
   * A reprompt-protected cipher is deliberately *not* returned: its prompt needs
   * a window on screen, so it falls through to the picker instead — the same
   * reasoning as the passkey flow's `tryWithoutUserInteraction`.
   */
  private async suggestedCipher(
    request: PasswordAutofillRequest | OtpAutofillRequest,
    userId: UserId,
  ): Promise<CipherView | undefined> {
    const cipherId = request.recordIdentifier as CipherId | undefined;
    if (!cipherId) {
      return undefined;
    }

    const cipher = await this.requireCipherView(userId, cipherId);
    return cipher.reprompt === CipherRepromptType.None ? cipher : undefined;
  }

  private async requireCipherView(userId: UserId, cipherId: CipherId): Promise<CipherView> {
    const cipher = await firstValueFrom(this.cipherService.cipherView$(userId, cipherId));
    if (!cipher) {
      throw new Error(`No cipher found with that cipher ID: ${cipherId}`);
    }
    return cipher;
  }

  /**
   * The ciphers the user could fill this request with: everything matching any
   * of the requested services that actually holds the kind of secret being asked
   * for. An empty service list means the OS wants every fillable credential.
   */
  private async fillCandidates(
    serviceIdentifiers: string[],
    userId: UserId,
    fill: FillKind,
  ): Promise<CipherView[]> {
    const matches =
      serviceIdentifiers.length === 0
        ? await this.cipherService.getAllDecrypted(userId)
        : (
            await Promise.all(
              serviceIdentifiers.map((identifier) =>
                this.cipherService.getAllDecryptedForUrl(toUrl(identifier), userId),
              ),
            )
          ).flat();

    // The same cipher can match more than one of the requested services.
    const byId = new Map(
      matches.filter((cipher) => fill.fillable(cipher)).map((cipher) => [cipher.id, cipher]),
    );
    return [...byId.values()];
  }

  /**
   * Collects everything a ceremony needs to know about the windows involved in a
   * request: where to position our own UI, and which native windows an OS prompt
   * can attach itself to.
   */
  private async autofillWindowObject(request: AutofillRequest): Promise<AutofillWindowObject> {
    return {
      windowXy: request.clientWindow.position,
      clientWindowHandle: request.clientWindow.handle
        ? new Uint8Array(request.clientWindow.handle)
        : null,
      appWindowHandle: await ipc.autofill.desktopAutofill.getAppWindowHandle(),
      requestContext: request.context,
    };
  }

  /**
   * Collects everything the FIDO2 user interface needs to know about the
   * windows involved in a request, adding the relying-party details a passkey
   * ceremony needs on top of {@link autofillWindowObject}.
   */
  private async nativeWindowObject(
    request:
      | PasskeyRegistrationRequest
      | PasskeyAssertionRequest
      | PasskeyAssertionWithoutUserInterfaceRequest,
  ): Promise<NativeWindowObject> {
    return {
      ...(await this.autofillWindowObject(request)),
      rpId: request.rpId,
      // Discoverable credential requests don't contain a userHandle.
      userHandle: "userHandle" in request ? request.userHandle : undefined,
    };
  }

  async doNativeStatus(status: NativeStatus): Promise<void> {
    this.logService.info("Received native status", status.key, status.value);
    if (status.key === "request-sync") {
      // perform ad-hoc sync
      await this.adHocSync();
    }
  }

  listenIpc() {
    const ipcDesktopAutofill = ipc.autofill.desktopAutofill;
    // These must be arrow functions to bind `this` properly.
    this.makeListener(ipcDesktopAutofill.listenCancelRequest, (ctx) => this.doCancelRequest(ctx));

    this.makeListener(
      ipcDesktopAutofill.listenPasskeyRegistration,
      (request, abortController) => this.doPasskeyRegistration(request, abortController),
      (request) => request.context,
    );

    this.makeListener(
      ipcDesktopAutofill.listenPasskeyAssertion,
      (request, abortController) => this.doPasskeyAssertion(request, abortController),
      (request) => request.context,
    );
    this.makeListener(
      ipcDesktopAutofill.listenPasskeyAssertionWithoutUserInterface,
      (request, abortController) =>
        this.doPasskeyAssertionWithoutUserInterface(request, abortController),
      (request) => request.context,
    );

    this.makeListener(
      ipcDesktopAutofill.listenPasswordAutofill,
      (request, abortController) => this.doPasswordAutofill(request, abortController),
      (request) => request.context,
    );

    this.makeListener(
      ipcDesktopAutofill.listenOtpAutofill,
      (request, abortController) => this.doOtpAutofill(request, abortController),
      (request) => request.context,
    );

    this.makeListener(ipcDesktopAutofill.listenNativeStatus, (request) =>
      this.doNativeStatus(request),
    );

    this.makeListener(ipcDesktopAutofill.listenLockStatus, () => this.doLockStatus());

    ipcDesktopAutofill.listenerReady();
  }

  /**
   * Binds a function to handle messages for an autofill IPC channel.
   *
   * @param channelBindFn - A function to register a function with the IPC
   * channel. Should be one of the `listen*` methods on {@link ipc.autofill.desktopAutofill}.
   *
   * @param handleFn - A function to handle the type of request.
   */
  makeListener<Request, Response>(
    channelBindFn: IpcListenerBindFn<Request, Response>,
    handleFn: (request: Request, abortController: AbortController) => Promise<Response>,
    deriveTransactionIdFn?: (request: Request) => string,
  ) {
    /** Name to use in logs.
     *
     * The simpler way of doing this, using `channelBindFn.name`, doesn't work
     * because of how the function is passed from Electron's renderer process.
     * So we look up the key by the reference to the function.
     */
    const handlerName =
      Object.keys(ipc.autofill.desktopAutofill).find(
        (key) => (ipc.autofill.desktopAutofill as Record<string, unknown>)[key] === channelBindFn,
      ) ?? "unknownHandler";

    const listener = async (
      clientId: number,
      sequenceNumber: number,
      request: Request,
      /** Callback to return the response back to Autofill main process. May be
       * empty for requests that do not expect a response. */
      completeCallback?: {
        (error: null, response: Response): void;
        (error: Error, response: null): void;
      },
    ) => {
      this.logService.debug("[DesktopAutofillService]", `${handlerName}: Received message`, {
        clientId,
        sequenceNumber,
      });
      if (!this.isEnabled) {
        this.logService.debug(
          "[DesktopAutofillService]",
          `${handlerName}: Native credential sync feature flag (${this.featureFlag}) is disabled`,
        );
        if (completeCallback) {
          completeCallback(new Error("Native credential sync feature flag is disabled"), null);
        }
        return;
      }

      // Setup correlation for cancellation requests
      let transactionId: string | undefined = undefined;
      const abortController: AbortController = new AbortController();

      try {
        if (deriveTransactionIdFn) {
          transactionId = deriveTransactionIdFn(request);
          if (transactionId) {
            this.inFlightRequests[transactionId] = abortController;
          }
        }

        const response = await handleFn(request, abortController);
        if (completeCallback) {
          completeCallback(null, response);
        }
      } catch (error) {
        this.logService.error(
          "[DesktopAutofillService]",
          `${handlerName}: Error occurred during processing`,
          { clientId, sequenceNumber },
          error,
        );
        if (completeCallback) {
          if (error instanceof Error) {
            completeCallback(error, null);
          } else if (typeof error === "string") {
            completeCallback(new Error(error), null);
          } else {
            completeCallback(new Error(JSON.stringify(error)), null);
          }
        }
      } finally {
        if (transactionId) {
          delete this.inFlightRequests[transactionId];
        }
      }
    };

    channelBindFn(listener);
  }

  private convertRegistrationRequest(
    request: autofill.PasskeyRegistrationRequest,
  ): Fido2AuthenticatorMakeCredentialsParams {
    return {
      hash: new Uint8Array(request.clientDataHash),
      rpEntity: {
        name: request.rpId,
        id: request.rpId,
      },
      userEntity: {
        id: new Uint8Array(request.userHandle),
        name: request.userName,
        displayName: undefined,
        icon: undefined,
      },
      credTypesAndPubKeyAlgs: request.supportedAlgorithms.map((alg) => ({
        alg,
        type: "public-key",
      })),
      excludeCredentialDescriptorList: request.excludedCredentials.map((credentialId) => ({
        id: new Uint8Array(credentialId),
        type: "public-key" as const,
      })),
      requireResidentKey: true,
      requireUserVerification:
        request.userVerification === "required" || request.userVerification === "preferred",
      fallbackSupported: false,
    };
  }

  private convertRegistrationResponse(
    request: autofill.PasskeyRegistrationRequest,
    response: Fido2AuthenticatorMakeCredentialResult,
  ): autofill.PasskeyRegistrationResponse {
    return {
      rpId: request.rpId,
      clientDataHash: request.clientDataHash,
      credentialId: Array.from(Fido2Utils.bufferSourceToUint8Array(response.credentialId)),
      attestationObject: Array.from(
        Fido2Utils.bufferSourceToUint8Array(response.attestationObject),
      ),
    };
  }

  /**
   *
   * @param request
   * @param assumeUserPresence For WithoutUserInterface requests, we assume the user is present
   * @returns
   */
  private convertAssertionRequest(
    request: PasskeyAssertionRequest | PasskeyAssertionWithoutUserInterfaceRequest,
    assumeUserPresence: boolean = false,
  ): Fido2AuthenticatorGetAssertionParams {
    let allowedCredentials;
    if ("credentialId" in request) {
      allowedCredentials = [
        {
          id: new Uint8Array(request.credentialId),
          type: "public-key" as const,
        },
      ];
    } else {
      allowedCredentials = request.allowedCredentials.map((credentialId) => ({
        id: new Uint8Array(credentialId),
        type: "public-key" as const,
      }));
    }

    return {
      rpId: request.rpId,
      hash: new Uint8Array(request.clientDataHash),
      allowCredentialDescriptorList: allowedCredentials,
      extensions: {},
      requireUserVerification:
        request.userVerification === "required" || request.userVerification === "preferred",
      fallbackSupported: false,
      assumeUserPresence,
    };
  }

  private convertAssertionResponse(
    request: PasskeyAssertionRequest | PasskeyAssertionWithoutUserInterfaceRequest,
    response: Fido2AuthenticatorGetAssertionResult,
  ): autofill.PasskeyAssertionResponse {
    // TODO(PM-40112): Model this as an optional field. macOS requires a user handle to be
    // passed, since they expect all credentials to be discoverable credentials,
    // but the Windows provider accepts non-discoverable credentials. The
    // non-null requirement should be pushed into macOS's implementation.
    const userHandle = response.selectedCredential.userHandle
      ? Array.from(new Uint8Array(response.selectedCredential.userHandle))
      : [];
    return {
      userHandle,
      rpId: request.rpId,
      signature: Array.from(new Uint8Array(response.signature)),
      clientDataHash: request.clientDataHash,
      authenticatorData: Array.from(new Uint8Array(response.authenticatorData)),
      credentialId: Array.from(new Uint8Array(response.selectedCredential.id)),
    };
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
