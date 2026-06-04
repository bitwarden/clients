import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";

import { RequestAdminActionRequest } from "../models/requests/request-admin-action.request";

@Injectable({
  providedIn: "root",
})
export class SmLandingApiService {
  constructor(private apiService: ApiService) {}

  async requestSMAccessFromAdmins(request: RequestAdminActionRequest): Promise<void> {
    await this.apiService.send(
      "POST",
      "/request-access/send-request-admin-action-email",
      request,
      true,
      false,
    );
  }
}
