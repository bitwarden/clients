import { Injectable, inject } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { BaseResponse } from "@bitwarden/common/models/response/base.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { CipherType } from "@bitwarden/common/vault/enums";

export class OrganizationCipherTypeCountResponse extends BaseResponse {
  type: CipherType;
  count: number;

  constructor(response: any) {
    super(response);
    this.type = this.getResponseProperty("Type");
    this.count = this.getResponseProperty("Count");
  }
}

@Injectable({ providedIn: "root" })
export class OrganizationCipherTypeCountsApiService {
  private readonly apiService = inject(ApiService);

  /**
   * Gets the number of organization-owned items for each cipher type, including archived/trashed items.
   */
  async getCounts(organizationId: string): Promise<Partial<Record<CipherType, number>>> {
    const r = await this.apiService.send(
      "GET",
      "/ciphers/organization-details/type-counts?organizationId=" + organizationId,
      null,
      true,
      true,
    );

    const counts: Partial<Record<CipherType, number>> = {};
    for (const { type, count } of new ListResponse(r, OrganizationCipherTypeCountResponse).data) {
      counts[type] = count;
    }
    return counts;
  }
}
