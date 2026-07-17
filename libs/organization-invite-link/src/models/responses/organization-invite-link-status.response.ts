import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export class OrganizationInviteLinkSsoResponseModel extends BaseResponse {
  orgSsoId: string;
  required: boolean;

  constructor(response: any) {
    super(response);
    this.orgSsoId = this.getResponseProperty("OrgSsoId");
    this.required = this.getResponseProperty("Required");
  }
}

export class OrganizationInviteLinkStatusResponseModel extends BaseResponse {
  organizationName: string;
  linksEnabled: boolean;
  seatsAvailable: boolean;
  sso: OrganizationInviteLinkSsoResponseModel | null;

  constructor(response: any) {
    super(response);
    this.organizationName = this.getResponseProperty("OrganizationName");
    this.linksEnabled = this.getResponseProperty("LinksEnabled");
    this.seatsAvailable = this.getResponseProperty("SeatsAvailable");
    const sso = this.getResponseProperty("Sso");
    this.sso = sso == null ? null : new OrganizationInviteLinkSsoResponseModel(sso);
  }
}
