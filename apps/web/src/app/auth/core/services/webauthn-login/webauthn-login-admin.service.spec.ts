// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { randomBytes } from "crypto";

import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { WebAuthnLoginPrfKeyServiceAbstraction } from "@bitwarden/common/auth/abstractions/webauthn/webauthn-login-prf-key.service.abstraction";
import { WebAuthnLoginCredentialAssertionView } from "@bitwarden/common/auth/models/view/webauthn-login/webauthn-login-credential-assertion.view";
import { WebAuthnLoginAssertionResponseRequest } from "@bitwarden/common/auth/services/webauthn-login/request/webauthn-login-assertion-response.request";
import { RotateableKeySet } from "@bitwarden/common/key-management/keys/models/rotateable-key-set";
import { RotateableKeySetService } from "@bitwarden/common/key-management/keys/services/abstractions/rotateable-key-set.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { makeSymmetricCryptoKey } from "@bitwarden/common/spec";
import { PrfKey, UserKey } from "@bitwarden/common/types/key";
import { newGuid } from "@bitwarden/guid";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { EncString } from "@bitwarden/legacy-crypto";
import { UserId } from "@bitwarden/user-core";

import { CredentialCreateOptionsView } from "../../views/credential-create-options.view";
import { PendingWebauthnLoginCredentialView } from "../../views/pending-webauthn-login-credential.view";

import { EnableCredentialEncryptionRequest } from "./request/enable-credential-encryption.request";
import { WebAuthnLoginAdminApiService } from "./webauthn-login-admin-api.service";
import { WebauthnLoginAdminService } from "./webauthn-login-admin.service";

describe("WebauthnAdminService", () => {
  let apiService!: MockProxy<WebAuthnLoginAdminApiService>;
  let userVerificationService!: MockProxy<UserVerificationService>;
  let rotateableKeySetService!: MockProxy<RotateableKeySetService>;
  let webAuthnLoginPrfKeyService!: MockProxy<WebAuthnLoginPrfKeyServiceAbstraction>;
  let credentials: MockProxy<CredentialsContainer>;
  let keyService: MockProxy<KeyService>;
  let service!: WebauthnLoginAdminService;

  let originalAuthenticatorAssertionResponse!: AuthenticatorAssertionResponse | any;
  const mockUserId = newGuid() as UserId;
  const mockPrfWrappingKey = makeSymmetricCryptoKey(64, 1) as PrfKey;
  const mockUserKey = makeSymmetricCryptoKey(64) as UserKey;

  beforeAll(() => {
    // Polyfill missing class
    window.PublicKeyCredential = class {} as any;
    window.AuthenticatorAttestationResponse = class {} as any;
    window.AuthenticatorAssertionResponse = class {} as any;
    apiService = mock<WebAuthnLoginAdminApiService>();
    userVerificationService = mock<UserVerificationService>();
    rotateableKeySetService = mock<RotateableKeySetService>();
    webAuthnLoginPrfKeyService = mock<WebAuthnLoginPrfKeyServiceAbstraction>();
    keyService = mock<KeyService>();
    credentials = mock<CredentialsContainer>();
    service = new WebauthnLoginAdminService(
      apiService,
      userVerificationService,
      rotateableKeySetService,
      webAuthnLoginPrfKeyService,
      keyService,
      credentials,
    );

    // Save original global class
    originalAuthenticatorAssertionResponse = global.AuthenticatorAssertionResponse;
    // Mock the global AuthenticatorAssertionResponse class b/c the class is only available in secure contexts
    global.AuthenticatorAssertionResponse = MockAuthenticatorAssertionResponse;

    keyService.userKey$.mockReturnValue(of(mockUserKey));
    webAuthnLoginPrfKeyService.createSymmetricKeyFromPrf.mockResolvedValue(mockPrfWrappingKey);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Restore global after all tests are done
    global.AuthenticatorAssertionResponse = originalAuthenticatorAssertionResponse;
  });

  describe("createCredential", () => {
    it("should return undefined when navigator.credentials throws", async () => {
      credentials.create.mockRejectedValue(new Error("Mocked error"));
      const options = createCredentialCreateOptions();

      const result = await service.createCredential(options);

      expect(result).toBeUndefined();
    });

    it("should return credential when navigator.credentials does not throw", async () => {
      const deviceResponse = createDeviceResponse({ prfEnabled: false });
      credentials.create.mockResolvedValue(deviceResponse as PublicKeyCredential);
      const createOptions = createCredentialCreateOptions();

      const result = await service.createCredential(createOptions);

      expect(result).toEqual({
        deviceResponse,
        createOptions,
        supportsPrf: false,
      } as PendingWebauthnLoginCredentialView);
    });

    it("should return supportsPrf=true when extensions contain prf", async () => {
      const deviceResponse = createDeviceResponse({ prfEnabled: true });
      credentials.create.mockResolvedValue(deviceResponse as PublicKeyCredential);
      const createOptions = createCredentialCreateOptions();

      const result = await service.createCredential(createOptions);

      expect(result.supportsPrf).toBe(true);
    });

    it("should return prfResult when PRF extension output contains value", async () => {
      const deviceResponse = createDeviceResponse({ prfEnabled: true, prfResult: true });
      credentials.create.mockResolvedValue(deviceResponse as PublicKeyCredential);
      const createOptions = createCredentialCreateOptions();

      const result = await service.createCredential(createOptions);

      expect(result.supportsPrf).toBe(true);
      expect(result.prfResult).toBeDefined();
    });

    it("should return prfResult=undefined when authenticator does not support PRF on create", async () => {
      const deviceResponse = createDeviceResponse({ prfEnabled: true, prfResult: false });
      credentials.create.mockResolvedValue(deviceResponse as PublicKeyCredential);
      const createOptions = createCredentialCreateOptions();

      const result = await service.createCredential(createOptions);

      expect(result.supportsPrf).toBe(true);
      expect(result.prfResult).toBeUndefined();
    });
  });

  describe("createKeySet", () => {
    it("should return prfKeySet when supportsPrf == true", async () => {
      const createdCredential = createDeviceResponse({ prfEnabled: true });
      credentials.create.mockResolvedValue(createdCredential as PublicKeyCredential);
      const createOptions = createCredentialCreateOptions();

      const pendingCredential: PendingWebauthnLoginCredentialView = {
        createOptions,
        deviceResponse: createdCredential,
        supportsPrf: true,
        prfResult: undefined,
      };

      const assertedCredential = getDeviceResponse({ prfResult: true });
      credentials.get.mockResolvedValueOnce(assertedCredential);

      const mockEncryptedPublicKey = new EncString("test_encryptedPublicKey");
      const mockEncryptedUserKey = new EncString("test_encryptedUserKey");
      const mockedKeySet = new RotateableKeySet<PrfKey>(
        mockEncryptedUserKey,
        mockEncryptedPublicKey,
      );
      rotateableKeySetService.createKeySet.mockResolvedValue(mockedKeySet);

      const keySet = await service.createKeySet(pendingCredential, mockUserId);

      expect(credentials.get).toHaveBeenCalled();
      expect(keySet).toEqual(mockedKeySet);
    });

    it("should return prfKeySet when prfResult contains value", async () => {
      const createdCredential = createDeviceResponse({ prfEnabled: true, prfResult: true });
      credentials.create.mockResolvedValue(createdCredential as PublicKeyCredential);
      const createOptions = createCredentialCreateOptions();

      const pendingCredential = {
        createOptions,
        deviceResponse: createdCredential,
        supportsPrf: true,
        prfResult: createdCredential.getClientExtensionResults().prf.results.first,
      };

      const mockEncryptedPublicKey = new EncString("test_encryptedPublicKey");
      const mockEncryptedUserKey = new EncString("test_encryptedUserKey");
      const mockedKeySet = new RotateableKeySet<PrfKey>(
        mockEncryptedUserKey,
        mockEncryptedPublicKey,
      );
      rotateableKeySetService.createKeySet.mockResolvedValue(mockedKeySet);

      const keySet = await service.createKeySet(pendingCredential, mockUserId);

      expect(credentials.get).not.toHaveBeenCalled();
      expect(keySet).toEqual(mockedKeySet);
    });
  });

  describe("enableCredentialEncryption", () => {
    it("should call the necessary methods to update the credential", async () => {
      // Arrange
      const response = new MockPublicKeyCredential();
      const prfKeySet = new RotateableKeySet<PrfKey>(
        new EncString("test_encryptedUserKey"),
        new EncString("test_encryptedPublicKey"),
        new EncString("test_encryptedPrivateKey"),
      );

      const assertionOptions: WebAuthnLoginCredentialAssertionView =
        new WebAuthnLoginCredentialAssertionView(
          "enable_credential_encryption_test_token",
          new WebAuthnLoginAssertionResponseRequest(response),
          {} as PrfKey,
        );

      const request = new EnableCredentialEncryptionRequest();
      request.token = assertionOptions.token;
      request.deviceResponse = assertionOptions.deviceResponse;
      request.encryptedUserKey = prfKeySet.encapsulatedDownstreamKey.encryptedString;
      request.encryptedPublicKey = prfKeySet.encryptedPublicKey.encryptedString;
      request.encryptedPrivateKey = prfKeySet.encryptedPrivateKey.encryptedString;

      // Mock the necessary methods and services
      const createKeySetMock = jest
        .spyOn(rotateableKeySetService, "createKeySet")
        .mockResolvedValue(prfKeySet);
      const updateCredentialMock = jest.spyOn(apiService, "updateCredential").mockResolvedValue();

      // Act
      await service.enableCredentialEncryption(assertionOptions, mockUserId);

      // Assert
      expect(createKeySetMock).toHaveBeenCalledWith(assertionOptions.prfKey, mockUserKey);
      expect(updateCredentialMock).toHaveBeenCalledWith(request);
    });

    it("should throw error when PRF Key is undefined", async () => {
      // Arrange
      const response = new MockPublicKeyCredential();

      const assertionOptions: WebAuthnLoginCredentialAssertionView =
        new WebAuthnLoginCredentialAssertionView(
          "enable_credential_encryption_test_token",
          new WebAuthnLoginAssertionResponseRequest(response),
          undefined,
        );

      // Mock the necessary methods and services
      const createKeySetMock = jest
        .spyOn(rotateableKeySetService, "createKeySet")
        .mockResolvedValue(null);
      const updateCredentialMock = jest.spyOn(apiService, "updateCredential").mockResolvedValue();

      // Act
      try {
        await service.enableCredentialEncryption(assertionOptions, mockUserId);
      } catch (error) {
        // Assert
        expect(error).toEqual(new Error("invalid credential"));
        expect(createKeySetMock).not.toHaveBeenCalled();
        expect(updateCredentialMock).not.toHaveBeenCalled();
      }
    });

    test.each([null, undefined, ""])("should throw an error when userId is %p", async (userId) => {
      const response = new MockPublicKeyCredential();
      const assertionOptions: WebAuthnLoginCredentialAssertionView =
        new WebAuthnLoginCredentialAssertionView(
          "enable_credential_encryption_test_token",
          new WebAuthnLoginAssertionResponseRequest(response),
          {} as PrfKey,
        );
      await expect(
        service.enableCredentialEncryption(assertionOptions, userId as any),
      ).rejects.toThrow("userId is required");
    });

    it("should throw error when WehAuthnLoginCredentialAssertionView is undefined", async () => {
      // Arrange
      const assertionOptions: WebAuthnLoginCredentialAssertionView = undefined;

      // Mock the necessary methods and services
      const createKeySetMock = jest
        .spyOn(rotateableKeySetService, "createKeySet")
        .mockResolvedValue(null);
      const updateCredentialMock = jest.spyOn(apiService, "updateCredential").mockResolvedValue();

      // Act
      try {
        await service.enableCredentialEncryption(assertionOptions, mockUserId);
      } catch (error) {
        // Assert
        expect(error).toEqual(new Error("invalid credential"));
        expect(createKeySetMock).not.toHaveBeenCalled();
        expect(updateCredentialMock).not.toHaveBeenCalled();
      }
    });
  });
});

function createCredentialCreateOptions(): CredentialCreateOptionsView {
  const challenge = {
    publicKey: {
      extensions: {},
    },
    rp: {
      id: "bitwarden.com",
    },
    authenticatorSelection: {
      userVerification: "required",
      residentKey: "required",
    },
  };
  return new CredentialCreateOptionsView(challenge as any, Symbol() as any);
}

function createDeviceResponse({
  prfEnabled = false,
  prfResult = false,
}: { prfEnabled?: boolean; prfResult?: boolean } = {}): PublicKeyCredential {
  const credential = {
    id: "Y29yb2l1IHdhcyBoZXJl",
    rawId: new Uint8Array([0x74, 0x65, 0x73, 0x74]),
    type: "public-key",
    response: {
      attestationObject: new Uint8Array([0, 0, 0]),
      clientDataJSON: "eyJ0ZXN0IjoidGVzdCJ9",
    },
    getClientExtensionResults: () => {
      if (!prfEnabled && !prfResult) {
        return {};
      }

      if (prfResult) {
        return {
          prf: {
            enabled: Boolean(prfEnabled),
            results: {
              first: new Uint8Array([
                0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d,
                0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b,
                0x1c, 0x1d, 0x1e, 0x1f,
              ]),
            },
          },
        };
      }

      return {
        prf: {
          enabled: true,
        },
      };
    },
  } as any;

  Object.setPrototypeOf(credential, PublicKeyCredential.prototype);
  Object.setPrototypeOf(credential.response, AuthenticatorAttestationResponse.prototype);

  return credential;
}

function getDeviceResponse({
  prfResult = false,
}: { prfResult?: boolean } = {}): PublicKeyCredential {
  const credential = {
    id: "Y29yb2l1IHdhcyBoZXJl",
    rawId: new Uint8Array([0x74, 0x65, 0x73, 0x74]),
    type: "public-key",
    response: {
      authenticatorData: new Uint8Array([0, 0, 0]),
      signature: new Uint8Array([0x01, 0x02, 0x03, 0x04]),
    },
    getClientExtensionResults: () => {
      if (!prfResult) {
        return {};
      }

      return {
        prf: {
          results: {
            first: new Uint8Array([
              0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d,
              0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b,
              0x1c, 0x1d, 0x1e, 0x1f,
            ]),
          },
        },
      };
    },
  } as any;

  Object.setPrototypeOf(credential, PublicKeyCredential.prototype);
  Object.setPrototypeOf(credential.response, AuthenticatorAssertionResponse.prototype);

  return credential;
}

/**
 * Mocks for the PublicKeyCredential and AuthenticatorAssertionResponse classes copied from webauthn-login.service.spec.ts
 */

// AuthenticatorAssertionResponse && PublicKeyCredential are only available in secure contexts
// so we need to mock them and assign them to the global object to make them available
// for the tests
class MockAuthenticatorAssertionResponse implements AuthenticatorAssertionResponse {
  clientDataJSON: ArrayBuffer = randomBytes(32).buffer;
  authenticatorData: ArrayBuffer = randomBytes(196).buffer;
  signature: ArrayBuffer = randomBytes(72).buffer;
  userHandle: ArrayBuffer = randomBytes(16).buffer;

  clientDataJSONB64Str = Utils.fromBufferToUrlB64(this.clientDataJSON);
  authenticatorDataB64Str = Utils.fromBufferToUrlB64(this.authenticatorData);
  signatureB64Str = Utils.fromBufferToUrlB64(this.signature);
  userHandleB64Str = Utils.fromBufferToUrlB64(this.userHandle);
}

class MockPublicKeyCredential implements PublicKeyCredential {
  authenticatorAttachment = "cross-platform";
  id = "mockCredentialId";
  type = "public-key";
  rawId: ArrayBuffer = randomBytes(32).buffer;
  rawIdB64Str = Utils.fromBufferToUrlB64(this.rawId);

  response: MockAuthenticatorAssertionResponse = new MockAuthenticatorAssertionResponse();

  // Use random 64 character hex string (32 bytes - matters for symmetric key creation)
  // to represent the prf key binary data and convert to ArrayBuffer
  // Creating the array buffer from a known hex value allows us to
  // assert on the value in tests
  private prfKeyArrayBuffer: ArrayBuffer = Utils.hexStringToArrayBuffer(
    "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  );

  getClientExtensionResults(): any {
    return {
      prf: {
        results: {
          first: this.prfKeyArrayBuffer,
        },
      },
    };
  }

  toJSON(): string {
    // Not currently needed for mocks.
    throw Error("Not implemented");
  }

  static isConditionalMediationAvailable(): Promise<boolean> {
    return Promise.resolve(false);
  }

  static isUserVerifyingPlatformAuthenticatorAvailable(): Promise<boolean> {
    return Promise.resolve(false);
  }
}
