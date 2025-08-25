import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuthRequest } from "@bitwarden/common/auth/models/request/auth.request";
import { AuthRequestResponse } from "@bitwarden/common/auth/models/response/auth-request.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { AuthRequestApiServiceAbstraction } from "../../abstractions/auth-request-api.service";

export class DefaultAuthRequestApiService implements AuthRequestApiServiceAbstraction {
  constructor(
    private apiService: ApiService,
    private logService: LogService,
  ) {}

  async getPendingAuthRequests(): Promise<ListResponse<AuthRequestResponse>> {
    const path = `/auth-requests/pending`;
    const r = await this.apiService.send("GET", path, null, true, true);
    return new ListResponse(r, AuthRequestResponse);
  }

  async getAuthRequest(requestId: string): Promise<AuthRequestResponse> {
    try {
      const path = `/auth-requests/${requestId}`;
      const response = await this.apiService.send("GET", path, null, true, true);

      return new AuthRequestResponse(response);
    } catch (e: unknown) {
      this.logService.error(e);
      throw e;
    }
  }

  async getAuthResponse(requestId: string, accessCode: string): Promise<AuthRequestResponse> {
    try {
      const path = `/auth-requests/${requestId}/response?code=${accessCode}`;
      const response = await this.apiService.send("GET", path, null, false, true);

      return new AuthRequestResponse(response);
    } catch (e: unknown) {
      this.logService.error(e);
      throw e;
    }
  }

  async postAdminAuthRequest(request: AuthRequest): Promise<AuthRequestResponse> {
    try {
      const response = await this.apiService.send(
        "POST",
        "/auth-requests/admin-request",
        request,
        true,
        true,
      );

      return new AuthRequestResponse(response);
    } catch (e: unknown) {
      this.logService.error(e);
      throw e;
    }
  }

  async postAuthRequest(request: AuthRequest): Promise<AuthRequestResponse> {
    try {
      // Submit the current device identifier in the header as well as in the POST body.
      // The value in the header will be used to build the request context and ensure that the resulting
      // server notifications have the current device as a source.
      const response = await this.apiService.send(
        "POST",
        "/auth-requests/",
        request,
        false,
        true,
        null,
        (headers) => {
          headers.set("Device-Identifier", request.deviceIdentifier);
        },
      );

      return new AuthRequestResponse(response);
    } catch (e: unknown) {
      this.logService.error(e);
      throw e;
    }
  }
}
