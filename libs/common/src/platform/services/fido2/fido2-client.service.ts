// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, Subscription } from "rxjs";
import { parse } from "tldts";

import { AuthService } from "../../../auth/abstractions/auth.service";
import { AuthenticationStatus } from "../../../auth/enums/authentication-status";
import { DomainSettingsService } from "../../../autofill/services/domain-settings.service";
import { VaultSettingsService } from "../../../vault/abstractions/vault-settings/vault-settings.service";
import { ConfigService } from "../../abstractions/config/config.service";
import {
  Fido2ActiveRequestEvents,
  Fido2ActiveRequestManager,
} from "../../abstractions/fido2/fido2-active-request-manager.abstraction";
import {
  Fido2AuthenticatorError,
  Fido2AuthenticatorErrorCode,
  Fido2AuthenticatorGetAssertionParams,
  Fido2AuthenticatorGetAssertionResult,
  Fido2AuthenticatorMakeCredentialsParams,
  Fido2AuthenticatorService,
  PublicKeyCredentialDescriptor,
} from "../../abstractions/fido2/fido2-authenticator.service.abstraction";
import {
  AssertCredentialParams,
  AssertCredentialResult,
  CreateCredentialParams,
  CreateCredentialResult,
  FallbackRequestedError,
  Fido2ClientService as Fido2ClientServiceAbstraction,
  PublicKeyCredentialParam,
  UserRequestedFallbackAbortReason,
  UserVerification,
} from "../../abstractions/fido2/fido2-client.service.abstraction";
import { LogService } from "../../abstractions/log.service";
import { Utils } from "../../misc/utils";
import { ScheduledTaskNames } from "../../scheduling/scheduled-task-name.enum";
import { TaskSchedulerService } from "../../scheduling/task-scheduler.service";

import { isValidRpId } from "./domain-utils";
import { Fido2Utils } from "./fido2-utils";
import { guidToRawFormat } from "./guid-utils";

/**
 * Bitwarden implementation of the Web Authentication API as described by W3C
 * https://www.w3.org/TR/webauthn-3/#sctn-api
 *
 * It is highly recommended that the W3C specification is used a reference when reading this code.
 */
export class Fido2ClientService<ParentWindowReference>
  implements Fido2ClientServiceAbstraction<ParentWindowReference>
{
  private timeoutAbortController: AbortController;
  private readonly TIMEOUTS = {
    NO_VERIFICATION: {
      DEFAULT: 120000,
      MIN: 30000,
      MAX: 180000,
    },
    WITH_VERIFICATION: {
      DEFAULT: 300000,
      MIN: 30000,
      MAX: 600000,
    },
  };

  constructor(
    private authenticator: Fido2AuthenticatorService<ParentWindowReference>,
    private configService: ConfigService,
    private authService: AuthService,
    private vaultSettingsService: VaultSettingsService,
    private domainSettingsService: DomainSettingsService,
    private taskSchedulerService: TaskSchedulerService,
    private requestManager: Fido2ActiveRequestManager,
    private logService?: LogService,
  ) {
    this.taskSchedulerService.registerTaskHandler(ScheduledTaskNames.fido2ClientAbortTimeout, () =>
      this.timeoutAbortController?.abort(),
    );
  }

  async isFido2FeatureEnabled(hostname: string, origin: string): Promise<boolean> {
    const isUserLoggedIn =
      (await this.authService.getAuthStatus()) !== AuthenticationStatus.LoggedOut;
    if (!isUserLoggedIn) {
      return false;
    }

    const neverDomains = await firstValueFrom(this.domainSettingsService.neverDomains$);

    const isExcludedDomain = neverDomains != null && hostname in neverDomains;
    if (isExcludedDomain) {
      return false;
    }

    const serverConfig = await firstValueFrom(this.configService.serverConfig$);
    const isOriginEqualBitwardenVault = origin === serverConfig.environment?.vault;
    if (isOriginEqualBitwardenVault) {
      return false;
    }

    return await firstValueFrom(this.vaultSettingsService.enablePasskeys$);
  }

  async createCredential(
    params: CreateCredentialParams,
    window: ParentWindowReference,
    abortController = new AbortController(),
  ): Promise<CreateCredentialResult> {
    const parsedOrigin = parse(params.origin, { allowPrivateDomains: true });

    const enableFido2VaultCredentials = await this.isFido2FeatureEnabled(
      parsedOrigin.hostname,
      params.origin,
    );

    if (!enableFido2VaultCredentials) {
      this.logService?.warning(`[Fido2Client] Fido2VaultCredential is not enabled`);
      throw new FallbackRequestedError();
    }

    if (!params.sameOriginWithAncestors) {
      this.logService?.warning(
        `[Fido2Client] Invalid 'sameOriginWithAncestors' value: ${params.sameOriginWithAncestors}`,
      );
      throw new DOMException("Invalid 'sameOriginWithAncestors' value", "NotAllowedError");
    }

    const userId = Fido2Utils.stringToBuffer(params.user.id);
    if (userId.length < 1 || userId.length > 64) {
      this.logService?.warning(
        `[Fido2Client] Invalid 'user.id' length: ${params.user.id} (${userId.length})`,
      );
      throw new TypeError("Invalid 'user.id' length");
    }

    params.rp.id = params.rp.id ?? parsedOrigin.hostname;
    if (
      parsedOrigin.hostname == undefined ||
      (!params.origin.startsWith("https://") && parsedOrigin.hostname !== "localhost")
    ) {
      this.logService?.warning(`[Fido2Client] Invalid https origin: ${params.origin}`);
      throw new DOMException("'origin' is not a valid https origin", "SecurityError");
    }

    if (!isValidRpId(params.rp.id, params.origin)) {
      this.logService?.warning(
        `[Fido2Client] 'rp.id' cannot be used with the current origin: rp.id = ${params.rp.id}; origin = ${params.origin}`,
      );
      throw new DOMException("'rp.id' cannot be used with the current origin", "SecurityError");
    }

    let credTypesAndPubKeyAlgs: PublicKeyCredentialParam[];
    if (params.pubKeyCredParams?.length > 0) {
      // Filter out all unsupported algorithms
      credTypesAndPubKeyAlgs = params.pubKeyCredParams.filter(
        (kp) => kp.alg === -7 && kp.type === "public-key",
      );
    } else {
      // Assign default algorithms
      credTypesAndPubKeyAlgs = [
        { alg: -7, type: "public-key" },
        { alg: -257, type: "public-key" },
      ];
    }

    if (credTypesAndPubKeyAlgs.length === 0) {
      const requestedAlgorithms = credTypesAndPubKeyAlgs.map((p) => p.alg).join(", ");
      this.logService?.warning(
        `[Fido2Client] No compatible algorithms found, RP requested: ${requestedAlgorithms}`,
      );
      throw new DOMException("No supported key algorithms were found", "NotSupportedError");
    }

    const collectedClientData = {
      type: "webauthn.create",
      challenge: params.challenge,
      origin: params.origin,
      crossOrigin: !params.sameOriginWithAncestors,
      // tokenBinding: {} // Not currently supported
    };
    const clientDataJSON = JSON.stringify(collectedClientData);
    const clientDataJSONBytes = Utils.fromByteStringToArray(clientDataJSON);
    const clientDataHash = await crypto.subtle.digest({ name: "SHA-256" }, clientDataJSONBytes);
    const makeCredentialParams = mapToMakeCredentialParams({
      params,
      credTypesAndPubKeyAlgs,
      clientDataHash,
    });

    // Set timeout before invoking authenticator
    if (abortController.signal.aborted) {
      this.logService?.info(`[Fido2Client] Aborted with AbortController`);
      throw new DOMException("The operation either timed out or was not allowed.", "AbortError");
    }
    const timeoutSubscription = this.setAbortTimeout(
      abortController,
      params.authenticatorSelection?.userVerification,
      params.timeout,
    );

    let makeCredentialResult;
    try {
      makeCredentialResult = await this.authenticator.makeCredential(
        makeCredentialParams,
        window,
        abortController,
      );
    } catch (error) {
      if (
        abortController.signal.aborted &&
        abortController.signal.reason === UserRequestedFallbackAbortReason
      ) {
        this.logService?.info(`[Fido2Client] Aborting because user requested fallback`);
        throw new FallbackRequestedError();
      }

      if (
        error instanceof Fido2AuthenticatorError &&
        error.errorCode === Fido2AuthenticatorErrorCode.InvalidState
      ) {
        this.logService?.warning(`[Fido2Client] Unknown error: ${error}`);
        throw new DOMException("Unknown error occured.", "InvalidStateError");
      }

      this.logService?.info(`[Fido2Client] Aborted by user: ${error}`);
      throw new DOMException(
        "The operation either timed out or was not allowed.",
        "NotAllowedError",
      );
    }

    if (abortController.signal.aborted) {
      this.logService?.info(`[Fido2Client] Aborted with AbortController`);
      throw new DOMException("The operation either timed out or was not allowed.", "AbortError");
    }

    let credProps;
    if (params.extensions?.credProps) {
      credProps = {
        rk: makeCredentialParams.requireResidentKey,
      };
    }

    timeoutSubscription?.unsubscribe();

    return {
      credentialId: Fido2Utils.bufferToString(makeCredentialResult.credentialId),
      attestationObject: Fido2Utils.bufferToString(makeCredentialResult.attestationObject),
      authData: Fido2Utils.bufferToString(makeCredentialResult.authData),
      clientDataJSON: Fido2Utils.bufferToString(clientDataJSONBytes),
      publicKey: Fido2Utils.bufferToString(makeCredentialResult.publicKey),
      publicKeyAlgorithm: makeCredentialResult.publicKeyAlgorithm,
      transports: params.rp.id === "google.com" ? ["internal", "usb"] : ["internal"],
      extensions: { credProps },
    };
  }

  async assertCredential(
    params: AssertCredentialParams,
    window: ParentWindowReference,
    abortController = new AbortController(),
  ): Promise<AssertCredentialResult> {
    const parsedOrigin = parse(params.origin, { allowPrivateDomains: true });
    const enableFido2VaultCredentials = await this.isFido2FeatureEnabled(
      parsedOrigin.hostname,
      params.origin,
    );

    if (!enableFido2VaultCredentials) {
      this.logService?.warning(`[Fido2Client] Fido2VaultCredential is not enabled`);
      throw new FallbackRequestedError();
    }

    params.rpId = params.rpId ?? parsedOrigin.hostname;

    if (
      parsedOrigin.hostname == undefined ||
      (!params.origin.startsWith("https://") && parsedOrigin.hostname !== "localhost")
    ) {
      this.logService?.warning(`[Fido2Client] Invalid https origin: ${params.origin}`);
      throw new DOMException("'origin' is not a valid https origin", "SecurityError");
    }

    if (!isValidRpId(params.rpId, params.origin)) {
      this.logService?.warning(
        `[Fido2Client] 'rp.id' cannot be used with the current origin: rp.id = ${params.rpId}; origin = ${params.origin}`,
      );
      throw new DOMException("'rp.id' cannot be used with the current origin", "SecurityError");
    }

    const collectedClientData = {
      type: "webauthn.get",
      challenge: params.challenge,
      origin: params.origin,
      crossOrigin: !params.sameOriginWithAncestors,
      // tokenBinding: {} // Not currently supported
    };
    const clientDataJSON = JSON.stringify(collectedClientData);
    const clientDataJSONBytes = Utils.fromByteStringToArray(clientDataJSON);

    if (params.mediation === "conditional") {
      return this.handleMediatedConditionalRequest(
        params,
        window,
        abortController,
        clientDataJSONBytes,
      );
    }

    const clientDataHash = await crypto.subtle.digest({ name: "SHA-256" }, clientDataJSONBytes);
    const getAssertionParams = mapToGetAssertionParams({ params, clientDataHash });

    if (abortController.signal.aborted) {
      this.logService?.info(`[Fido2Client] Aborted with AbortController`);
      throw new DOMException("The operation either timed out or was not allowed.", "AbortError");
    }

    const timeoutSubscription = this.setAbortTimeout(
      abortController,
      params.userVerification,
      params.timeout,
    );

    let getAssertionResult;
    try {
      getAssertionResult = await this.authenticator.getAssertion(
        getAssertionParams,
        window,
        abortController,
      );
    } catch (error) {
      if (
        abortController.signal.aborted &&
        abortController.signal.reason === UserRequestedFallbackAbortReason
      ) {
        this.logService?.info(`[Fido2Client] Aborting because user requested fallback`);
        throw new FallbackRequestedError();
      }

      if (
        error instanceof Fido2AuthenticatorError &&
        error.errorCode === Fido2AuthenticatorErrorCode.InvalidState
      ) {
        this.logService?.warning(`[Fido2Client] Unknown error: ${error}`);
        throw new DOMException("Unknown error occured.", "InvalidStateError");
      }

      this.logService?.info(`[Fido2Client] Aborted by user: ${error}`);
      throw new DOMException(
        "The operation either timed out or was not allowed.",
        "NotAllowedError",
      );
    }

    if (abortController.signal.aborted) {
      this.logService?.info(`[Fido2Client] Aborted with AbortController`);
      throw new DOMException("The operation either timed out or was not allowed.", "AbortError");
    }

    timeoutSubscription?.unsubscribe();

    return this.generateAssertCredentialResult(getAssertionResult, clientDataJSONBytes);
  }

  private async handleMediatedConditionalRequest(
    params: AssertCredentialParams,
    tab: ParentWindowReference,
    abortController: AbortController,
    clientDataJSONBytes: Uint8Array,
  ): Promise<AssertCredentialResult> {
    let getAssertionResult;
    let assumeUserPresence = false;
    while (!getAssertionResult) {
      const authStatus = await firstValueFrom(this.authService.activeAccountStatus$);
      const availableCredentials =
        authStatus === AuthenticationStatus.Unlocked
          ? await this.authenticator.silentCredentialDiscovery(params.rpId)
          : [];
      this.logService?.info(
        `[Fido2Client] started mediated request, available credentials: ${availableCredentials.length}`,
      );
      const requestResult = await this.requestManager.newActiveRequest(
        // TODO: This isn't correct, but this.requestManager.newActiveRequest expects a number,
        // while this class is currently generic over ParentWindowReference.
        // Consider moving requestManager into browser and adding support for ParentWindowReference => tab.id
        (tab as any).id,
        availableCredentials,
        abortController,
      );

      if (requestResult.type === Fido2ActiveRequestEvents.Refresh) {
        continue;
      }

      if (requestResult.type === Fido2ActiveRequestEvents.Abort) {
        break;
      }

      params.allowedCredentialIds = [
        Fido2Utils.bufferToString(guidToRawFormat(requestResult.credentialId)),
      ];
      assumeUserPresence = true;

      const clientDataHash = await crypto.subtle.digest({ name: "SHA-256" }, clientDataJSONBytes);
      const getAssertionParams = mapToGetAssertionParams({
        params,
        clientDataHash,
        assumeUserPresence,
      });

      try {
        getAssertionResult = await this.authenticator.getAssertion(getAssertionParams, tab);
      } catch (e) {
        this.logService?.info(`[Fido2Client] Aborted by user: ${e}`);
      }

      if (abortController.signal.aborted) {
        this.logService?.info(`[Fido2Client] Aborted with AbortController`);
      }
    }

    return this.generateAssertCredentialResult(getAssertionResult, clientDataJSONBytes);
  }

  private generateAssertCredentialResult(
    getAssertionResult: Fido2AuthenticatorGetAssertionResult,
    clientDataJSONBytes: Uint8Array,
  ): AssertCredentialResult {
    return {
      authenticatorData: Fido2Utils.bufferToString(getAssertionResult.authenticatorData),
      clientDataJSON: Fido2Utils.bufferToString(clientDataJSONBytes),
      credentialId: Fido2Utils.bufferToString(getAssertionResult.selectedCredential.id),
      userHandle:
        getAssertionResult.selectedCredential.userHandle !== undefined
          ? Fido2Utils.bufferToString(getAssertionResult.selectedCredential.userHandle)
          : undefined,
      signature: Fido2Utils.bufferToString(getAssertionResult.signature),
    };
  }

  private setAbortTimeout = (
    abortController: AbortController,
    userVerification?: UserVerification,
    timeout?: number,
  ): Subscription => {
    let clampedTimeout: number;

    const { WITH_VERIFICATION, NO_VERIFICATION } = this.TIMEOUTS;
    if (userVerification === "required") {
      timeout = timeout ?? WITH_VERIFICATION.DEFAULT;
      clampedTimeout = Math.max(WITH_VERIFICATION.MIN, Math.min(timeout, WITH_VERIFICATION.MAX));
    } else {
      timeout = timeout ?? NO_VERIFICATION.DEFAULT;
      clampedTimeout = Math.max(NO_VERIFICATION.MIN, Math.min(timeout, NO_VERIFICATION.MAX));
    }

    this.timeoutAbortController = abortController;
    return this.taskSchedulerService.setTimeout(
      ScheduledTaskNames.fido2ClientAbortTimeout,
      clampedTimeout,
    );
  };
}

/**
 * Convert data gathered by the WebAuthn Client to a format that can be used by the authenticator.
 */
function mapToMakeCredentialParams({
  params,
  credTypesAndPubKeyAlgs,
  clientDataHash,
}: {
  params: CreateCredentialParams;
  credTypesAndPubKeyAlgs: PublicKeyCredentialParam[];
  clientDataHash: ArrayBuffer;
}): Fido2AuthenticatorMakeCredentialsParams {
  const excludeCredentialDescriptorList: PublicKeyCredentialDescriptor[] =
    params.excludeCredentials?.map((credential) => ({
      id: Fido2Utils.stringToBuffer(credential.id),
      transports: credential.transports,
      type: credential.type,
    })) ?? [];

  const requireResidentKey =
    params.authenticatorSelection?.residentKey === "required" ||
    params.authenticatorSelection?.residentKey === "preferred" ||
    (params.authenticatorSelection?.residentKey === undefined &&
      params.authenticatorSelection?.requireResidentKey === true);

  const requireUserVerification =
    params.authenticatorSelection?.userVerification === "required" ||
    params.authenticatorSelection?.userVerification === "preferred" ||
    params.authenticatorSelection?.userVerification === undefined;

  return {
    requireResidentKey,
    requireUserVerification,
    enterpriseAttestationPossible: params.attestation === "enterprise",
    excludeCredentialDescriptorList,
    credTypesAndPubKeyAlgs,
    hash: clientDataHash,
    rpEntity: {
      id: params.rp.id,
      name: params.rp.name,
    },
    userEntity: {
      id: Fido2Utils.stringToBuffer(params.user.id),
      displayName: params.user.displayName,
      name: params.user.name,
    },
    fallbackSupported: params.fallbackSupported,
  };
}

/**
 * Convert data gathered by the WebAuthn Client to a format that can be used by the authenticator.
 */
function mapToGetAssertionParams({
  params,
  clientDataHash,
  assumeUserPresence,
}: {
  params: AssertCredentialParams;
  clientDataHash: ArrayBuffer;
  assumeUserPresence?: boolean;
}): Fido2AuthenticatorGetAssertionParams {
  const allowCredentialDescriptorList: PublicKeyCredentialDescriptor[] =
    params.allowedCredentialIds.map((id) => ({
      id: Fido2Utils.stringToBuffer(id),
      type: "public-key",
    }));

  const requireUserVerification =
    params.userVerification === "required" ||
    params.userVerification === "preferred" ||
    params.userVerification === undefined;

  return {
    rpId: params.rpId,
    requireUserVerification,
    hash: clientDataHash,
    allowCredentialDescriptorList,
    extensions: {},
    fallbackSupported: params.fallbackSupported,
    assumeUserPresence,
  };
}
