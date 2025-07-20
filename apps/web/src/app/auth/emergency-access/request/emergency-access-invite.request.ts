// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { EmergencyAccessType } from "../enums/emergency-access-type";

export class EmergencyAccessInviteRequest {
  email: string;
  type: EmergencyAccessType;
  waitTimeDays: number;
}
