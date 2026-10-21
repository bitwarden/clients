import { PotentialGranteeView } from "@bitwarden/bit-common/secrets-manager/models/view/access-policies/potential-grantee.view";
import { BaseResponse } from "@bitwarden/cli/models/response/base.response";

export type SmGranteeType = "user" | "group" | "machineAccount" | "project";

/**
 * Maps the API's grantee type to the CLI's user-facing name.
 */
export function toSmGranteeType(apiType: string): SmGranteeType {
  return apiType === "serviceAccount" ? "machineAccount" : (apiType as SmGranteeType);
}

export class SmGranteeResponse implements BaseResponse {
  object = "sm-grantee";

  id: string;
  type: SmGranteeType;
  name: string;
  email: string;
  currentUser: boolean;
  currentUserInGroup: boolean;

  constructor(grantee: PotentialGranteeView) {
    this.id = grantee.id;
    this.type = toSmGranteeType(grantee.type);
    this.name = grantee.name;
    this.email = grantee.email;
    this.currentUser = grantee.currentUser;
    this.currentUserInGroup = grantee.currentUserInGroup;
  }
}
