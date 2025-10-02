import { AddableOrganizationResponse } from "@bitwarden/common/admin-console/models/response/addable-organization.response";
import { ProviderOrganizationOrganizationDetailsResponse } from "@bitwarden/common/admin-console/models/response/provider/provider-organization.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";

import { ApiService } from "../../../abstractions/api.service";
import { ProviderApiServiceAbstraction } from "../../abstractions/provider/provider-api.service.abstraction";
import { ProviderSetupRequest } from "../../models/request/provider/provider-setup.request";
import { ProviderUpdateRequest } from "../../models/request/provider/provider-update.request";
import { ProviderVerifyRecoverDeleteRequest } from "../../models/request/provider/provider-verify-recover-delete.request";
import { UpdateProviderOrganizationRequest } from "../../models/request/update-provider-organization.request";
import { ProviderResponse } from "../../models/response/provider/provider.response";


export class ProviderApiService implements ProviderApiServiceAbstraction {
  constructor(private apiService: ApiService) {}
  async postProviderSetup(id: string, request: ProviderSetupRequest) {
    const r = await this.apiService.send(
      "POST",
      "/providers/" + id + "/setup",
      request,
      true,
      true,
    );
    return new ProviderResponse(r);
  }

  async getProvider(id: string) {
    const r = await this.apiService.send("GET", "/providers/" + id, null, true, true);
    return new ProviderResponse(r);
  }

  async putProvider(id: string, request: ProviderUpdateRequest) {
    const r = await this.apiService.send("PUT", "/providers/" + id, request, true, true);
    return new ProviderResponse(r);
  }

  providerRecoverDeleteToken(
    providerId: string,
    request: ProviderVerifyRecoverDeleteRequest,
  ): Promise<any> {
    return this.apiService.send(
      "POST",
      "/providers/" + providerId + "/delete-recover-token",
      request,
      false,
      false,
    );
  }

  async deleteProvider(id: string): Promise<void> {
    await this.apiService.send("DELETE", "/providers/" + id, null, true, false);
  }

  async getProviderOrganizations(
    providerId: string,
  ): Promise<ListResponse<ProviderOrganizationOrganizationDetailsResponse>> {
    const response = await this.apiService.send(
      "GET",
      "/providers/" + providerId + "/organizations",
      null,
      true,
      true,
    );
    return new ListResponse(response, ProviderOrganizationOrganizationDetailsResponse);
  }

  async getProviderAddableOrganizations(
    providerId: string,
  ): Promise<AddableOrganizationResponse[]> {
    const response = await this.apiService.send(
      "GET",
      "/providers/" + providerId + "/clients/addable",
      null,
      true,
      true,
    );

    return response.map((data: any) => new AddableOrganizationResponse(data));
  }

  addOrganizationToProvider(
    providerId: string,
    request: {
      key: string;
      organizationId: string;
    },
  ): Promise<void> {
    return this.apiService.send(
      "POST",
      "/providers/" + providerId + "/clients/existing",
      request,
      true,
      false,
    );
  }

  async updateProviderOrganization(
    providerId: string,
    organizationId: string,
    request: UpdateProviderOrganizationRequest,
  ): Promise<any> {
    return await this.apiService.send(
      "PUT",
      "/providers/" + providerId + "/clients/" + organizationId,
      request,
      true,
      false,
    );
  }
}
