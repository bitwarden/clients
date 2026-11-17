import { mock, MockProxy } from "jest-mock-extended";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { PBKDF2KdfConfig } from "@bitwarden/legacy-crypto";

import { ApiService } from "../../abstractions/api.service";
import { FeatureFlag } from "../../enums/feature-flag.enum";
import { SetKeyConnectorKeyRequest } from "../../key-management/key-connector/models/set-key-connector-key.request";
import {
  MasterKeyWrappedUserKey,
  MasterPasswordAuthenticationHash,
  MasterPasswordSalt,
  MasterPasswordUnlockData,
} from "../../key-management/master-password/types/master-password.types";
import { KeysRequest } from "../../models/request/keys.request";
import { ConfigService } from "../../platform/abstractions/config/config.service";
import { LogService } from "../../platform/abstractions/log.service";
import { UserId } from "../../types/guid";
import { SetPasswordRequest } from "../models/request/set-password.request";
import { TrustedDeviceKeysRequest } from "../services/devices/requests/trusted-device-keys.request";

import { SsoJitProvisionFinishApiService } from "./sso-jit-provision-finish-api.service";
import { SsoJitProvisionFinishPasswordRequest } from "./sso-jit-provision-finish-password.request";
import { SsoJitProvisionFinishSetKeyConnectorKeyRequest } from "./sso-jit-provision-finish-set-key-connector-key.request";
import { SsoJitProvisionFinishTrustedDeviceRequest } from "./sso-jit-provision-finish-trusted-device.request";

describe("SsoJitProvisionFinishApiService", () => {
  let apiService: MockProxy<ApiService>;
  let configService: MockProxy<ConfigService>;
  let logService: MockProxy<LogService>;

  let sut: SsoJitProvisionFinishApiService;

  let request: SsoJitProvisionFinishPasswordRequest;

  function setInviteLinkAutoConfirm(enabled: boolean) {
    configService.getFeatureFlag.mockImplementation(async (flag) =>
      flag === FeatureFlag.InviteLinkAutoConfirm ? enabled : false,
    );
  }

  beforeEach(() => {
    apiService = mock<ApiService>();
    configService = mock<ConfigService>();
    logService = mock<LogService>();

    sut = new SsoJitProvisionFinishApiService(apiService, configService, logService);

    const salt = "salt" as MasterPasswordSalt;
    const kdf = new PBKDF2KdfConfig(600_000);
    request = new SsoJitProvisionFinishPasswordRequest(
      {
        salt,
        kdf,
        masterPasswordAuthenticationHash:
          "masterPasswordAuthenticationHash" as MasterPasswordAuthenticationHash,
      },
      new MasterPasswordUnlockData(salt, kdf, "masterKeyWrappedUserKey" as MasterKeyWrappedUserKey),
      "masterPasswordHint",
      "orgIdentifier",
      {
        publicKey: "publicKey",
        encryptedPrivateKey: "encryptedPrivateKey",
      },
      false,
    );
  });

  describe("postPassword", () => {
    describe("given the pm-34429-invite-link-auto-confirm flag is on", () => {
      beforeEach(() => {
        setInviteLinkAutoConfirm(true);
      });

      it("should POST the request to /sso-jit-provision-finish/password", async () => {
        // Act
        await sut.postPassword(request);

        // Assert
        expect(configService.getFeatureFlag).toHaveBeenCalledWith(
          FeatureFlag.InviteLinkAutoConfirm,
        );
        expect(apiService.send).toHaveBeenCalledTimes(1);
        expect(apiService.send).toHaveBeenCalledWith(
          "POST",
          "/sso-jit-provision-finish/password",
          request,
          true,
          false,
        );
      });

      it.each([
        ["a direct invite", true],
        ["an open invite", false],
      ])(
        "should send acceptOrganizationInvite (%s: %s) to the new endpoint",
        async (_, acceptOrganizationInvite) => {
          // Arrange
          request = new SsoJitProvisionFinishPasswordRequest(
            request.masterPasswordAuthentication,
            request.masterPasswordUnlock,
            request.masterPasswordHint,
            request.orgIdentifier,
            request.keys,
            acceptOrganizationInvite,
          );

          // Act
          await sut.postPassword(request);

          // Assert
          const body = JSON.parse(JSON.stringify(apiService.send.mock.calls[0][2]));
          expect(body.acceptOrganizationInvite).toBe(acceptOrganizationInvite);
        },
      );

      it("should log and rethrow when the request fails", async () => {
        // Arrange
        const error = new Error("request failed");
        apiService.send.mockRejectedValue(error);

        // Act
        const promise = sut.postPassword(request);

        // Assert
        await expect(promise).rejects.toThrow(error);
        expect(logService.error).toHaveBeenCalledWith(error);
      });
    });

    describe("given the pm-34429-invite-link-auto-confirm flag is off", () => {
      beforeEach(() => {
        setInviteLinkAutoConfirm(false);
      });

      it("should POST the legacy request shape to /accounts/set-password", async () => {
        // Act
        await sut.postPassword(request);

        // Assert
        expect(apiService.send).toHaveBeenCalledTimes(1);
        expect(apiService.send).toHaveBeenCalledWith(
          "POST",
          "/accounts/set-password",
          SetPasswordRequest.newConstructor(
            request.masterPasswordAuthentication,
            request.masterPasswordUnlock,
            request.masterPasswordHint,
            request.orgIdentifier,
            request.keys,
          ),
          true,
          false,
        );
      });

      it("should use the legacy endpoint for an open invite too, because the legacy server accepts every invite", async () => {
        // Arrange: the request fixture has acceptOrganizationInvite false (open invite).

        // Act
        await sut.postPassword(request);

        // Assert
        expect(apiService.send).toHaveBeenCalledTimes(1);
        expect(apiService.send.mock.calls[0][1]).toBe("/accounts/set-password");
      });

      it("should NOT send acceptOrganizationInvite to the legacy endpoint", async () => {
        // Act
        await sut.postPassword(request);

        // Assert
        const body = JSON.parse(JSON.stringify(apiService.send.mock.calls[0][2]));
        expect(body).not.toHaveProperty("acceptOrganizationInvite");
      });

      it("should log and rethrow when the request fails", async () => {
        // Arrange
        const error = new Error("request failed");
        apiService.send.mockRejectedValue(error);

        // Act
        const promise = sut.postPassword(request);

        // Assert
        await expect(promise).rejects.toThrow(error);
        expect(logService.error).toHaveBeenCalledWith(error);
      });
    });
  });

  describe("postKeyConnector", () => {
    let keyConnectorKeys: SetKeyConnectorKeyRequest;

    function makeRequest(acceptOrganizationInvite: boolean) {
      return new SsoJitProvisionFinishSetKeyConnectorKeyRequest(
        keyConnectorKeys,
        acceptOrganizationInvite,
      );
    }

    beforeEach(() => {
      keyConnectorKeys = new SetKeyConnectorKeyRequest(
        "keyConnectorKeyWrappedUserKey",
        new PBKDF2KdfConfig(600_000),
        "orgIdentifier",
        new KeysRequest("publicKey", "encryptedPrivateKey"),
      );
    });

    describe("given the pm-34429-invite-link-auto-confirm flag is on", () => {
      beforeEach(() => {
        setInviteLinkAutoConfirm(true);
      });

      it.each([
        ["a direct invite", true],
        ["an open invite", false],
      ])(
        "should POST the request to /sso-jit-provision-finish/key-connector for %s (acceptOrganizationInvite: %s)",
        async (_, acceptOrganizationInvite) => {
          // Arrange
          const keyConnectorRequest = makeRequest(acceptOrganizationInvite);

          // Act
          await sut.postKeyConnector(keyConnectorRequest);

          // Assert
          expect(configService.getFeatureFlag).toHaveBeenCalledWith(
            FeatureFlag.InviteLinkAutoConfirm,
          );
          expect(apiService.send).toHaveBeenCalledTimes(1);
          expect(apiService.send).toHaveBeenCalledWith(
            "POST",
            "/sso-jit-provision-finish/key-connector",
            keyConnectorRequest,
            true,
            false,
          );
        },
      );

      it("should log and rethrow when the request fails", async () => {
        // Arrange
        const error = new Error("request failed");
        apiService.send.mockRejectedValue(error);

        // Act
        const promise = sut.postKeyConnector(makeRequest(true));

        // Assert
        await expect(promise).rejects.toThrow(error);
        expect(logService.error).toHaveBeenCalledWith(error);
      });
    });

    describe("given the pm-34429-invite-link-auto-confirm flag is off", () => {
      beforeEach(() => {
        setInviteLinkAutoConfirm(false);
      });

      it.each([
        ["a direct invite", true],
        ["an open invite", false],
      ])(
        "should POST only the Key Connector keys to /accounts/set-key-connector-key for %s (acceptOrganizationInvite: %s)",
        async (_, acceptOrganizationInvite) => {
          // Act
          await sut.postKeyConnector(makeRequest(acceptOrganizationInvite));

          // Assert
          expect(apiService.send).toHaveBeenCalledTimes(1);
          expect(apiService.send).toHaveBeenCalledWith(
            "POST",
            "/accounts/set-key-connector-key",
            keyConnectorKeys,
            true,
            false,
          );
        },
      );

      it("should log and rethrow when the request fails", async () => {
        // Arrange
        const error = new Error("request failed");
        apiService.send.mockRejectedValue(error);

        // Act
        const promise = sut.postKeyConnector(makeRequest(true));

        // Assert
        await expect(promise).rejects.toThrow(error);
        expect(logService.error).toHaveBeenCalledWith(error);
      });
    });
  });

  describe("postTrustedDevice", () => {
    const userId = "user-id" as UserId;
    const orgId = "org-id";
    const deviceIdentifier = "device-identifier";
    const legacy = { userId, deviceIdentifier };
    const keys = new KeysRequest("publicKey", "encryptedPrivateKey");
    const deviceKeys = new TrustedDeviceKeysRequest(
      "encryptedUserKey",
      "encryptedPublicKey",
      "encryptedPrivateKey",
    );

    function directInviteRequest(withDeviceKeys = true) {
      return new SsoJitProvisionFinishTrustedDeviceRequest(
        keys,
        orgId,
        true,
        "accountRecoveryKey",
        withDeviceKeys ? deviceKeys : undefined,
      );
    }

    function openInviteRequest(withDeviceKeys = true) {
      return new SsoJitProvisionFinishTrustedDeviceRequest(
        keys,
        orgId,
        false,
        undefined,
        withDeviceKeys ? deviceKeys : undefined,
      );
    }

    describe("given the pm-34429-invite-link-auto-confirm flag is on", () => {
      beforeEach(() => {
        setInviteLinkAutoConfirm(true);
      });

      it.each([
        ["a direct invite", directInviteRequest],
        ["an open invite", openInviteRequest],
      ])(
        "should POST one request to /sso-jit-provision-finish/trusted-device for %s",
        async (_, makeRequest) => {
          // Arrange
          const trustedDeviceRequest = makeRequest();

          // Act
          await sut.postTrustedDevice(trustedDeviceRequest, legacy);

          // Assert
          expect(configService.getFeatureFlag).toHaveBeenCalledWith(
            FeatureFlag.InviteLinkAutoConfirm,
          );
          expect(apiService.send).toHaveBeenCalledTimes(1);
          expect(apiService.send).toHaveBeenCalledWith(
            "POST",
            "/sso-jit-provision-finish/trusted-device",
            trustedDeviceRequest,
            true,
            false,
          );
        },
      );

      it("should log and rethrow when the request fails", async () => {
        // Arrange
        const error = new Error("request failed");
        apiService.send.mockRejectedValue(error);

        // Act
        const promise = sut.postTrustedDevice(directInviteRequest(), legacy);

        // Assert
        await expect(promise).rejects.toThrow(error);
        expect(logService.error).toHaveBeenCalledWith(error);
      });
    });

    describe("given the pm-34429-invite-link-auto-confirm flag is off", () => {
      beforeEach(() => {
        setInviteLinkAutoConfirm(false);
      });

      it("should send the account keys, the account recovery enrollment, and the device keys, in that order", async () => {
        // Act
        await sut.postTrustedDevice(directInviteRequest(), legacy);

        // Assert
        expect(apiService.send).toHaveBeenCalledTimes(3);
        expect(apiService.send).toHaveBeenNthCalledWith(
          1,
          "POST",
          "/accounts/keys",
          keys,
          true,
          false,
        );
        expect(apiService.send).toHaveBeenNthCalledWith(
          2,
          "PUT",
          `/organizations/${orgId}/users/${userId}/reset-password-enrollment`,
          { resetPasswordKey: "accountRecoveryKey" },
          true,
          false,
        );
        expect(apiService.send).toHaveBeenNthCalledWith(
          3,
          "PUT",
          `/devices/${deviceIdentifier}/keys`,
          deviceKeys,
          true,
          true,
        );
      });

      it("should NOT send the device keys when the user did not trust the device", async () => {
        // Act
        await sut.postTrustedDevice(directInviteRequest(false), legacy);

        // Assert
        expect(apiService.send).toHaveBeenCalledTimes(2);
        expect(apiService.send.mock.calls.map((call) => call[1])).toEqual([
          "/accounts/keys",
          `/organizations/${orgId}/users/${userId}/reset-password-enrollment`,
        ]);
      });

      it("should throw before any request when the account recovery key is missing, because the legacy requests always enroll", async () => {
        // Arrange: an open invite has no account recovery key.

        // Act
        const promise = sut.postTrustedDevice(openInviteRequest(), legacy);

        // Assert
        await expect(promise).rejects.toThrow("accountRecoveryKey is null or undefined.");
        expect(apiService.send).not.toHaveBeenCalled();
      });

      it("should stop at the first failed request, and log and rethrow", async () => {
        // Arrange
        const error = new Error("request failed");
        apiService.send.mockRejectedValueOnce(error);

        // Act
        const promise = sut.postTrustedDevice(directInviteRequest(), legacy);

        // Assert
        await expect(promise).rejects.toThrow(error);
        expect(apiService.send).toHaveBeenCalledTimes(1);
        expect(logService.error).toHaveBeenCalledWith(error);
      });
    });
  });

  describe("SsoJitProvisionFinishSetKeyConnectorKeyRequest", () => {
    it("should serialize to the server request shape", () => {
      // Arrange
      const keyConnectorRequest = new SsoJitProvisionFinishSetKeyConnectorKeyRequest(
        new SetKeyConnectorKeyRequest(
          "keyConnectorKeyWrappedUserKey",
          new PBKDF2KdfConfig(600_000),
          "orgIdentifier",
          new KeysRequest("publicKey", "encryptedPrivateKey"),
        ),
        false,
      );

      // Act
      const body = JSON.parse(JSON.stringify(keyConnectorRequest));

      // Assert
      expect(body).toEqual({
        keyConnectorKeys: {
          key: "keyConnectorKeyWrappedUserKey",
          kdf: 0,
          kdfIterations: 600_000,
          orgIdentifier: "orgIdentifier",
          keys: { publicKey: "publicKey", encryptedPrivateKey: "encryptedPrivateKey" },
        },
        acceptOrganizationInvite: false,
      });
    });
  });

  describe("SsoJitProvisionFinishTrustedDeviceRequest", () => {
    const keys = new KeysRequest("publicKey", "encryptedPrivateKey");

    it("should serialize a direct invite with the account recovery key and the device keys", () => {
      // Act
      const body = JSON.parse(
        JSON.stringify(
          new SsoJitProvisionFinishTrustedDeviceRequest(
            keys,
            "org-id",
            true,
            "accountRecoveryKey",
            new TrustedDeviceKeysRequest(
              "encryptedUserKey",
              "encryptedPublicKey",
              "encryptedPrivateKey",
            ),
          ),
        ),
      );

      // Assert
      expect(body).toEqual({
        keys: { publicKey: "publicKey", encryptedPrivateKey: "encryptedPrivateKey" },
        organizationId: "org-id",
        acceptOrganizationInvite: true,
        accountRecoveryKey: "accountRecoveryKey",
        deviceKeys: {
          encryptedUserKey: "encryptedUserKey",
          encryptedPublicKey: "encryptedPublicKey",
          encryptedPrivateKey: "encryptedPrivateKey",
        },
      });
    });

    it("should omit the account recovery key and the device keys for an open invite on an untrusted device", () => {
      // Act
      const body = JSON.parse(
        JSON.stringify(new SsoJitProvisionFinishTrustedDeviceRequest(keys, "org-id", false)),
      );

      // Assert
      expect(body).toEqual({
        keys: { publicKey: "publicKey", encryptedPrivateKey: "encryptedPrivateKey" },
        organizationId: "org-id",
        acceptOrganizationInvite: false,
      });
    });
  });

  describe("SsoJitProvisionFinishPasswordRequest", () => {
    it("should serialize to the server request shape", () => {
      // Act
      const body = JSON.parse(JSON.stringify(request));

      // Assert
      expect(body).toEqual({
        masterPasswordAuthentication: {
          salt: "salt",
          kdf: { kdfType: 0, iterations: 600_000 },
          masterPasswordAuthenticationHash: "masterPasswordAuthenticationHash",
        },
        masterPasswordUnlock: {
          salt: "salt",
          kdf: { kdfType: 0, iterations: 600_000 },
          masterKeyWrappedUserKey: "masterKeyWrappedUserKey",
        },
        masterPasswordHint: "masterPasswordHint",
        orgIdentifier: "orgIdentifier",
        keys: {
          publicKey: "publicKey",
          encryptedPrivateKey: "encryptedPrivateKey",
        },
        acceptOrganizationInvite: false,
      });
    });
  });
});
