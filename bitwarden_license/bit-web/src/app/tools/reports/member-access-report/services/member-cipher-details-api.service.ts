import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";

import { MemberCipherDetailsResponse } from "../response/member-cipher-details.response";

@Injectable({ providedIn: "root" })
export class MemberCipherDetailsApiService {
  constructor(protected apiService: ApiService) {}
  async getMemberCipherDetails(orgId: string): Promise<MemberCipherDetailsResponse[]> {
    const response = await this.apiService.send(
      "GET",
      "/reports/member-cipher-details/" + orgId,
      null,
      true,
      true,
    );
    const responses = response.map((o: any) => new MemberCipherDetailsResponse(o));

    return responses;
  }
}
