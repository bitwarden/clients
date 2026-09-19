import { ApiService } from "../../abstractions/api.service";
import { UserId } from "../../types/guid";
import { LogoutService } from "../logout";
import { SecretVerificationRequest } from "../models/request/secret-verification.request";

/**
 * Orchestrates the account-deletion flow: hits the DELETE /accounts endpoint with a
 * server-verified secret and then logs the user out. Callers are responsible for building
 * the verification request via UserVerificationService.buildRequest before calling delete.
 *
 * Lives outside AccountService because ApiService already depends on AccountService, and
 * folding delete into AccountService would create a construction-time DI cycle.
 */
export class DeleteAccountService {
  constructor(
    private apiService: ApiService,
    private logoutService: LogoutService,
  ) {}

  async delete(verificationRequest: SecretVerificationRequest, userId: UserId): Promise<void> {
    await this.apiService.send("DELETE", "/accounts", verificationRequest, true, false);
    await this.logoutService.logout(userId, "accountDeleted");
  }
}
