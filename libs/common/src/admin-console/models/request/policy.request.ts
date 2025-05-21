// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { PolicyType } from "../../enums";

export class PolicyRequest {
  type: PolicyType;
  enabled: boolean;
  data: any;
}
