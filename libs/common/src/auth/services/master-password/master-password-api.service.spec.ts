import { mock, MockProxy } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KdfType } from "@bitwarden/key-management";

import { PasswordRequest } from "../../models/request/password.request";
import { SetPasswordRequest } from "../../models/request/set-password.request";
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
        KdfType.PBKDF2_SHA256,
        600_000,
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

  describe("postPassword", () => {
    it("should call apiService.send with the correct parameters", async () => {
      // Arrange
      const request = {
        newMasterPasswordHash: "newMasterPasswordHash",
        masterPasswordHint: "masterPasswordHint",
        key: "key",
        masterPasswordHash: "masterPasswordHash",
      } as PasswordRequest;

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
      const request = {
        masterPasswordHint: "masterPasswordHint",
        newMasterPasswordHash: "newMasterPasswordHash",
        key: "key",
      } as UpdateTempPasswordRequest;

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
      const request = {
        masterPasswordHint: "masterPasswordHint",
        newMasterPasswordHash: "newMasterPasswordHash",
        key: "key",
      } as UpdateTdeOffboardingPasswordRequest;

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
