// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  OrganizationUserStatusType,
  OrganizationUserType,
} from "@bitwarden/common/admin-console/enums";

import { BaseResponse } from "../../../models/response/base.response";

export class OrganizationUserResponse implements BaseResponse {
  object: string;
  id: string;
  email: string;
  name: string;
  status: OrganizationUserStatusType;
  type: OrganizationUserType;
  twoFactorEnabled: boolean;

  constructor() {
    this.object = "org-member";
  }
}
