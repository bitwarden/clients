import { OrganizationUserResetPasswordRequest } from "../../../admin-console/abstractions/organization-user/requests";

export class UpdateTdeOffboardingPasswordRequest extends OrganizationUserResetPasswordRequest {
  masterPasswordHint: string;
}
