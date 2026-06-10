import {
  AssertCredentialParams,
  CreateCredentialParams,
} from "@bitwarden/common/platform/abstractions/fido2/fido2-client.service.abstraction";
import { Fido2Utils } from "@bitwarden/common/platform/services/fido2/fido2-utils";

/**
 * W3C `PublicKeyCredentialCreationOptionsJSON` as delivered by
 * `chrome.webAuthenticationProxy.onCreateRequest`.
 *
 * @see https://w3c.github.io/webauthn/#dictdef-publickeycredentialcreationoptionsjson
 * @see https://developer.chrome.com/docs/extensions/reference/api/webAuthenticationProxy
 */
interface ProxyCreateRequestJson {
  rp: { id?: string; name: string };
  user: { id: string; name: string; displayName: string };
  challenge: string;
  pubKeyCredParams: { type: "public-key"; alg: number | string }[];
  timeout?: number;
  excludeCredentials?: {
    id: string;
    type: "public-key";
    transports?: ("ble" | "hybrid" | "internal" | "nfc" | "usb")[];
  }[];
  authenticatorSelection?: {
    authenticatorAttachment?: "platform" | "cross-platform";
    requireResidentKey?: boolean;
    residentKey?: "discouraged" | "preferred" | "required";
    userVerification?: "discouraged" | "preferred" | "required";
  };
  attestation?: "direct" | "enterprise" | "indirect" | "none";
  extensions?: {
    credProps?: boolean;
    appid?: string;
    appidExclude?: string;
    uvm?: boolean;
  };
}

/**
 * W3C `PublicKeyCredentialRequestOptionsJSON` as delivered by
 * `chrome.webAuthenticationProxy.onGetRequest`.
 */
interface ProxyGetRequestJson {
  challenge: string;
  timeout?: number;
  rpId?: string;
  allowCredentials?: {
    id: string;
    type: "public-key";
    transports?: ("ble" | "hybrid" | "internal" | "nfc" | "usb")[];
  }[];
  userVerification?: "discouraged" | "preferred" | "required";
  mediation?: "silent" | "optional" | "required" | "conditional";
  extensions?: Record<string, unknown>;
}

/**
 * Security context for a proxied WebAuthn request. Chrome does not include
 * the origin in the proxy event payload, so callers must derive it from the
 * focused active tab's URL and pass it in here.
 */
export interface ProxyRequestContext {
  origin: string;
  sameOriginWithAncestors: boolean;
}

/**
 * Conversions between the JSON envelopes used by `chrome.webAuthenticationProxy`
 * and Bitwarden's internal Fido2 client request/response shapes.
 *
 * The internal Fido2 types already use URL-safe base64 (no padding) for every
 * `BufferSource` field (challenge, user.id, credential ids, response buffers),
 * which matches the `Base64URLString` definition used by the W3C JSON shapes.
 * That means no per-field re-encoding is required - we only need to translate
 * the object structure.
 */
export class WebauthnJsonUtils {
  static parseCreateRequest(
    requestDetailsJson: string,
    context: ProxyRequestContext,
  ): CreateCredentialParams {
    const options = JSON.parse(requestDetailsJson) as ProxyCreateRequestJson;

    if (options == null || options.rp == null || options.user == null) {
      throw new Error("Malformed proxy create request");
    }

    return {
      origin: context.origin,
      sameOriginWithAncestors: context.sameOriginWithAncestors,
      attestation: options.attestation,
      authenticatorSelection: options.authenticatorSelection && {
        requireResidentKey: options.authenticatorSelection.requireResidentKey,
        residentKey: options.authenticatorSelection.residentKey,
        userVerification: options.authenticatorSelection.userVerification,
      },
      challenge: options.challenge,
      excludeCredentials: options.excludeCredentials?.map((c) => ({
        id: c.id,
        transports: c.transports,
        type: c.type,
      })),
      extensions: {
        credProps: options.extensions?.credProps,
      },
      pubKeyCredParams: options.pubKeyCredParams
        .map((p) => ({ alg: Number(p.alg), type: p.type }))
        .filter((p) => !isNaN(p.alg)),
      rp: { id: options.rp.id, name: options.rp.name },
      user: {
        id: options.user.id,
        displayName: options.user.displayName,
        name: options.user.name,
      },
      timeout: options.timeout,
      // The proxy can always fall back to Chrome's native UI when we surface
      // a NotAllowedError, so claim fallback support.
      fallbackSupported: true,
    };
  }

  static parseGetRequest(
    requestDetailsJson: string,
    context: ProxyRequestContext,
  ): AssertCredentialParams {
    const options = JSON.parse(requestDetailsJson) as ProxyGetRequestJson;

    if (options == null || options.challenge == null) {
      throw new Error("Malformed proxy get request");
    }

    return {
      origin: context.origin,
      sameOriginWithAncestors: context.sameOriginWithAncestors,
      allowedCredentialIds: options.allowCredentials?.map((c) => c.id) ?? [],
      challenge: options.challenge,
      rpId: options.rpId,
      userVerification: options.userVerification,
      timeout: options.timeout,
      mediation: options.mediation,
      fallbackSupported: true,
    };
  }

  static serializeCreateResponse(
    result: Parameters<typeof Fido2Utils.createResultToJson>[0],
  ): string {
    return JSON.stringify(Fido2Utils.createResultToJson(result));
  }

  static serializeGetResponse(result: Parameters<typeof Fido2Utils.getResultToJson>[0]): string {
    return JSON.stringify(Fido2Utils.getResultToJson(result));
  }

  /**
   * Maps an internal error into the `DOMExceptionDetails` shape Chrome will
   * replay to the relying party. Both `name` and `message` are required by
   * the API.
   */
  static toProxyError(error: unknown): { name: string; message: string } {
    if (error instanceof DOMException && error.name) {
      return { name: error.name, message: error.message ?? "" };
    }
    if (
      error != null &&
      typeof error === "object" &&
      "fallbackRequested" in error &&
      (error as { fallbackRequested?: boolean }).fallbackRequested === true
    ) {
      // Surface as NotAllowedError so Chrome shows its own picker.
      return { name: "NotAllowedError", message: "Fallback to browser requested" };
    }
    const message = error instanceof Error ? error.message : String(error ?? "");
    return { name: "UnknownError", message };
  }
}
