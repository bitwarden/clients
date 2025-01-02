import { Jsonify } from "type-fest";

import { CipherId, OrganizationId, SecurityTaskId } from "@bitwarden/common/types/guid";

import { SecurityTaskStatus, SecurityTaskType } from "../enums";

import { SecurityTaskResponse } from "./security-task.response";

export class SecurityTaskData {
  id: SecurityTaskId;
  organizationId: OrganizationId;
  cipherId: CipherId | undefined;
  type: SecurityTaskType;
  status: SecurityTaskStatus;
  creationDate: Date;
  revisionDate: Date;

  constructor(response: SecurityTaskResponse) {
    this.id = response.id;
    this.organizationId = response.organizationId;
    this.cipherId = response.cipherId;
    this.type = response.type;
    this.status = response.status;
    this.creationDate = response.creationDate;
    this.revisionDate = response.revisionDate;
  }

  static fromJSON(obj: Jsonify<SecurityTaskData>) {
    return Object.assign(new SecurityTaskData({} as SecurityTaskResponse), obj, {
      creationDate: new Date(obj.creationDate),
      revisionDate: new Date(obj.revisionDate),
    });
  }
}
