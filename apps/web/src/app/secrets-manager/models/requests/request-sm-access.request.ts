import { Guid } from "@bitwarden/common/src/types/guid";

export class RequestSMAccessRequest {
  OrganizationId: Guid;
  EmailContent: string;
}
