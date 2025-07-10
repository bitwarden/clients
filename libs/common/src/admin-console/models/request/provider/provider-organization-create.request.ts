import { OrganizationCreateRequest } from "../../../models/request/organization-create.request";

export class ProviderOrganizationCreateRequest {
  constructor(
    public clientOwnerEmail: string,
    public organizationCreateRequest: OrganizationCreateRequest,
  ) {}
}
