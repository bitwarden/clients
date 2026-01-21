// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { OrganizationUserResetPasswordRequest } from "../../../admin-console/models/request/organization-user/organization-user-reset-password.request";

export class UpdateTdeOffboardingPasswordRequest extends OrganizationUserResetPasswordRequest {
  masterPasswordHint: string;
}
