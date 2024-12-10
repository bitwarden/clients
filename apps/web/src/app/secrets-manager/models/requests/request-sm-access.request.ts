// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Guid } from "@bitwarden/common/src/types/guid";

export class RequestSMAccessRequest {
  OrganizationId: Guid;
  EmailContent: string;
}
