import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { SecurityTaskType } from "@bitwarden/vault";

export class NotificationView {
  id: any;
  userId: UserId;
  organizationId: OrganizationId;
  securityTask: SecurityTaskType;

  constructor(obj: any) {
    this.id = obj.id;
    this.userId = obj.userId;
    this.organizationId = obj.organizationId;
    this.securityTask = obj.securityTask;
  }
}
