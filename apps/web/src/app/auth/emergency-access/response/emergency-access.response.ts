import { BaseResponse } from "@bitwarden/common/models/response/base.response";

import { EmergencyAccessStatusType } from "../enums/emergency-access-status-type";
import { EmergencyAccessType } from "../enums/emergency-access-type";

export class EmergencyAccessGranteeDetailsResponse extends BaseResponse {
  id: string;
  granteeId: string;
  name: string;
  email: string;
  type: EmergencyAccessType;
  status: EmergencyAccessStatusType;
  waitTimeDays: number;
  creationDate: string;
  avatarColor: string;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.granteeId = this.getResponseProperty("GranteeId");
    this.name = this.getResponseProperty("Name");
    this.email = this.getResponseProperty("Email");
    this.type = this.getResponseProperty("Type");
    this.status = this.getResponseProperty("Status");
    this.waitTimeDays = this.getResponseProperty("WaitTimeDays");
    this.creationDate = this.getResponseProperty("CreationDate");
    this.avatarColor = this.getResponseProperty("AvatarColor");
  }
}
