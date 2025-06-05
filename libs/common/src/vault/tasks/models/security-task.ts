import { CipherId, OrganizationId, SecurityTaskId } from "@bitwarden/common/types/guid";

import { SecurityTaskStatus, SecurityTaskType } from "../enums";

import { SecurityTaskData } from "./security-task.data";

export class SecurityTask {
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

  constructor(obj: SecurityTaskData) {
    this.id = obj.id;
    this.organizationId = obj.organizationId;
    this.cipherId = obj.cipherId;
    this.type = obj.type;
    this.status = obj.status;
    this.creationDate = obj.creationDate;
    this.revisionDate = obj.revisionDate;
  }
}
