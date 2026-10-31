import { LogService } from "../../platform/abstractions/log.service";
import { UserId } from "../../types/guid";
import { AccountApiService } from "../abstractions/account-api.service";
import { UserVerificationService } from "../abstractions/user-verification/user-verification.service.abstraction";
import { LogoutService } from "../logout";
import { Verification } from "../types/verification";

import { AccountDeletionService } from "./account-deletion.service";

export class DefaultAccountDeletionService implements AccountDeletionService {
  constructor(
    private accountApiService: AccountApiService,
    private userVerificationService: UserVerificationService,
    private logoutService: LogoutService,
    private logService: LogService,
  ) {}

  async deleteAccount(userId: UserId, verification: Verification): Promise<void> {
    try {
      const request = await this.userVerificationService.buildRequest(verification);
      await this.accountApiService.deleteAccount(userId, request);
    } catch (e) {
      this.logService.error(e);
      throw e;
    }

    await this.logoutService.logout(userId, "accountDeleted");
  }
}
