// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { randomBytes } from "crypto";

import { mock, MockProxy } from "jest-mock-extended";

import { RotateableKeySet } from "@bitwarden/auth/common";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { WebAuthnLoginPrfKeyServiceAbstraction } from "@bitwarden/common/auth/abstractions/webauthn/webauthn-login-prf-key.service.abstraction";
import { WebAuthnLoginCredentialAssertionView } from "@bitwarden/common/auth/models/view/webauthn-login/webauthn-login-credential-assertion.view";
import { WebAuthnLoginAssertionResponseRequest } from "@bitwarden/common/auth/services/webauthn-login/request/webauthn-login-assertion-response.request";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { makeSymmetricCryptoKey } from "@bitwarden/common/spec";
import { PrfKey, UserKey } from "@bitwarden/common/types/key";

import { CredentialCreateOptionsView } from "../../views/credential-create-options.view";
import { PendingWebauthnLoginCredentialView } from "../../views/pending-webauthn-login-credential.view";
import { RotateableKeySetService } from "../rotateable-key-set.service";

import { EnableCredentialEncryptionRequest } from "./request/enable-credential-encryption.request";
import { WebAuthnLoginAdminApiService } from "./webauthn-login-admin-api.service";
import { WebauthnLoginAdminService } from "./webauthn-login-admin.service";

describe("WebauthnAdminService", () => {
  let apiService!: MockProxy<WebAuthnLoginAdminApiService>;
  let userVerificationService!: MockProxy<UserVerificationService>;
  let rotateableKeySetService!: MockProxy<RotateableKeySetService>;
  let webAuthnLoginPrfKeyService!: MockProxy<WebAuthnLoginPrfKeyServiceAbstraction>;
  let credentials: MockProxy<CredentialsContainer>;
  let service!: WebauthnLoginAdminService;

  let originalAuthenticatorAssertionResponse!: AuthenticatorAssertionResponse | any;

  beforeAll(() => {
    // Polyfill missing class
    window.PublicKeyCredential = class {} as any;
    window.AuthenticatorAttestationResponse = class {} as any;
    window.AuthenticatorAssertionResponse = class {} as any;
    apiService = mock<WebAuthnLoginAdminApiService>();
    userVerificationService = mock<UserVerificationService>();
    rotateableKeySetService = mock<RotateableKeySetService>();
    webAuthnLoginPrfKeyService = mock<WebAuthnLoginPrfKeyServiceAbstraction>();
    credentials = mock<CredentialsContainer>();
    service = new WebauthnLoginAdminService(
      apiService,
      userVerificationService,
      rotateableKeySetService,
      webAuthnLoginPrfKeyService,
      credentials,
    );

    // Save original global class
    originalAuthenticatorAssertionResponse = global.AuthenticatorAssertionResponse;
    // Mock the global AuthenticatorAssertionResponse class b/c the class is only available in secure contexts
    global.AuthenticatorAssertionResponse = MockAuthenticatorAssertionResponse;
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
      const deviceResponse = createDeviceResponse({ prf: false });
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
      const deviceResponse = createDeviceResponse({ prf: true });
      credentials.create.mockResolvedValue(deviceResponse as PublicKeyCredential);
      const createOptions = createCredentialCreateOptions();

      const result = await service.createCredential(createOptions);

      expect(result.supportsPrf).toBe(true);
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
      request.encryptedUserKey = prfKeySet.encryptedUserKey.encryptedString;
      request.encryptedPublicKey = prfKeySet.encryptedPublicKey.encryptedString;
      request.encryptedPrivateKey = prfKeySet.encryptedPrivateKey.encryptedString;

      // Mock the necessary methods and services
      const createKeySetMock = jest
        .spyOn(rotateableKeySetService, "createKeySet")
        .mockResolvedValue(prfKeySet);
      const updateCredentialMock = jest.spyOn(apiService, "updateCredential").mockResolvedValue();

      // Act
      await service.enableCredentialEncryption(assertionOptions);

      // Assert
      expect(createKeySetMock).toHaveBeenCalledWith(assertionOptions.prfKey);
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
        await service.enableCredentialEncryption(assertionOptions);
      } catch (error) {
        // Assert
        expect(error).toEqual(new Error("invalid credential"));
        expect(createKeySetMock).not.toHaveBeenCalled();
        expect(updateCredentialMock).not.toHaveBeenCalled();
      }
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
        await service.enableCredentialEncryption(assertionOptions);
      } catch (error) {
        // Assert
        expect(error).toEqual(new Error("invalid credential"));
        expect(createKeySetMock).not.toHaveBeenCalled();
        expect(updateCredentialMock).not.toHaveBeenCalled();
      }
    });
  });

  describe("rotateCredentials", () => {
    it("should throw when old userkey is null", async () => {
      const newUserKey = makeSymmetricCryptoKey(64) as UserKey;
      try {
        await service.getRotatedData(null, newUserKey, null);
      } catch (error) {
        expect(error).toEqual(new Error("oldUserKey is required"));
      }
    });
    it("should throw when new userkey is null", async () => {
      const oldUserKey = makeSymmetricCryptoKey(64) as UserKey;
      try {
        await service.getRotatedData(oldUserKey, null, null);
      } catch (error) {
        expect(error).toEqual(new Error("newUserKey is required"));
      }
    });
    it("should call rotateKeySet with the correct parameters", async () => {
      const oldUserKey = makeSymmetricCryptoKey(64) as UserKey;
      const newUserKey = makeSymmetricCryptoKey(64) as UserKey;
      const mockEncryptedPublicKey = new EncString("test_encryptedPublicKey");
      const mockEncryptedUserKey = new EncString("test_encryptedUserKey");
      jest.spyOn(apiService, "getCredentials").mockResolvedValue({
        data: [
          {
            getRotateableKeyset: () =>
              new RotateableKeySet<PrfKey>(mockEncryptedUserKey, mockEncryptedPublicKey),
            hasPrfKeyset: () => true,
          },
        ],
      } as any);
      const rotateKeySetMock = jest
        .spyOn(rotateableKeySetService, "rotateKeySet")
        .mockResolvedValue(
          new RotateableKeySet<PrfKey>(mockEncryptedUserKey, mockEncryptedPublicKey),
        );
      await service.getRotatedData(oldUserKey, newUserKey, null);
      expect(rotateKeySetMock).toHaveBeenCalledWith(
        expect.any(RotateableKeySet),
        oldUserKey,
        newUserKey,
      );
    });
    it("should skip rotation when no prf keyset is available", async () => {
      const oldUserKey = makeSymmetricCryptoKey(64) as UserKey;
      const newUserKey = makeSymmetricCryptoKey(64) as UserKey;
      jest.spyOn(apiService, "getCredentials").mockResolvedValue({
        data: [
          {
            getRotateableKeyset: () =>
              new RotateableKeySet<PrfKey>(new EncString("test_encryptedUserKey"), null),
            hasPrfKeyset: () => false,
          },
        ],
      } as any);
      const rotateKeySetMock = jest.spyOn(rotateableKeySetService, "rotateKeySet");
      await service.getRotatedData(oldUserKey, newUserKey, null);
      expect(rotateKeySetMock).not.toHaveBeenCalled();
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

function createDeviceResponse({ prf = false }: { prf?: boolean } = {}): PublicKeyCredential {
  const credential = {
    id: "Y29yb2l1IHdhcyBoZXJl",
    rawId: new Uint8Array([0x74, 0x65, 0x73, 0x74]),
    type: "public-key",
    response: {
      attestationObject: new Uint8Array([0, 0, 0]),
      clientDataJSON: "eyJ0ZXN0IjoidGVzdCJ9",
    },
    getClientExtensionResults: () => {
      if (!prf) {
        return {};
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

  static isConditionalMediationAvailable(): Promise<boolean> {
    return Promise.resolve(false);
  }

  static isUserVerifyingPlatformAuthenticatorAvailable(): Promise<boolean> {
    return Promise.resolve(false);
  }
}
