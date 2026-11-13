import { mock, MockProxy } from "jest-mock-extended";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { PBKDF2KdfConfig } from "@bitwarden/legacy-crypto";

import { ApiService } from "../../../abstractions/api.service";
import {
  MasterKeyWrappedUserKey,
  MasterPasswordAuthenticationData,
  MasterPasswordAuthenticationHash,
  MasterPasswordSalt,
  MasterPasswordUnlockData,
} from "../../../key-management/master-password/types/master-password.types";
import { LogService } from "../../../platform/abstractions/log.service";
import { PasswordRequest } from "../../models/request/password.request";
import { SetPasswordRequest } from "../../models/request/set-password.request";
import { SsoJitProvisionFinishPasswordRequest } from "../../models/request/sso-jit-provision-finish-password.request";
import { UpdateTdeOffboardingPasswordRequest } from "../../models/request/update-tde-offboarding-password.request";
import { UpdateTempPasswordRequest } from "../../models/request/update-temp-password.request";

import { MasterPasswordApiService } from "./master-password-api.service.implementation";

describe("MasterPasswordApiService", () => {
  let apiService: MockProxy<ApiService>;
  let logService: MockProxy<LogService>;

  let sut: MasterPasswordApiService;

  beforeEach(() => {
    apiService = mock<ApiService>();
    logService = mock<LogService>();

    sut = new MasterPasswordApiService(apiService, logService);
  });

  it("should instantiate", () => {
    expect(sut).not.toBeFalsy();
  });

  describe("setPassword", () => {
    it("should call apiService.send with the correct parameters", async () => {
      // Arrange
      const request = new SetPasswordRequest(
        "masterPasswordHash",
        "key",
        "masterPasswordHint",
        "orgIdentifier",
        {
          publicKey: "publicKey",
          encryptedPrivateKey: "encryptedPrivateKey",
        },
        new PBKDF2KdfConfig(600_000),
      );

      // Act
      await sut.setPassword(request);

      // Assert
      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        "/accounts/set-password",
        request,
        true,
        false,
      );
    });
  });

  describe("postSsoJitProvisionFinishPassword", () => {
    let request: SsoJitProvisionFinishPasswordRequest;

    beforeEach(() => {
      const salt = "salt" as MasterPasswordSalt;
      const kdf = new PBKDF2KdfConfig(600_000);
      request = new SsoJitProvisionFinishPasswordRequest(
        {
          salt,
          kdf,
          masterPasswordAuthenticationHash:
            "masterPasswordAuthenticationHash" as MasterPasswordAuthenticationHash,
        },
        new MasterPasswordUnlockData(
          salt,
          kdf,
          "masterKeyWrappedUserKey" as MasterKeyWrappedUserKey,
        ),
        "masterPasswordHint",
        "orgIdentifier",
        {
          publicKey: "publicKey",
          encryptedPrivateKey: "encryptedPrivateKey",
        },
        false,
      );
    });

    it("should call apiService.send with the correct parameters", async () => {
      // Act
      await sut.postSsoJitProvisionFinishPassword(request);

      // Assert
      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        "/sso-jit-provision-finish/password",
        request,
        true,
        false,
      );
    });

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

    it("should log and rethrow when the request fails", async () => {
      // Arrange
      const error = new Error("request failed");
      apiService.send.mockRejectedValue(error);

      // Act
      const promise = sut.postSsoJitProvisionFinishPassword(request);

      // Assert
      await expect(promise).rejects.toThrow(error);
      expect(logService.error).toHaveBeenCalledWith(error);
    });
  });

  describe("postPassword", () => {
    it("should call apiService.send with the correct parameters", async () => {
      // Arrange
      const salt = "salt" as MasterPasswordSalt;
      const kdf = new PBKDF2KdfConfig(600_000);
      const authenticationData: MasterPasswordAuthenticationData = {
        salt,
        kdf,
        masterPasswordAuthenticationHash:
          "newMasterPasswordAuthenticationHash" as MasterPasswordAuthenticationHash,
      };
      const unlockData = new MasterPasswordUnlockData(
        salt,
        kdf,
        "masterKeyWrappedUserKey" as MasterKeyWrappedUserKey,
      );
      const request = new PasswordRequest(
        "currentMasterPasswordAuthenticationHash" as MasterPasswordAuthenticationHash,
        authenticationData,
        unlockData,
        "masterPasswordHint",
      );

      // Act
      await sut.postPassword(request);

      // Assert
      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        "/accounts/password",
        request,
        true,
        false,
      );
    });
  });

  describe("putUpdateTempPassword", () => {
    it("should call apiService.send with the correct parameters", async () => {
      // Arrange
      const salt = "salt" as MasterPasswordSalt;
      const kdf = new PBKDF2KdfConfig(600_000);

      const authenticationData: MasterPasswordAuthenticationData = {
        salt,
        kdf,
        masterPasswordAuthenticationHash:
          "masterPasswordAuthenticationHash" as MasterPasswordAuthenticationHash,
      };

      const unlockData = new MasterPasswordUnlockData(
        salt,
        kdf,
        "masterKeyWrappedUserKey" as MasterKeyWrappedUserKey,
      );

      const request = new UpdateTempPasswordRequest(
        authenticationData,
        unlockData,
        "masterPasswordHint",
      );

      // Act
      await sut.putUpdateTempPassword(request);

      // Assert
      expect(apiService.send).toHaveBeenCalledWith(
        "PUT",
        "/accounts/update-temp-password",
        request,
        true,
        false,
      );
    });
  });

  describe("putUpdateTdeOffboardingPassword", () => {
    it("should call apiService.send with the correct parameters", async () => {
      // Arrange
      const salt = "salt" as MasterPasswordSalt;
      const kdf = new PBKDF2KdfConfig(600_000);

      const authenticationData: MasterPasswordAuthenticationData = {
        salt,
        kdf,
        masterPasswordAuthenticationHash:
          "masterPasswordAuthenticationHash" as MasterPasswordAuthenticationHash,
      };

      const unlockData = new MasterPasswordUnlockData(
        salt,
        kdf,
        "masterKeyWrappedUserKey" as MasterKeyWrappedUserKey,
      );

      const request = new UpdateTdeOffboardingPasswordRequest(
        authenticationData,
        unlockData,
        "masterPasswordHint",
      );

      // Act
      await sut.putUpdateTdeOffboardingPassword(request);

      // Assert
      expect(apiService.send).toHaveBeenCalledWith(
        "PUT",
        "/accounts/update-tde-offboarding-password",
        request,
        true,
        false,
      );
    });
  });
});
