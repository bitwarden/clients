import { AddableOrganizationResponse } from "@bitwarden/common/admin-console/models/response/addable-organization.response";
import { ProviderOrganizationOrganizationDetailsResponse } from "@bitwarden/common/admin-console/models/response/provider/provider-organization.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";

import { CreateProviderOrganizationRequest } from "../../models/request/create-provider-organization.request";
import { ProviderSetupRequest } from "../../models/request/provider/provider-setup.request";
import { ProviderUpdateRequest } from "../../models/request/provider/provider-update.request";
import { ProviderVerifyRecoverDeleteRequest } from "../../models/request/provider/provider-verify-recover-delete.request";
import { UpdateProviderOrganizationRequest } from "../../models/request/update-provider-organization.request";
import { ProviderResponse } from "../../models/response/provider/provider.response";

export abstract class ProviderApiServiceAbstraction {
  abstract postProviderSetup(id: string, request: ProviderSetupRequest): Promise<ProviderResponse>;
  abstract getProvider(id: string): Promise<ProviderResponse>;
  abstract putProvider(id: string, request: ProviderUpdateRequest): Promise<ProviderResponse>;
  abstract providerRecoverDeleteToken(
    organizationId: string,
    request: ProviderVerifyRecoverDeleteRequest,
  ): Promise<any>;
  abstract deleteProvider(id: string): Promise<void>;
  abstract getProviderOrganizations(
    providerId: string,
  ): Promise<ListResponse<ProviderOrganizationOrganizationDetailsResponse>>;
  abstract getProviderAddableOrganizations(
    providerId: string,
  ): Promise<AddableOrganizationResponse[]>;
  abstract addOrganizationToProvider(
    providerId: string,
    request: {
      key: string;
      organizationId: string;
    },
  ): Promise<void>;

  abstract updateProviderOrganization(
    providerId: string,
    organizationId: string,
    request: UpdateProviderOrganizationRequest,
  ): Promise<any>;

  abstract createProviderOrganization(
    providerId: string,
    request: CreateProviderOrganizationRequest,
  ): Promise<void>;
}
