import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";

import { RequestSMAccessRequest } from "../models/requests/request-sm-access.request";

@Injectable({
  providedIn: "root",
})
export class SmLandingApiService {
  constructor(private apiService: ApiService) {}

  async requestSMAccessFromAdmins(request: RequestSMAccessRequest): Promise<void> {
    await this.apiService.send("POST", "/request-access/request-sm-access", request, true, false);
  }
}
