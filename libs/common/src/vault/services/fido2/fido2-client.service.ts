import { firstValueFrom } from "rxjs";
import { parse } from "tldts";

import { AuthService } from "../../../auth/abstractions/auth.service";
import { AuthenticationStatus } from "../../../auth/enums/authentication-status";
import { DomainSettingsService } from "../../../autofill/services/domain-settings.service";
import { ConfigService } from "../../../platform/abstractions/config/config.service";
import { LogService } from "../../../platform/abstractions/log.service";
import { Utils } from "../../../platform/misc/utils";
import {
  Fido2AuthenticatorError,
  Fido2AuthenticatorErrorCode,
  Fido2AuthenticatorGetAssertionParams,
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
import { VaultSettingsService } from "../../abstractions/vault-settings/vault-settings.service";

import { isValidRpId } from "./domain-utils";
import { Fido2Utils } from "./fido2-utils";

/**
 * Bitwarden implementation of the Web Authentication API as described by W3C
 * https://www.w3.org/TR/webauthn-3/#sctn-api
 *
 * It is highly recommended that the W3C specification is used a reference when reading this code.
 */
export class Fido2ClientService implements Fido2ClientServiceAbstraction {
  constructor(
    private authenticator: Fido2AuthenticatorService,
    private configService: ConfigService,
    private authService: AuthService,
    private vaultSettingsService: VaultSettingsService,
    private domainSettingsService: DomainSettingsService,
    private logService?: LogService,
  ) {}

  async isFido2FeatureEnabled(hostname: string, origin: string): Promise<boolean> {
    const userEnabledPasskeys = await firstValueFrom(this.vaultSettingsService.enablePasskeys$);
    const isUserLoggedIn =
      (await this.authService.getAuthStatus()) !== AuthenticationStatus.LoggedOut;

    const neverDomains = await firstValueFrom(this.domainSettingsService.neverDomains$);

    const isExcludedDomain = neverDomains != null && hostname in neverDomains;

    const serverConfig = await firstValueFrom(this.configService.serverConfig$);
    const isOriginEqualBitwardenVault = origin === serverConfig.environment?.vault;

    return (
      userEnabledPasskeys && isUserLoggedIn && !isExcludedDomain && !isOriginEqualBitwardenVault
    );
  }

  async createCredential(
    params: CreateCredentialParams,
    tab: chrome.tabs.Tab,
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
    if (parsedOrigin.hostname == undefined || !params.origin.startsWith("https://")) {
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
    const timeout = setAbortTimeout(
      abortController,
      params.authenticatorSelection?.userVerification,
      params.timeout,
    );

    let makeCredentialResult;
    try {
      makeCredentialResult = await this.authenticator.makeCredential(
        makeCredentialParams,
        tab,
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

    clearTimeout(timeout);
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
    tab: chrome.tabs.Tab,
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

    if (parsedOrigin.hostname == undefined || !params.origin.startsWith("https://")) {
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
    const clientDataHash = await crypto.subtle.digest({ name: "SHA-256" }, clientDataJSONBytes);
    const getAssertionParams = mapToGetAssertionParams({ params, clientDataHash });

    if (abortController.signal.aborted) {
      this.logService?.info(`[Fido2Client] Aborted with AbortController`);
      throw new DOMException("The operation either timed out or was not allowed.", "AbortError");
    }

    const timeout = setAbortTimeout(abortController, params.userVerification, params.timeout);

    let getAssertionResult;
    try {
      getAssertionResult = await this.authenticator.getAssertion(
        getAssertionParams,
        tab,
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
    clearTimeout(timeout);

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
}

const TIMEOUTS = {
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

function setAbortTimeout(
  abortController: AbortController,
  userVerification?: UserVerification,
  timeout?: number,
): number {
  let clampedTimeout: number;

  if (userVerification === "required") {
    timeout = timeout ?? TIMEOUTS.WITH_VERIFICATION.DEFAULT;
    clampedTimeout = Math.max(
      TIMEOUTS.WITH_VERIFICATION.MIN,
      Math.min(timeout, TIMEOUTS.WITH_VERIFICATION.MAX),
    );
  } else {
    timeout = timeout ?? TIMEOUTS.NO_VERIFICATION.DEFAULT;
    clampedTimeout = Math.max(
      TIMEOUTS.NO_VERIFICATION.MIN,
      Math.min(timeout, TIMEOUTS.NO_VERIFICATION.MAX),
    );
  }

  return window.setTimeout(() => abortController.abort(), clampedTimeout);
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
}: {
  params: AssertCredentialParams;
  clientDataHash: ArrayBuffer;
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
  };
}
