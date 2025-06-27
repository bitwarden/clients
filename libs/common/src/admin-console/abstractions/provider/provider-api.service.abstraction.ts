// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { AddableOrganizationResponse } from "@bitwarden/common/admin-console/models/response/addable-organization.response";

import { ProviderSetupRequest } from "../../models/request/provider/provider-setup.request";
import { ProviderUpdateRequest } from "../../models/request/provider/provider-update.request";
import { ProviderVerifyRecoverDeleteRequest } from "../../models/request/provider/provider-verify-recover-delete.request";
import { ProviderResponse } from "../../models/response/provider/provider.response";

export class ProviderApiServiceAbstraction {
  postProviderSetup: (id: string, request: ProviderSetupRequest) => Promise<ProviderResponse>;
  getProvider: (id: string) => Promise<ProviderResponse>;
  putProvider: (id: string, request: ProviderUpdateRequest) => Promise<ProviderResponse>;
  providerRecoverDeleteToken: (
    organizationId: string,
    request: ProviderVerifyRecoverDeleteRequest,
  ) => Promise<any>;
  deleteProvider: (id: string) => Promise<void>;
  getProviderAddableOrganizations: (providerId: string) => Promise<AddableOrganizationResponse[]>;
  addOrganizationToProvider: (
    providerId: string,
    request: {
      key: string;
      organizationId: string;
    },
  ) => Promise<void>;
}
