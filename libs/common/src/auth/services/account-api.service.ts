import { firstValueFrom } from "rxjs";

import { ApiService } from "../../abstractions/api.service";
import { ErrorResponse } from "../../models/response/error.response";
import { EnvironmentService } from "../../platform/abstractions/environment.service";
import { LogService } from "../../platform/abstractions/log.service";
import { AccountApiService } from "../abstractions/account-api.service";
import { InternalAccountService } from "../abstractions/account.service";
import { UserVerificationService } from "../abstractions/user-verification/user-verification.service.abstraction";
import { RegisterFinishRequest } from "../models/request/registration/register-finish.request";
import { RegisterSendVerificationEmailRequest } from "../models/request/registration/register-send-verification-email.request";
import { Verification } from "../types/verification";

export class AccountApiServiceImplementation implements AccountApiService {
  constructor(
    private apiService: ApiService,
    private userVerificationService: UserVerificationService,
    private logService: LogService,
    private accountService: InternalAccountService,
    private environmentService: EnvironmentService,
  ) {}

  async deleteAccount(verification: Verification): Promise<void> {
    try {
      const verificationRequest = await this.userVerificationService.buildRequest(verification);
      await this.apiService.send("DELETE", "/accounts", verificationRequest, true, false);
      this.accountService.delete();
    } catch (e) {
      this.logService.error(e);
      throw e;
    }
  }

  async registerSendVerificationEmail(
    request: RegisterSendVerificationEmailRequest,
  ): Promise<null | string> {
    const env = await firstValueFrom(this.environmentService.environment$);

    try {
      const response = await this.apiService.send(
        "POST",
        "/accounts/register/send-verification-email",
        request,
        false,
        true,
        env.getIdentityUrl(),
      );

      return response;
    } catch (e: unknown) {
      if (e instanceof ErrorResponse) {
        if (e.statusCode === 204) {
          // No content is a success response.
          return null;
        }
      }

      this.logService.error(e);
      throw e;
    }
  }

  async registerFinish(request: RegisterFinishRequest): Promise<string> {
    const env = await firstValueFrom(this.environmentService.environment$);

    try {
      const response = await this.apiService.send(
        "POST",
        "/accounts/register/finish",
        request,
        false,
        true,
        env.getIdentityUrl(),
      );

      return response;
    } catch (e: unknown) {
      this.logService.error(e);
      throw e;
    }
  }
}
