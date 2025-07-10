import { ProfileOrganizationResponse } from "./profile-organization.response";

export class ProfileProviderOrganizationResponse extends ProfileOrganizationResponse {
  constructor(response: any) {
    super(response);
    this.keyConnectorEnabled = false;
  }
}
