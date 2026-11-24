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

import { FakeGlobalStateProvider } from "../../../spec";
import { FeatureFlag } from "../../enums/feature-flag.enum";
import { MasterPasswordSalt } from "../../key-management/master-password/types/master-password.types";
import { ConfigService } from "../../platform/abstractions/config/config.service";
import { RegisterSdkService } from "../../platform/abstractions/sdk/register-sdk.service";
import { Rc } from "../../platform/misc/reference-counting/rc";
import { OrganizationId, UserId } from "../../types/guid";
import { OpenOrganizationInvite } from "../organization-invite/models/open-organization-invite";
import { OPEN_ORGANIZATION_INVITE } from "../organization-invite/services/implementations/organization-invite.state";

import { DefaultSsoJitProvisionFinishService } from "./default-sso-jit-provision-finish.service";
import { SsoJitProvisionFinishKeyConnectorParams } from "./sso-jit-provision-finish-key-connector.params";
import { SsoJitProvisionFinishPasswordParams } from "./sso-jit-provision-finish-password.params";
import { SsoJitProvisionFinishTrustedDeviceParams } from "./sso-jit-provision-finish-trusted-device.params";

describe("DefaultSsoJitProvisionFinishService", () => {
  let registerSdkService: MockProxy<RegisterSdkService>;
  let configService: MockProxy<ConfigService>;
  let globalStateProvider: FakeGlobalStateProvider;

  let sut: DefaultSsoJitProvisionFinishService;

  let dispose: jest.Mock;
  let registrationClient: {
    post_keys_for_jit_password_registration: jest.Mock;
    post_keys_for_key_connector_registration: jest.Mock;
    post_keys_for_tde_registration: jest.Mock;
  };

  const userId = "d4e2e3a1-1b5e-4c3b-8d7a-9f8e7d6c5b4a" as UserId;
  const orgId = "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d" as OrganizationId;
  const orgPublicKey = "org-public-key-base64";

  const openOrgInvite = new OpenOrganizationInvite({
    organizationId: orgId,
    inviteLinkCode: "invite-link-code",
    inviteKey: "invite-key",
    organizationName: "org-name",
  });

  const otherOrgOpenInvite = new OpenOrganizationInvite({
    organizationId: "f9e8d7c6-b5a4-4f3e-9d2c-1b0a9f8e7d6c",
    inviteLinkCode: "other-invite-link-code",
    inviteKey: "other-invite-key",
    organizationName: "other-org-name",
  });

  const upperCaseOrgIdOpenInvite = new OpenOrganizationInvite({
    organizationId: orgId.toUpperCase(),
    inviteLinkCode: "invite-link-code",
    inviteKey: "invite-key",
    organizationName: "org-name",
  });

  /** [description, flag on, stored open invite, expected acceptOrganizationInvite] */
  const inviteCases: [string, boolean, OpenOrganizationInvite | null, boolean][] = [
    ["flag off and no open invite", false, null, true],
    ["flag off and an open invite", false, openOrgInvite, true],
    ["flag on and no open invite", true, null, true],
    ["flag on and an open invite for the org", true, openOrgInvite, false],
    ["flag on and an open invite for the org in upper case", true, upperCaseOrgIdOpenInvite, false],
    ["flag on and an open invite for a different org", true, otherOrgOpenInvite, true],
  ];

  function arrangeInvite(inviteLinkAutoConfirm: boolean, invite: OpenOrganizationInvite | null) {
    configService.getFeatureFlag.mockImplementation(async (flag) =>
      flag === FeatureFlag.InviteLinkAutoConfirm ? inviteLinkAutoConfirm : false,
    );
    globalStateProvider.getFake(OPEN_ORGANIZATION_INVITE).stateSubject.next(invite);
  }

  beforeEach(() => {
    registerSdkService = mock<RegisterSdkService>();
    configService = mock<ConfigService>();
    globalStateProvider = new FakeGlobalStateProvider();

    sut = new DefaultSsoJitProvisionFinishService(
      registerSdkService,
      configService,
      globalStateProvider,
    );

    // Default: flag off, so the invite is accepted.
    arrangeInvite(false, null);

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

  describe("shouldAcceptOrganizationInvite", () => {
    it.each(inviteCases)(
      "should return the decision for %s",
      async (_, inviteLinkAutoConfirm, invite, expected) => {
        // Arrange
        arrangeInvite(inviteLinkAutoConfirm, invite);

        // Act
        const result = await sut.shouldAcceptOrganizationInvite(orgId);

        // Assert
        expect(result).toBe(expected);
      },
    );

    it("should not read the stored invite when the flag is off", async () => {
      // Arrange
      arrangeInvite(false, openOrgInvite);
      globalStateProvider.mock.get.mockClear();

      // Act
      await sut.shouldAcceptOrganizationInvite(orgId);

      // Assert
      expect(configService.getFeatureFlag).toHaveBeenCalledWith(FeatureFlag.InviteLinkAutoConfirm);
      expect(globalStateProvider.mock.get).not.toHaveBeenCalledWith(OPEN_ORGANIZATION_INVITE);
    });
  });

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
      expect(result).toEqual({ registration, organizationInviteAccepted: true });
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
        accept_organization_invite: true,
      });
      expect(dispose).toHaveBeenCalled();
    });

    it.each(inviteCases)(
      "should send and return the invite decision for %s",
      async (_, inviteLinkAutoConfirm, invite, acceptOrganizationInvite) => {
        // Arrange
        arrangeInvite(inviteLinkAutoConfirm, invite);

        // Act
        const result = await sut.finishPassword(params);

        // Assert
        expect(registrationClient.post_keys_for_jit_password_registration).toHaveBeenCalledWith(
          expect.objectContaining({ accept_organization_invite: acceptOrganizationInvite }),
        );
        expect(result.organizationInviteAccepted).toBe(acceptOrganizationInvite);
      },
    );

    it("should leave the account recovery enrollment decision to the SDK for an open invite", async () => {
      // Arrange
      params.resetPasswordAutoEnroll = true;
      arrangeInvite(true, openOrgInvite);

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
      expect(result).toEqual({ registration, organizationInviteAccepted: true });
      expect(registerSdkService.registerClient$).toHaveBeenCalledWith(userId);
      expect(registrationClient.post_keys_for_tde_registration).toHaveBeenCalledWith({
        org_id: orgId,
        org_public_key: orgPublicKey,
        user_id: userId,
        device_identifier: "device-identifier",
        trust_device: true,
        accept_organization_invite: true,
      });
      expect(dispose).toHaveBeenCalled();
    });

    it.each(inviteCases)(
      "should send and return the invite decision for %s",
      async (_, inviteLinkAutoConfirm, invite, acceptOrganizationInvite) => {
        // Arrange
        arrangeInvite(inviteLinkAutoConfirm, invite);

        // Act
        const result = await sut.finishTrustedDevice(params);

        // Assert
        expect(registrationClient.post_keys_for_tde_registration).toHaveBeenCalledWith(
          expect.objectContaining({ accept_organization_invite: acceptOrganizationInvite }),
        );
        expect(result.organizationInviteAccepted).toBe(acceptOrganizationInvite);
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
      params = { userId, orgId, orgSsoIdentifier: "org-sso-id", keyConnectorUrl };
      registrationClient.post_keys_for_key_connector_registration.mockResolvedValue(registration);
    });

    it("should register through the SDK and return the SDK response", async () => {
      // Act
      const result = await sut.finishKeyConnector(params);

      // Assert
      expect(result).toEqual({ registration, organizationInviteAccepted: true });
      expect(registerSdkService.registerClient$).toHaveBeenCalledWith(userId);
      expect(registrationClient.post_keys_for_key_connector_registration).toHaveBeenCalledWith(
        keyConnectorUrl,
        "org-sso-id",
        true,
      );
      expect(dispose).toHaveBeenCalled();
    });

    it.each(inviteCases)(
      "should send and return the invite decision for %s",
      async (_, inviteLinkAutoConfirm, invite, acceptOrganizationInvite) => {
        // Arrange
        arrangeInvite(inviteLinkAutoConfirm, invite);

        // Act
        const result = await sut.finishKeyConnector(params);

        // Assert
        expect(registrationClient.post_keys_for_key_connector_registration).toHaveBeenCalledWith(
          keyConnectorUrl,
          "org-sso-id",
          acceptOrganizationInvite,
        );
        expect(result.organizationInviteAccepted).toBe(acceptOrganizationInvite);
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
