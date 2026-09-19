import { firstValueFrom } from "rxjs";

import { ApiService } from "../../abstractions/api.service";
import { ErrorResponse } from "../../models/response/error.response";
import { EnvironmentService } from "../../platform/abstractions/environment.service";
import { LogService } from "../../platform/abstractions/log.service";
import { AccountApiService } from "../abstractions/account-api.service";
import { RegisterFinishRequest } from "../models/request/registration/register-finish.request";
import { RegisterSendVerificationEmailRequest } from "../models/request/registration/register-send-verification-email.request";
import { RegisterVerificationEmailClickedRequest } from "../models/request/registration/register-verification-email-clicked.request";
import { SetVerifyDevicesRequest } from "../models/request/set-verify-devices.request";

export class AccountApiServiceImplementation implements AccountApiService {
  constructor(
    private apiService: ApiService,
    private logService: LogService,
    private environmentService: EnvironmentService,
  ) {}

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

  async registerVerificationEmailClicked(
    request: RegisterVerificationEmailClickedRequest,
  ): Promise<void> {
    const env = await firstValueFrom(this.environmentService.environment$);

    try {
      const response = await this.apiService.send(
        "POST",
        "/accounts/register/verification-email-clicked",
        request,
        false,
        false,
        env.getIdentityUrl(),
      );

      return response;
    } catch (e: unknown) {
      this.logService.error(e);
      throw e;
    }
  }

  async registerFinish(request: RegisterFinishRequest): Promise<void> {
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

  async setVerifyDevices(request: SetVerifyDevicesRequest): Promise<string> {
    try {
      const response = await this.apiService.send(
        "POST",
        "/accounts/verify-devices",
        request,
        true,
        true,
      );

      return response;
    } catch (e: unknown) {
      this.logService.error(e);
      throw e;
    }
  }
}
