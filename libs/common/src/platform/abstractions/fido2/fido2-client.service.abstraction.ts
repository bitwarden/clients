// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
export const UserRequestedFallbackAbortReason = "UserRequestedFallback";

export type UserVerification = "discouraged" | "preferred" | "required";

/**
 * This class represents an abstraction of the WebAuthn Client as described by W3C:
 * https://www.w3.org/TR/webauthn-3/#webauthn-client
 *
 * The WebAuthn Client is an intermediary entity typically implemented in the user agent
 * (in whole, or in part). Conceptually, it underlies the Web Authentication API and embodies
 * the implementation of the Web Authentication API's operations.
 *
 * It is responsible for both marshalling the inputs for the underlying authenticator operations,
 * and for returning the results of the latter operations to the Web Authentication API's callers.
 */
export abstract class Fido2ClientService<ParentWindowReference> {
  isFido2FeatureEnabled: (hostname: string, origin: string) => Promise<boolean>;

  /**
   * Allows WebAuthn Relying Party scripts to request the creation of a new public key credential source.
   * For more information please see: https://www.w3.org/TR/webauthn-3/#sctn-createCredential
   *
   * @param params The parameters for the credential creation operation.
   * @param abortController An AbortController that can be used to abort the operation.
   * @returns A promise that resolves with the new credential.
   */
  createCredential: (
    params: CreateCredentialParams,
    window: ParentWindowReference,
    abortController?: AbortController,
  ) => Promise<CreateCredentialResult>;

  /**
   * Allows WebAuthn Relying Party scripts to discover and use an existing public key credential, with the user’s consent.
   * Relying Party script can optionally specify some criteria to indicate what credential sources are acceptable to it.
   * For more information please see: https://www.w3.org/TR/webauthn-3/#sctn-getAssertion
   *
   * @param params The parameters for the credential assertion operation.
   * @param abortController An AbortController that can be used to abort the operation.
   * @returns A promise that resolves with the asserted credential.
   */
  assertCredential: (
    params: AssertCredentialParams,
    window: ParentWindowReference,
    abortController?: AbortController,
  ) => Promise<AssertCredentialResult>;
}

/**
 * Parameters for creating a new credential.
 */
export interface CreateCredentialParams {
  /** The Relaying Parties origin, see: https://html.spec.whatwg.org/multipage/browsers.html#concept-origin */
  origin: string;
  /**
   * A value which is true if and only if the caller’s environment settings object is same-origin with its ancestors.
   * It is false if caller is cross-origin.
   * */
  sameOriginWithAncestors: boolean;
  /** The Relying Party's preference for attestation conveyance */
  attestation?: "direct" | "enterprise" | "indirect" | "none";
  /** The Relying Party's requirements of the authenticator used in the creation of the credential. */
  authenticatorSelection?: {
    // authenticatorAttachment?: AuthenticatorAttachment; // not used
    requireResidentKey?: boolean;
    residentKey?: "discouraged" | "preferred" | "required";
    userVerification?: UserVerification;
  };
  /** Challenge intended to be used for generating the newly created credential's attestation object. */
  challenge: string; // b64 encoded
  /**
   * This member is intended for use by Relying Parties that wish to limit the creation of multiple credentials for
   * the same account on a single authenticator. The client is requested to return an error if the new credential would
   * be created on an authenticator that also contains one of the credentials enumerated in this parameter.
   * */
  excludeCredentials?: {
    id: string; // b64 encoded
    transports?: ("ble" | "hybrid" | "internal" | "nfc" | "usb")[];
    type: "public-key";
  }[];
  /**
   * This member contains additional parameters requesting additional processing by the client and authenticator.
   **/
  extensions?: {
    appid?: string; // Not supported
    appidExclude?: string; // Not supported
    uvm?: boolean; // Not supported
    credProps?: boolean;
  };
  /**
   * This member contains information about the desired properties of the credential to be created.
   * The sequence is ordered from most preferred to least preferred.
   * The client makes a best-effort to create the most preferred credential that it can.
   */
  pubKeyCredParams: PublicKeyCredentialParam[];
  /** Data about the Relying Party responsible for the request. */
  rp: {
    id?: string;
    name: string;
  };
  /** Data about the user account for which the Relying Party is requesting attestation. */
  user: {
    id: string; // b64 encoded
    displayName: string;
    name: string;
  };
  /** Forwarded to user interface */
  fallbackSupported: boolean;
  /**
   * This member specifies a time, in milliseconds, that the caller is willing to wait for the call to complete.
   * This is treated as a hint, and MAY be overridden by the client.
   **/
  timeout?: number;
}

/**
 * The result of creating a new credential.
 */
export interface CreateCredentialResult {
  credentialId: string;
  clientDataJSON: string;
  attestationObject: string;
  authData: string;
  publicKey: string;
  publicKeyAlgorithm: number;
  transports: string[];
  extensions: {
    credProps?: {
      rk: boolean;
    };
  };
}

/**
 * Parameters for asserting a credential.
 */
export interface AssertCredentialParams {
  allowedCredentialIds: string[];
  rpId: string;
  origin: string;
  challenge: string;
  userVerification?: UserVerification;
  timeout: number;
  sameOriginWithAncestors: boolean;
  mediation?: "silent" | "optional" | "required" | "conditional";
  fallbackSupported: boolean;
}

/**
 * The result of asserting a credential.
 */
export interface AssertCredentialResult {
  credentialId: string;
  clientDataJSON: string;
  authenticatorData: string;
  signature: string;
  userHandle: string;
}

/**
 * A description of a key type and algorithm.
 *
 * @example {
 *   alg: -7, // ES256
 *   type: "public-key"
 * }
 */
export interface PublicKeyCredentialParam {
  alg: number;
  type: "public-key";
}

/**
 * Error thrown when the user requests a fallback to the browser's built-in WebAuthn implementation.
 */
export class FallbackRequestedError extends Error {
  readonly fallbackRequested = true;
  constructor() {
    super("FallbackRequested");
  }
}
