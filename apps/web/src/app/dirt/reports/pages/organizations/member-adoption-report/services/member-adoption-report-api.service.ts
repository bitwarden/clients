import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationId } from "@bitwarden/common/types/guid";

import { MemberAdoptionReportResponse } from "../response/member-adoption-report.response";

@Injectable({ providedIn: "root" })
export class MemberAdoptionReportApiService {
  constructor(private apiService: ApiService) {}

  async getMemberAdoptionData(
    organizationId: OrganizationId,
  ): Promise<MemberAdoptionReportResponse> {
    const response = await this.apiService.send(
      "GET",
      "/reports/member-adoption/" + organizationId,
      null,
      true,
      true,
    );

    return new MemberAdoptionReportResponse(response);
  }
}
