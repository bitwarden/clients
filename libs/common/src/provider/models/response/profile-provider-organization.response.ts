import { ProfileOrganizationResponse } from "../../../admin-console/models/response/profile-organization.response";

export class ProfileProviderOrganizationResponse extends ProfileOrganizationResponse {
  constructor(response: any) {
    super(response);
    this.keyConnectorEnabled = false;
  }
}
