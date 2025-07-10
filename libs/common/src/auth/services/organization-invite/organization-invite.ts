import { Jsonify } from "type-fest";

export class OrganizationInvite {
  email?: string;
  initOrganization?: boolean;
  orgSsoIdentifier?: string;
  orgUserHasExistingUser?: boolean;
  organizationId?: string;
  organizationName?: string;
  organizationUserId?: string;
  token?: string;

  static fromJSON(json: Jsonify<OrganizationInvite>): OrganizationInvite | null {
    if (json == null) {
      return null;
    }

    return Object.assign(new OrganizationInvite(), json);
  }
}
