// Polyfill for Symbol.dispose required by the service's use of `using` keyword
import "core-js/proposals/explicit-resource-management";

import { mock, MockProxy } from "jest-mock-extended";
import { Observable, of } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { PBKDF2KdfConfig } from "@bitwarden/legacy-crypto";
import {
  AuthClient,
  BitwardenClient,
  JitMasterPasswordRegistrationResponse,
} from "@bitwarden/sdk-internal";

import { FeatureFlag } from "../../enums/feature-flag.enum";
import {
  MasterKeyWrappedUserKey,
  MasterPasswordAuthenticationHash,
  MasterPasswordSalt,
  MasterPasswordUnlockData,
} from "../../key-management/master-password/types/master-password.types";
import { ConfigService } from "../../platform/abstractions/config/config.service";
import { RegisterSdkService } from "../../platform/abstractions/sdk/register-sdk.service";
import { Rc } from "../../platform/misc/reference-counting/rc";
import { UserId } from "../../types/guid";

import { DefaultSsoJitProvisionFinishService } from "./default-sso-jit-provision-finish.service";
import { SsoJitProvisionFinishApiService } from "./sso-jit-provision-finish-api.service";
import { SsoJitProvisionFinishPasswordRequest } from "./sso-jit-provision-finish-password.request";
import {
  SsoJitProvisionFinishPasswordData,
  SsoJitProvisionFinishPasswordV1Keys,
} from "./sso-jit-provision-finish.service";

describe("DefaultSsoJitProvisionFinishService", () => {
  let ssoJitProvisionFinishApiService: MockProxy<SsoJitProvisionFinishApiService>;
  let registerSdkService: MockProxy<RegisterSdkService>;
  let configService: MockProxy<ConfigService>;

  let sut: DefaultSsoJitProvisionFinishService;

  const userId = "d4e2e3a1-1b5e-4c3b-8d7a-9f8e7d6c5b4a" as UserId;
  const orgId = "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d";
  const salt = "user@example.com" as MasterPasswordSalt;
  const kdf = new PBKDF2KdfConfig(600_000);

  const v1Keys: SsoJitProvisionFinishPasswordV1Keys = {
    masterPasswordAuthentication: {
      salt,
      kdf,
      masterPasswordAuthenticationHash:
        "masterPasswordAuthenticationHash" as MasterPasswordAuthenticationHash,
    },
    masterPasswordUnlock: new MasterPasswordUnlockData(
      salt,
      kdf,
      "masterKeyWrappedUserKey" as MasterKeyWrappedUserKey,
    ),
    keys: { publicKey: "publicKey", encryptedPrivateKey: "encryptedPrivateKey" },
  };

  let data: SsoJitProvisionFinishPasswordData;

  function setAccountEncryptionV2(enabled: boolean) {
    configService.getFeatureFlag.mockImplementation(async (flag) =>
      flag === FeatureFlag.EnableAccountEncryptionV2JitPasswordRegistration ? enabled : false,
    );
  }

  beforeEach(() => {
    ssoJitProvisionFinishApiService = mock<SsoJitProvisionFinishApiService>();
    registerSdkService = mock<RegisterSdkService>();
    configService = mock<ConfigService>();

    sut = new DefaultSsoJitProvisionFinishService(
      ssoJitProvisionFinishApiService,
      registerSdkService,
      configService,
    );

    data = {
      userId,
      orgId,
      orgSsoIdentifier: "org-sso-id",
      newPassword: "Test@Password123!",
      newPasswordHint: "test-hint",
      salt,
      resetPasswordAutoEnroll: false,
    };
  });

  describe("finishPassword", () => {
    describe("given the enable-account-encryption-v2-jit-password-registration flag is off (V1)", () => {
      beforeEach(() => {
        setAccountEncryptionV2(false);
        data.v1Keys = v1Keys;
      });

      function expectedRequest(acceptOrganizationInvite: boolean) {
        return new SsoJitProvisionFinishPasswordRequest(
          v1Keys.masterPasswordAuthentication,
          v1Keys.masterPasswordUnlock,
          data.newPasswordHint,
          data.orgSsoIdentifier,
          v1Keys.keys,
          acceptOrganizationInvite,
        );
      }

      it("should send the V1 keys through the API service and return a V1 result", async () => {
        // Act
        const result = await sut.finishPassword(data);

        // Assert
        expect(result).toEqual({ encryptionVersion: "V1" });
        expect(configService.getFeatureFlag).toHaveBeenCalledWith(
          FeatureFlag.EnableAccountEncryptionV2JitPasswordRegistration,
        );
        expect(ssoJitProvisionFinishApiService.postPassword).toHaveBeenCalledTimes(1);
        expect(registerSdkService.registerClient$).not.toHaveBeenCalled();
      });

      it.each([true, false])(
        "should send acceptOrganizationInvite (%s) unchanged",
        async (acceptOrganizationInvite) => {
          // Arrange
          data.acceptOrganizationInvite = acceptOrganizationInvite;

          // Act
          await sut.finishPassword(data);

          // Assert
          expect(ssoJitProvisionFinishApiService.postPassword).toHaveBeenCalledWith(
            expectedRequest(acceptOrganizationInvite),
          );
        },
      );

      it("should accept the organization invite when acceptOrganizationInvite is undefined, to match the SDK", async () => {
        // Arrange
        data.acceptOrganizationInvite = undefined;

        // Act
        await sut.finishPassword(data);

        // Assert
        expect(ssoJitProvisionFinishApiService.postPassword).toHaveBeenCalledWith(
          expectedRequest(true),
        );
      });

      it("should throw and NOT call the API service when v1Keys is missing", async () => {
        // Arrange
        data.v1Keys = undefined;

        // Act
        const promise = sut.finishPassword(data);

        // Assert
        await expect(promise).rejects.toThrow(
          "v1Keys is null or undefined. Could not finish SSO JIT provisioning.",
        );
        expect(ssoJitProvisionFinishApiService.postPassword).not.toHaveBeenCalled();
      });

      it("should rethrow when the API service fails", async () => {
        // Arrange
        const error = new Error("request failed");
        ssoJitProvisionFinishApiService.postPassword.mockRejectedValue(error);

        // Act
        const promise = sut.finishPassword(data);

        // Assert
        await expect(promise).rejects.toThrow(error);
      });
    });

    describe("given the enable-account-encryption-v2-jit-password-registration flag is on (V2)", () => {
      let mockSdkRef: {
        value: MockProxy<BitwardenClient>;
        [Symbol.dispose]: jest.Mock;
      };
      let mockRegistration: jest.Mock;

      const orgPublicKey = "org-public-key-base64";

      const registration = {
        user_key: "user-key",
      } as JitMasterPasswordRegistrationResponse;

      beforeEach(() => {
        setAccountEncryptionV2(true);
        data.orgPublicKey = orgPublicKey;

        mockSdkRef = {
          value: mock<BitwardenClient>(),
          [Symbol.dispose]: jest.fn(),
        };
        mockSdkRef.value.auth.mockReturnValue({
          registration: jest.fn().mockReturnValue({
            post_keys_for_jit_password_registration: jest.fn(),
          }),
        } as unknown as AuthClient);

        registerSdkService.registerClient$.mockReturnValue(
          of({ take: jest.fn().mockReturnValue(mockSdkRef) }) as unknown as Observable<
            Rc<BitwardenClient>
          >,
        );

        mockRegistration = mockSdkRef.value.auth().registration()
          .post_keys_for_jit_password_registration as unknown as jest.Mock;
        mockRegistration.mockResolvedValue(registration);
      });

      it("should register through the SDK and return a V2 result with the SDK response", async () => {
        // Act
        const result = await sut.finishPassword(data);

        // Assert
        expect(result).toEqual({ encryptionVersion: "V2", registration });
        expect(registerSdkService.registerClient$).toHaveBeenCalledWith(userId);
        expect(mockRegistration).toHaveBeenCalledWith({
          org_id: orgId,
          org_public_key: orgPublicKey,
          master_password: data.newPassword,
          master_password_hint: data.newPasswordHint,
          salt: data.salt,
          organization_sso_identifier: data.orgSsoIdentifier,
          user_id: userId,
          reset_password_enroll: data.resetPasswordAutoEnroll,
          accept_organization_invite: undefined,
        });
        expect(mockSdkRef[Symbol.dispose]).toHaveBeenCalled();
        expect(ssoJitProvisionFinishApiService.postPassword).not.toHaveBeenCalled();
      });

      it("should NOT need v1Keys", async () => {
        // Arrange
        data.v1Keys = undefined;

        // Act
        const result = await sut.finishPassword(data);

        // Assert
        expect(result.encryptionVersion).toBe("V2");
      });

      it.each([undefined, true, false])(
        "should pass acceptOrganizationInvite (%s) to the SDK unchanged, because the SDK chooses the endpoint",
        async (acceptOrganizationInvite) => {
          // Arrange
          data.acceptOrganizationInvite = acceptOrganizationInvite;

          // Act
          await sut.finishPassword(data);

          // Assert
          expect(mockRegistration).toHaveBeenCalledWith(
            expect.objectContaining({ accept_organization_invite: acceptOrganizationInvite }),
          );
        },
      );

      it("should throw and NOT call the SDK when orgPublicKey is missing", async () => {
        // Arrange
        data.orgPublicKey = undefined;

        // Act
        const promise = sut.finishPassword(data);

        // Assert
        await expect(promise).rejects.toThrow(
          "orgPublicKey is null or undefined. Could not finish SSO JIT provisioning.",
        );
        expect(registerSdkService.registerClient$).not.toHaveBeenCalled();
      });

      it("should throw and make no network call when v1Keys is set, because the caller already did V1 work", async () => {
        // Arrange
        data.v1Keys = v1Keys;

        // Act
        const promise = sut.finishPassword(data);

        // Assert
        await expect(promise).rejects.toThrow(
          "v1Keys must not be set when V2 encryption is on. Could not finish SSO JIT provisioning.",
        );
        expect(registerSdkService.registerClient$).not.toHaveBeenCalled();
        expect(ssoJitProvisionFinishApiService.postPassword).not.toHaveBeenCalled();
      });

      it("should throw when the SDK is not available", async () => {
        // Arrange
        registerSdkService.registerClient$.mockReturnValue(
          of(null) as unknown as Observable<Rc<BitwardenClient>>,
        );

        // Act
        const promise = sut.finishPassword(data);

        // Assert
        await expect(promise).rejects.toThrow("SDK not available");
      });

      it("should rethrow when SDK registration fails", async () => {
        // Arrange
        const error = new Error("SDK crypto operation failed");
        mockRegistration.mockRejectedValue(error);

        // Act
        const promise = sut.finishPassword(data);

        // Assert
        await expect(promise).rejects.toThrow(error);
      });
    });
  });
});
