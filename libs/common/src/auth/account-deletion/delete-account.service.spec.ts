import { MockProxy, mock } from "jest-mock-extended";

import { ApiService } from "../../abstractions/api.service";
import { UserId } from "../../types/guid";
import { LogoutService } from "../logout";
import { SecretVerificationRequest } from "../models/request/secret-verification.request";

import { DeleteAccountService } from "./delete-account.service";

describe("DeleteAccountService", () => {
  let apiService: MockProxy<ApiService>;
  let logoutService: MockProxy<LogoutService>;
  let sut: DeleteAccountService;

  beforeEach(() => {
    apiService = mock<ApiService>();
    logoutService = mock<LogoutService>();
    sut = new DeleteAccountService(apiService, logoutService);
  });

  describe("delete", () => {
    it("sends DELETE /accounts with the verification request and logs the user out", async () => {
      const userId = "1" as UserId;
      const verificationRequest = new SecretVerificationRequest();

      await sut.delete(verificationRequest, userId);

      expect(apiService.send).toHaveBeenCalledWith(
        "DELETE",
        "/accounts",
        verificationRequest,
        true,
        false,
      );
      expect(logoutService.logout).toHaveBeenCalledWith(userId, "accountDeleted");
    });

    it("does not log the user out if the DELETE request throws", async () => {
      const userId = "1" as UserId;
      const verificationRequest = new SecretVerificationRequest();
      apiService.send.mockRejectedValue(new Error("boom"));

      await expect(sut.delete(verificationRequest, userId)).rejects.toThrow("boom");

      expect(logoutService.logout).not.toHaveBeenCalled();
    });
  });
});
