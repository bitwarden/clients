// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { EmergencyAccessType } from "../enums/emergency-access-type";

export class EmergencyAccessUpdateRequest {
  type: EmergencyAccessType;
  waitTimeDays: number;
  keyEncrypted?: string;
}

export class EmergencyAccessWithIdRequest extends EmergencyAccessUpdateRequest {
  id: string;
}
