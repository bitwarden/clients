import { mock, MockProxy } from "jest-mock-extended";

import { LogService } from "../../platform/abstractions/log.service";
import { UserId } from "../../types/guid";
import { AccountApiService } from "../abstractions/account-api.service";
import { UserVerificationService } from "../abstractions/user-verification/user-verification.service.abstraction";
import { VerificationType } from "../enums/verification-type";
import { LogoutService } from "../logout";
import { SecretVerificationRequest } from "../models/request/secret-verification.request";
import { Verification } from "../types/verification";

import { DefaultAccountDeletionService } from "./default-account-deletion.service";

describe("DefaultAccountDeletionService", () => {
  const userId = "user-id" as UserId;
  const verification: Verification = {
    type: VerificationType.MasterPassword,
    secret: "master-password",
  };
  const request = new SecretVerificationRequest();

  let accountApiService: MockProxy<AccountApiService>;
  let userVerificationService: MockProxy<UserVerificationService>;
  let logoutService: MockProxy<LogoutService>;
  let logService: MockProxy<LogService>;

  let sut: DefaultAccountDeletionService;

  beforeEach(() => {
    accountApiService = mock<AccountApiService>();
    userVerificationService = mock<UserVerificationService>();
    logoutService = mock<LogoutService>();
    logService = mock<LogService>();

    userVerificationService.buildRequest.mockResolvedValue(request);

    sut = new DefaultAccountDeletionService(
      accountApiService,
      userVerificationService,
      logoutService,
      logService,
    );
  });

  describe("deleteAccount", () => {
    it("builds the verification request and deletes the account for the user", async () => {
      await sut.deleteAccount(userId, verification);

      expect(userVerificationService.buildRequest).toHaveBeenCalledWith(verification);
      expect(accountApiService.deleteAccount).toHaveBeenCalledWith(userId, request);
    });

    it("logs the user out with the accountDeleted reason after the account is deleted", async () => {
      await sut.deleteAccount(userId, verification);

      expect(logoutService.logout).toHaveBeenCalledWith(userId, "accountDeleted");
      expect(accountApiService.deleteAccount.mock.invocationCallOrder[0]).toBeLessThan(
        logoutService.logout.mock.invocationCallOrder[0],
      );
    });

    it("logs the error, rethrows it, and does not log out when the deletion fails", async () => {
      const error = new Error("Invalid master password");
      accountApiService.deleteAccount.mockRejectedValue(error);

      await expect(sut.deleteAccount(userId, verification)).rejects.toBe(error);

      expect(logService.error).toHaveBeenCalledWith(error);
      expect(logoutService.logout).not.toHaveBeenCalled();
    });

    it("logs the error, rethrows it, and does not delete or log out when the verification is invalid", async () => {
      const error = new Error("Invalid verification");
      userVerificationService.buildRequest.mockRejectedValue(error);

      await expect(sut.deleteAccount(userId, verification)).rejects.toBe(error);

      expect(logService.error).toHaveBeenCalledWith(error);
      expect(accountApiService.deleteAccount).not.toHaveBeenCalled();
      expect(logoutService.logout).not.toHaveBeenCalled();
    });
  });
});
