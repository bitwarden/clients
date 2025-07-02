import { PolicyType } from "../../enums";

export type PolicyRequest = {
  type: PolicyType;
  enabled: boolean;
  data: any;
};
