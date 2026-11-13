import { BaseResponse } from "@bitwarden/cli/models/response/base.response";
import { EventResponse, EventType } from "@bitwarden/common/dirt/event-logs";
import { DeviceType } from "@bitwarden/common/enums";

export class SmEventResponse implements BaseResponse {
  object = "sm-event";

  type: EventType;
  typeName: string;
  date: string;
  actingUserId: string;
  machineAccountId: string;
  grantedMachineAccountId: string;
  secretId: string;
  projectId: string;
  deviceType: DeviceType;
  ipAddress: string;

  constructor(event: EventResponse) {
    this.type = event.type;
    this.typeName = EventType[event.type];
    this.date = event.date;
    this.actingUserId = event.actingUserId;
    this.machineAccountId = event.serviceAccountId;
    this.grantedMachineAccountId = event.grantedServiceAccountId;
    this.secretId = event.secretId;
    this.projectId = event.projectId;
    this.deviceType = event.deviceType;
    this.ipAddress = event.ipAddress;
  }
}
