import {
  OrganizationUserStatusType,
  OrganizationUserType,
} from "@bitwarden/common/admin-console/enums";

import { BaseResponse } from "../../../models/response/base.response";

export class OrganizationUserResponse implements BaseResponse {
  object: string;
  id: string;
  email: string;
  name: string | undefined;
  status: OrganizationUserStatusType;
  type: OrganizationUserType;
  twoFactorEnabled: boolean;

  constructor(c: {
    id: string;
    email: string;
    name: string | undefined;
    status: OrganizationUserStatusType;
    type: OrganizationUserType;
    twoFactorEnabled: boolean;
  }) {
    this.object = "org-member";
    this.id = c.id;
    this.email = c.email;
    this.name = c.name;
    this.status = c.status;
    this.type = c.type;
    this.twoFactorEnabled = c.twoFactorEnabled;
  }
}
