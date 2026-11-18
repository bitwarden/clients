// Polyfill for Symbol.dispose required by the service's use of `using` keyword
import "core-js/proposals/explicit-resource-management";

import { mock, MockProxy } from "jest-mock-extended";
import { Observable, of } from "rxjs";

import {
  AuthClient,
  BitwardenClient,
  JitMasterPasswordRegistrationResponse,
  KeyConnectorRegistrationResult,
  TdeRegistrationResponse,
} from "@bitwarden/sdk-internal";

import { MasterPasswordSalt } from "../../key-management/master-password/types/master-password.types";
import { RegisterSdkService } from "../../platform/abstractions/sdk/register-sdk.service";
import { Rc } from "../../platform/misc/reference-counting/rc";
import { UserId } from "../../types/guid";

import { DefaultSsoJitProvisionFinishService } from "./default-sso-jit-provision-finish.service";
import {
  SsoJitProvisionFinishKeyConnectorParams,
  SsoJitProvisionFinishPasswordParams,
  SsoJitProvisionFinishTrustedDeviceParams,
} from "./sso-jit-provision-finish.service";

describe("DefaultSsoJitProvisionFinishService", () => {
  let registerSdkService: MockProxy<RegisterSdkService>;

  let sut: DefaultSsoJitProvisionFinishService;

  let dispose: jest.Mock;
  let registrationClient: {
    post_keys_for_jit_password_registration: jest.Mock;
    post_keys_for_key_connector_registration: jest.Mock;
    post_keys_for_tde_registration: jest.Mock;
  };

  const userId = "d4e2e3a1-1b5e-4c3b-8d7a-9f8e7d6c5b4a" as UserId;
  const orgId = "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d";
  const orgPublicKey = "org-public-key-base64";

  const inviteCases: [string, boolean | undefined][] = [
    ["no invite decision", undefined],
    ["a direct invite", true],
    ["an open invite", false],
  ];

  beforeEach(() => {
    registerSdkService = mock<RegisterSdkService>();

    sut = new DefaultSsoJitProvisionFinishService(registerSdkService);

    // Mock the SDK registration client.
    const sdkRef = {
      value: mock<BitwardenClient>(),
      [Symbol.dispose]: jest.fn(),
    };
    dispose = sdkRef[Symbol.dispose];
    registrationClient = {
      post_keys_for_jit_password_registration: jest.fn(),
      post_keys_for_key_connector_registration: jest.fn(),
      post_keys_for_tde_registration: jest.fn(),
    };
    sdkRef.value.auth.mockReturnValue({
      registration: jest.fn().mockReturnValue(registrationClient),
    } as unknown as AuthClient);
    registerSdkService.registerClient$.mockReturnValue(
      of({ take: jest.fn().mockReturnValue(sdkRef) }) as unknown as Observable<Rc<BitwardenClient>>,
    );
  });

  function sdkNotAvailable() {
    registerSdkService.registerClient$.mockReturnValue(
      of(null) as unknown as Observable<Rc<BitwardenClient>>,
    );
  }

  describe("finishPassword", () => {
    const registration = { user_key: "user-key" } as JitMasterPasswordRegistrationResponse;
    let params: SsoJitProvisionFinishPasswordParams;

    beforeEach(() => {
      params = {
        userId,
        orgId,
        orgPublicKey,
        orgSsoIdentifier: "org-sso-id",
        newPassword: "Test@Password123!",
        newPasswordHint: "test-hint",
        salt: "user@example.com" as MasterPasswordSalt,
        resetPasswordAutoEnroll: true,
      };
      registrationClient.post_keys_for_jit_password_registration.mockResolvedValue(registration);
    });

    it("should register through the SDK and return the SDK response", async () => {
      // Act
      const result = await sut.finishPassword(params);

      // Assert
      expect(result).toBe(registration);
      expect(registerSdkService.registerClient$).toHaveBeenCalledWith(userId);
      expect(registrationClient.post_keys_for_jit_password_registration).toHaveBeenCalledWith({
        org_id: orgId,
        org_public_key: orgPublicKey,
        master_password: params.newPassword,
        master_password_hint: params.newPasswordHint,
        salt: params.salt,
        organization_sso_identifier: params.orgSsoIdentifier,
        user_id: userId,
        reset_password_enroll: true,
        accept_organization_invite: undefined,
      });
      expect(dispose).toHaveBeenCalled();
    });

    it.each(inviteCases)(
      "should pass acceptOrganizationInvite to the SDK unchanged for %s (%s), because the SDK chooses the endpoint",
      async (_, acceptOrganizationInvite) => {
        // Arrange
        params.acceptOrganizationInvite = acceptOrganizationInvite;

        // Act
        await sut.finishPassword(params);

        // Assert
        expect(registrationClient.post_keys_for_jit_password_registration).toHaveBeenCalledWith(
          expect.objectContaining({ accept_organization_invite: acceptOrganizationInvite }),
        );
      },
    );

    it("should leave the account recovery enrollment decision to the SDK for an open invite", async () => {
      // Arrange
      params.resetPasswordAutoEnroll = true;
      params.acceptOrganizationInvite = false;

      // Act
      await sut.finishPassword(params);

      // Assert: the SDK skips enrollment when the invite stays open, so both values pass unchanged.
      expect(registrationClient.post_keys_for_jit_password_registration).toHaveBeenCalledWith(
        expect.objectContaining({
          reset_password_enroll: true,
          accept_organization_invite: false,
        }),
      );
    });

    it("should throw when the SDK is not available", async () => {
      // Arrange
      sdkNotAvailable();

      // Act
      const promise = sut.finishPassword(params);

      // Assert
      await expect(promise).rejects.toThrow("SDK not available");
    });

    it("should rethrow when SDK registration fails", async () => {
      // Arrange
      const error = new Error("SDK crypto operation failed");
      registrationClient.post_keys_for_jit_password_registration.mockRejectedValue(error);

      // Act
      const promise = sut.finishPassword(params);

      // Assert
      await expect(promise).rejects.toThrow(error);
    });
  });

  describe("finishTrustedDevice", () => {
    const registration = { user_key: "user-key" } as TdeRegistrationResponse;
    let params: SsoJitProvisionFinishTrustedDeviceParams;

    beforeEach(() => {
      params = {
        userId,
        orgId,
        orgPublicKey,
        deviceIdentifier: "device-identifier",
        trustDevice: true,
      };
      registrationClient.post_keys_for_tde_registration.mockResolvedValue(registration);
    });

    it("should register through the SDK and return the SDK response", async () => {
      // Act
      const result = await sut.finishTrustedDevice(params);

      // Assert
      expect(result).toBe(registration);
      expect(registerSdkService.registerClient$).toHaveBeenCalledWith(userId);
      expect(registrationClient.post_keys_for_tde_registration).toHaveBeenCalledWith({
        org_id: orgId,
        org_public_key: orgPublicKey,
        user_id: userId,
        device_identifier: "device-identifier",
        trust_device: true,
        accept_organization_invite: undefined,
      });
      expect(dispose).toHaveBeenCalled();
    });

    it.each(inviteCases)(
      "should pass acceptOrganizationInvite to the SDK unchanged for %s (%s), because the SDK chooses the endpoint",
      async (_, acceptOrganizationInvite) => {
        // Arrange
        params.acceptOrganizationInvite = acceptOrganizationInvite;

        // Act
        await sut.finishTrustedDevice(params);

        // Assert
        expect(registrationClient.post_keys_for_tde_registration).toHaveBeenCalledWith(
          expect.objectContaining({ accept_organization_invite: acceptOrganizationInvite }),
        );
      },
    );

    it.each([true, false])("should pass trustDevice (%s) to the SDK", async (trustDevice) => {
      // Arrange
      params.trustDevice = trustDevice;

      // Act
      await sut.finishTrustedDevice(params);

      // Assert
      expect(registrationClient.post_keys_for_tde_registration).toHaveBeenCalledWith(
        expect.objectContaining({ trust_device: trustDevice }),
      );
    });

    it("should throw when the SDK is not available", async () => {
      // Arrange
      sdkNotAvailable();

      // Act
      const promise = sut.finishTrustedDevice(params);

      // Assert
      await expect(promise).rejects.toThrow("SDK not available");
    });

    it("should rethrow when SDK registration fails", async () => {
      // Arrange
      const error = new Error("SDK crypto operation failed");
      registrationClient.post_keys_for_tde_registration.mockRejectedValue(error);

      // Act
      const promise = sut.finishTrustedDevice(params);

      // Assert
      await expect(promise).rejects.toThrow(error);
    });
  });

  describe("finishKeyConnector", () => {
    const keyConnectorUrl = "https://key-connector.example.com";
    const registration = { user_key: "user-key" } as KeyConnectorRegistrationResult;
    let params: SsoJitProvisionFinishKeyConnectorParams;

    beforeEach(() => {
      params = { userId, orgSsoIdentifier: "org-sso-id", keyConnectorUrl };
      registrationClient.post_keys_for_key_connector_registration.mockResolvedValue(registration);
    });

    it("should register through the SDK and return the SDK response", async () => {
      // Act
      const result = await sut.finishKeyConnector(params);

      // Assert
      expect(result).toBe(registration);
      expect(registerSdkService.registerClient$).toHaveBeenCalledWith(userId);
      expect(registrationClient.post_keys_for_key_connector_registration).toHaveBeenCalledWith(
        keyConnectorUrl,
        "org-sso-id",
        undefined,
      );
      expect(dispose).toHaveBeenCalled();
    });

    it.each(inviteCases)(
      "should pass acceptOrganizationInvite to the SDK unchanged for %s (%s), because the SDK chooses the endpoint",
      async (_, acceptOrganizationInvite) => {
        // Arrange
        params.acceptOrganizationInvite = acceptOrganizationInvite;

        // Act
        await sut.finishKeyConnector(params);

        // Assert
        expect(registrationClient.post_keys_for_key_connector_registration).toHaveBeenCalledWith(
          keyConnectorUrl,
          "org-sso-id",
          acceptOrganizationInvite,
        );
      },
    );

    it("should throw when the SDK is not available", async () => {
      // Arrange
      sdkNotAvailable();

      // Act
      const promise = sut.finishKeyConnector(params);

      // Assert
      await expect(promise).rejects.toThrow("SDK not available");
    });

    it("should rethrow when SDK registration fails", async () => {
      // Arrange
      const error = new Error("SDK crypto operation failed");
      registrationClient.post_keys_for_key_connector_registration.mockRejectedValue(error);

      // Act
      const promise = sut.finishKeyConnector(params);

      // Assert
      await expect(promise).rejects.toThrow(error);
    });
  });
});
