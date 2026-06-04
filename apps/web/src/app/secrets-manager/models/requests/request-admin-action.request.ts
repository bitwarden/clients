// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { OrganizationId } from "@bitwarden/common/types/guid";

export class RequestAdminActionRequest {
  OrganizationId: OrganizationId;
  EmailContent: string;
  EmailTemplateName: string;
}
