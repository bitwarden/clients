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
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { autofill } from "@bitwarden/desktop-napi";
type PasskeyAssertionRequest = autofill.PasskeyAssertionRequest;
type PasskeyAssertionResponse = autofill.PasskeyAssertionResponse;
type PasskeyRegistrationResponse = autofill.PasskeyRegistrationResponse;
type PasskeyRegistrationRequest = autofill.PasskeyRegistrationRequest;
type PasskeyAssertionWithoutUserInterfaceRequest =
  autofill.PasskeyAssertionWithoutUserInterfaceRequest;
type NativeStatus = autofill.NativeStatus;

import { AutofillStatusCommand } from "../models/autofill-status.command";
import {
  AutofillFido2Credential,
  AutofillPasswordCredential,
  AutofillSyncCommand,
} from "../models/autofill-sync.command";
import { IpcListenerBindFn } from "../models/ipc-handler.type";

import type { NativeWindowObject } from "./desktop-fido2-user-interface.service";

@Injectable()
export class DesktopAutofillService implements OnDestroy {
  private destroy$ = new Subject<void>();
  private registrationRequest?: PasskeyRegistrationRequest;
  private featureFlag?: typeof FeatureFlag.MacOsNativeCredentialSync;
  private isEnabled: boolean = false;
  private readonly inFlightRequests: Record<string, AbortController> = {};

  constructor(
    private logService: LogService,
    private cipherService: CipherService,
    private configService: ConfigService,
    private fido2AuthenticatorService: Fido2AuthenticatorServiceAbstraction<NativeWindowObject>,
    private accountService: AccountService,
    private authService: AuthService,
    platformUtilsService: PlatformUtilsService,
  ) {
    const deviceType = platformUtilsService.getDevice();
    if (deviceType === DeviceType.MacOsDesktop) {
      this.featureFlag = FeatureFlag.MacOsNativeCredentialSync;
    }
  }

  async init() {
    if (!this.featureFlag) {
      return;
    }
    this.isEnabled = (await this.configService.getFeatureFlag(this.featureFlag)) === true;
    if (!this.isEnabled) {
      return;
    }

    this.configService
      .getFeatureFlag$(this.featureFlag)
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

    this.listenIpc();
  }

  async adHocSync(): Promise<any> {
    this.logService.debug("Performing AdHoc sync");
    const account = await firstValueFrom(this.accountService.activeAccount$);
    const userId = account?.id;

    if (!userId) {
      throw new Error("No active user found");
    }

    const cipherViewMap = await firstValueFrom(this.cipherService.cipherViews$(userId));
    this.logService.info("Performing AdHoc sync", Object.values(cipherViewMap ?? []));
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

    if (status.value.support.password) {
      passwordCredentials = cipherViews
        .filter(
          (cipher) =>
            !cipher.isDeleted &&
            cipher.type === CipherType.Login &&
            cipher.login.uris?.length > 0 &&
            cipher.login.uris.some(
              (uri) => uri.match !== UriMatchStrategy.Never && !Utils.isNullOrWhitespace(uri.uri),
            ) &&
            !Utils.isNullOrWhitespace(cipher.login.username) &&
            !Utils.isNullOrWhitespace(cipher.login.password),
        )
        .map((cipher) => ({
          type: "password",
          cipherId: cipher.id,
          uri: cipher.login.uris.find(
            (uri) => uri.match !== UriMatchStrategy.Never && !Utils.isNullOrWhitespace(uri.uri),
          )!.uri as string,
          username: cipher.login.username as string,
        }));
    }

    if (status.value.support.fido2) {
      fido2Credentials = (await getCredentialsForAutofill(cipherViews)).map((credential) => ({
        type: "fido2",
        ...credential,
      }));
    }

    this.logService.info("Syncing autofill credentials", {
      fido2Credentials,
      passwordCredentials,
    });

    const syncResult = await ipc.autofill.desktopAutofill.runCommand<AutofillSyncCommand>({
      namespace: "autofill",
      command: "sync",
      params: {
        credentials: [...fido2Credentials, ...passwordCredentials],
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

  get lastRegistrationRequest() {
    return this.registrationRequest;
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

  async doPasskeyRegistration(
    request: PasskeyRegistrationRequest,
    abortController: AbortController,
  ): Promise<PasskeyRegistrationResponse> {
    this.registrationRequest = request;

    const response = await this.fido2AuthenticatorService.makeCredential(
      this.convertRegistrationRequest(request),
      { windowXy: request.clientWindow.position },
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
      { windowXy: request.clientWindow.position },
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
      { windowXy: request.clientWindow.position },
      abortController,
    );

    return this.convertAssertionResponse(request, response);
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
