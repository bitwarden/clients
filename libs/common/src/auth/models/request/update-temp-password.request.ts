// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { OrganizationUserResetPasswordRequest } from "@bitwarden/admin-console/common";

export class UpdateTempPasswordRequest extends OrganizationUserResetPasswordRequest {
  masterPasswordHint: string;
}
