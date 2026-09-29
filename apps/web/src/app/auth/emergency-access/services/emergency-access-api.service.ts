import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ListResponse } from "@bitwarden/common/models/response/list.response";

import { EmergencyAccessGranteeDetailsResponse } from "../response/emergency-access.response";

@Injectable()
export class EmergencyAccessApiService {
  constructor(private apiService: ApiService) {}

  async getEmergencyAccessTrusted(): Promise<ListResponse<EmergencyAccessGranteeDetailsResponse>> {
    const r = await this.apiService.send("GET", "/emergency-access/trusted", null, true, true);
    return new ListResponse(r, EmergencyAccessGranteeDetailsResponse);
  }
}
