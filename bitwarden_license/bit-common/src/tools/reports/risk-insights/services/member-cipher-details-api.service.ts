import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";

import { MemberCipherDetailsResponse } from "../response/member-cipher-details.response";

@Injectable()
export class MemberCipherDetailsApiService {
  constructor(private apiService: ApiService) {}

  /**
   * Returns a list of organization members with their assigned
   * cipherIds
   * @param orgId OrganizationId to get member cipher details for
   * @returns List of organization members and assigned cipherIds
   */
  async getMemberCipherDetails(orgId: string): Promise<MemberCipherDetailsResponse[]> {
    const response = await this.apiService.send(
      "GET",
      "/reports/member-cipher-details/" + orgId,
      null,
      true,
      true,
    );

    return response;
  }
}
