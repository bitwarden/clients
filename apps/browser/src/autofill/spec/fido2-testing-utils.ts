import { mock } from "jest-mock-extended";

import {
  AssertCredentialResult,
  CreateCredentialResult,
} from "@bitwarden/common/platform/abstractions/fido2/fido2-client.service.abstraction";

export function createCredentialCreationOptionsMock(
  customFields: Partial<CredentialCreationOptions> = {},
): CredentialCreationOptions {
  return mock<CredentialCreationOptions>({
    publicKey: mock<PublicKeyCredentialCreationOptions>({
      authenticatorSelection: { authenticatorAttachment: "platform" },
      excludeCredentials: [{ id: new ArrayBuffer(32), type: "public-key" }],
      pubKeyCredParams: [{ alg: -7, type: "public-key" }],
      user: { id: new ArrayBuffer(32), name: "test", displayName: "test" },
    }),
    ...customFields,
  });
}

export function createCreateCredentialResultMock(
  customFields: Partial<CreateCredentialResult> = {},
): CreateCredentialResult {
  return mock<CreateCredentialResult>({
    credentialId: "mock",
    clientDataJSON: "mock",
    attestationObject: "mock",
    authData: "mock",
    publicKey: "mock",
    publicKeyAlgorithm: -7,
    transports: ["internal"],
    ...customFields,
  });
}

export function createCredentialRequestOptionsMock(
  customFields: Partial<CredentialRequestOptions> = {},
): CredentialRequestOptions {
  return mock<CredentialRequestOptions>({
    mediation: "optional",
    publicKey: mock<PublicKeyCredentialRequestOptions>({
      allowCredentials: [{ id: new ArrayBuffer(32), type: "public-key" }],
    }),
    ...customFields,
  });
}

export function createAssertCredentialResultMock(
  customFields: Partial<AssertCredentialResult> = {},
): AssertCredentialResult {
  return mock<AssertCredentialResult>({
    credentialId: "mock",
    clientDataJSON: "mock",
    authenticatorData: "mock",
    signature: "mock",
    userHandle: "mock",
    ...customFields,
  });
}

export function setupMockedWebAuthnSupport() {
  (globalThis as any).PublicKeyCredential = class PolyfillPublicKeyCredential {
    static isUserVerifyingPlatformAuthenticatorAvailable = () => Promise.resolve(true);
  };
  (globalThis as any).AuthenticatorAttestationResponse =
    class PolyfillAuthenticatorAttestationResponse {};
  (globalThis as any).AuthenticatorAssertionResponse =
    class PolyfillAuthenticatorAssertionResponse {};
  (globalThis as any).navigator.credentials = {
    create: jest.fn().mockResolvedValue({}),
    get: jest.fn().mockResolvedValue({}),
  };
}
