import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { MasterPasswordApiService as MasterPasswordApiServiceAbstraction } from "../../abstractions/master-password-api.service.abstraction";
import { PasswordRequest } from "../../models/request/password.request";
import { SetPasswordRequest } from "../../models/request/set-password.request";
import { UpdateTdeOffboardingPasswordRequest } from "../../models/request/update-tde-offboarding-password.request";
import { UpdateTempPasswordRequest } from "../../models/request/update-temp-password.request";

export class MasterPasswordApiService implements MasterPasswordApiServiceAbstraction {
  constructor(
    private apiService: ApiService,
    private logService: LogService,
  ) {}

  async setPassword(request: SetPasswordRequest): Promise<any> {
    try {
      const response = await this.apiService.send(
        "POST",
        "/accounts/set-password",
        request,
        true,
        false,
      );

      return response;
    } catch (e: unknown) {
      this.logService.error(e);
      throw e;
    }
  }

  async postPassword(request: PasswordRequest): Promise<any> {
    try {
      const response = await this.apiService.send(
        "POST",
        "/accounts/password",
        request,
        true,
        false,
      );

      return response;
    } catch (e: unknown) {
      this.logService.error(e);
      throw e;
    }
  }

  async putUpdateTempPassword(request: UpdateTempPasswordRequest): Promise<any> {
    try {
      const response = await this.apiService.send(
        "PUT",
        "/accounts/update-temp-password",
        request,
        true,
        false,
      );

      return response;
    } catch (e: unknown) {
      this.logService.error(e);
      throw e;
    }
  }

  async putUpdateTdeOffboardingPassword(
    request: UpdateTdeOffboardingPasswordRequest,
  ): Promise<any> {
    try {
      const response = await this.apiService.send(
        "PUT",
        "/accounts/update-tde-offboarding-password",
        request,
        true,
        false,
      );

      return response;
    } catch (e: unknown) {
      this.logService.error(e);
      throw e;
    }
  }
}
