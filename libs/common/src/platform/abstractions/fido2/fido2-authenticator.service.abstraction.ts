// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Fido2CredentialView } from "../../../vault/models/view/fido2-credential.view";

/**
 * This class represents an abstraction of the WebAuthn Authenticator model as described by W3C:
 * https://www.w3.org/TR/webauthn-3/#sctn-authenticator-model
 *
 * The authenticator provides key management and cryptographic signatures.
 */
export abstract class Fido2AuthenticatorService<ParentWindowReference> {
  /**
   * Create and save a new credential as described in:
   * https://www.w3.org/TR/webauthn-3/#sctn-op-make-cred
   *
   * @param params Parameters for creating a new credential
   * @param abortController An AbortController that can be used to abort the operation.
   * @returns A promise that resolves with the new credential and an attestation signature.
   **/
  makeCredential: (
    params: Fido2AuthenticatorMakeCredentialsParams,
    window: ParentWindowReference,
    abortController?: AbortController,
  ) => Promise<Fido2AuthenticatorMakeCredentialResult>;

  /**
   * Generate an assertion using an existing credential as describe in:
   * https://www.w3.org/TR/webauthn-3/#sctn-op-get-assertion
   *
   * @param params Parameters for generating an assertion
   * @param abortController An AbortController that can be used to abort the operation.
   * @returns A promise that resolves with the asserted credential and an assertion signature.
   */
  getAssertion: (
    params: Fido2AuthenticatorGetAssertionParams,
    window: ParentWindowReference,
    abortController?: AbortController,
  ) => Promise<Fido2AuthenticatorGetAssertionResult>;

  /**
   * Discover credentials for a given Relying Party
   *
   * @param rpId The Relying Party's ID
   * @returns A promise that resolves with an array of discoverable credentials
   */
  silentCredentialDiscovery: (rpId: string) => Promise<Fido2CredentialView[]>;
}

export enum Fido2AlgorithmIdentifier {
  ES256 = -7,
  RS256 = -257,
}

export enum Fido2AuthenticatorErrorCode {
  Unknown = "UnknownError",
  NotSupported = "NotSupportedError",
  InvalidState = "InvalidStateError",
  NotAllowed = "NotAllowedError",
  Constraint = "ConstraintError",
}

export class Fido2AuthenticatorError extends Error {
  constructor(readonly errorCode: Fido2AuthenticatorErrorCode) {
    super(errorCode);
  }
}

export interface PublicKeyCredentialDescriptor {
  id: Uint8Array;
  transports?: ("ble" | "hybrid" | "internal" | "nfc" | "usb")[];
  type: "public-key";
}

/**
 * Parameters for {@link Fido2AuthenticatorService.makeCredential}
 *
 * This interface represents the input parameters described in
 * https://www.w3.org/TR/webauthn-3/#sctn-op-make-cred
 */
export interface Fido2AuthenticatorMakeCredentialsParams {
  /** The hash of the serialized client data, provided by the client. */
  hash: BufferSource;
  /** The Relying Party's PublicKeyCredentialRpEntity. */
  rpEntity: {
    name: string;
    id?: string;
  };
  /** The user account’s PublicKeyCredentialUserEntity, containing the user handle given by the Relying Party. */
  userEntity: {
    id: BufferSource;
    name?: string;
    displayName?: string;
    icon?: string;
  };
  /** A sequence of pairs of PublicKeyCredentialType and public key algorithms (COSEAlgorithmIdentifier) requested by the Relying Party. This sequence is ordered from most preferred to least preferred. The authenticator makes a best-effort to create the most preferred credential that it can. */
  credTypesAndPubKeyAlgs: {
    alg: number;
    type: "public-key"; // not used
  }[];
  /** An OPTIONAL list of PublicKeyCredentialDescriptor objects provided by the Relying Party with the intention that, if any of these are known to the authenticator, it SHOULD NOT create a new credential. excludeCredentialDescriptorList contains a list of known credentials. */
  excludeCredentialDescriptorList?: PublicKeyCredentialDescriptor[];
  /** A map from extension identifiers to their authenticator extension inputs, created by the client based on the extensions requested by the Relying Party, if any. */
  extensions?: {
    appid?: string;
    appidExclude?: string;
    credProps?: boolean;
    uvm?: boolean;
  };
  /** A Boolean value that indicates that individually-identifying attestation MAY be returned by the authenticator. */
  enterpriseAttestationPossible?: boolean; // Ignored by bitwarden at the moment
  /** The effective resident key requirement for credential creation, a Boolean value determined by the client. Resident is synonymous with discoverable. */
  requireResidentKey: boolean;
  requireUserVerification: boolean;
  /** Forwarded to user interface */
  fallbackSupported: boolean;
  /** The constant Boolean value true. It is included here as a pseudo-parameter to simplify applying this abstract authenticator model to implementations that may wish to make a test of user presence optional although WebAuthn does not. */
  // requireUserPresence: true; // Always required
}

export interface Fido2AuthenticatorMakeCredentialResult {
  credentialId: BufferSource;
  attestationObject: BufferSource;
  authData: BufferSource;
  publicKey: BufferSource;
  publicKeyAlgorithm: number;
}

/**
 * Parameters for {@link Fido2AuthenticatorService.getAssertion}

 * This interface represents the input parameters described in
 * https://www.w3.org/TR/webauthn-3/#sctn-op-get-assertion
 */
export interface Fido2AuthenticatorGetAssertionParams {
  /** The caller’s RP ID, as determined by the user agent and the client. */
  rpId: string;
  /** The hash of the serialized client data, provided by the client. */
  hash: BufferSource;
  allowCredentialDescriptorList: PublicKeyCredentialDescriptor[];
  /** The effective user verification requirement for assertion, a Boolean value provided by the client. */
  requireUserVerification: boolean;
  /** The constant Boolean value true. It is included here as a pseudo-parameter to simplify applying this abstract authenticator model to implementations that may wish to make a test of user presence optional although WebAuthn does not. */
  // requireUserPresence: boolean; // Always required
  extensions: unknown;
  /** Forwarded to user interface */
  fallbackSupported: boolean;

  // Bypass the UI and assume that the user has already interacted with the authenticator
  assumeUserPresence?: boolean;
}

export interface Fido2AuthenticatorGetAssertionResult {
  selectedCredential: {
    id: Uint8Array;
    userHandle?: Uint8Array;
  };
  authenticatorData: Uint8Array;
  signature: Uint8Array;
}
