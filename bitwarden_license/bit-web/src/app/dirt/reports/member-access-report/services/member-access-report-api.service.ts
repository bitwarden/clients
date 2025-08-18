import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";

import { MemberAccessResponse } from "../response/member-access-report.response";

@Injectable({ providedIn: "root" })
export class MemberAccessReportApiService {
  constructor(protected apiService: ApiService) {}
  async getMemberAccessData(orgId: string): Promise<MemberAccessResponse[]> {
    const response = await this.apiService.send(
      "GET",
      "/reports/member-access/" + orgId,
      null,
      true,
      true,
    );
    const memberAccessResponses = response.map((o: any) => new MemberAccessResponse(o));

    return memberAccessResponses;
  }
}
