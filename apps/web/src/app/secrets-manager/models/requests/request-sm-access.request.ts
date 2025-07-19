// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { OrganizationId } from "@bitwarden/common/types/guid";

export class RequestSMAccessRequest {
  OrganizationId: OrganizationId;
  EmailContent: string;
}
