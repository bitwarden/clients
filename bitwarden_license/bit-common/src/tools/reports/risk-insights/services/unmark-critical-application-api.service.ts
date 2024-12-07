import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";

@Injectable()
export class UnmarkCriticalApplicationApiService {
  constructor(private apiService: ApiService) {}

  /**
   * Unmark a critical application for organization
   * @param orgId OrganizationId to get member cipher details for
   * @returns void
   */
  async unmarkCriticalApplication(orgId: string, hostname: string): Promise<void> {
    // TODO - Properly implement this method once the API is ready
    // const response = await this.apiService.send(
    //   "GET",
    //   "/organizations/" + orgId + "/unmark-as-critical-application",
    //   null,
    //   true,
    //   true,
    // );
    // return response;
  }
}
