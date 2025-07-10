import { BaseResponse } from "@bitwarden/common/models/response/base.response";
import { CipherId, OrganizationId, SecurityTaskId } from "@bitwarden/common/types/guid";

import { SecurityTaskStatus, SecurityTaskType } from "../enums";

export class SecurityTaskResponse extends BaseResponse {
  id: SecurityTaskId;
  organizationId: OrganizationId;
  /**
   * Optional cipherId for tasks that are related to a cipher.
   */
  cipherId: CipherId | undefined;
  type: SecurityTaskType;
  status: SecurityTaskStatus;
  creationDate: Date;
  revisionDate: Date;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.organizationId = this.getResponseProperty("OrganizationId");
    this.cipherId = this.getResponseProperty("CipherId") || undefined;
    this.type = this.getResponseProperty("Type");
    this.status = this.getResponseProperty("Status");
    this.creationDate = this.getResponseProperty("CreationDate");
    this.revisionDate = this.getResponseProperty("RevisionDate");
  }
}
