import { OrganizationCreateRequest } from "../../../admin-console/models/request/organization-create.request";

export class ProviderOrganizationCreateRequest {
  constructor(
    public clientOwnerEmail: string,
    public organizationCreateRequest: OrganizationCreateRequest,
  ) {}
}
