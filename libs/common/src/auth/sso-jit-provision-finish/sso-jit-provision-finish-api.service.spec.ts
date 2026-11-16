import { mock, MockProxy } from "jest-mock-extended";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { PBKDF2KdfConfig } from "@bitwarden/legacy-crypto";

import { ApiService } from "../../abstractions/api.service";
import { FeatureFlag } from "../../enums/feature-flag.enum";
import {
  MasterKeyWrappedUserKey,
  MasterPasswordAuthenticationHash,
  MasterPasswordSalt,
  MasterPasswordUnlockData,
} from "../../key-management/master-password/types/master-password.types";
import { ConfigService } from "../../platform/abstractions/config/config.service";
import { LogService } from "../../platform/abstractions/log.service";
import { SetPasswordRequest } from "../models/request/set-password.request";

import { SsoJitProvisionFinishApiService } from "./sso-jit-provision-finish-api.service";
import { SsoJitProvisionFinishPasswordRequest } from "./sso-jit-provision-finish-password.request";

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
