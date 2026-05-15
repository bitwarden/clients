import { LeasingPolicy } from "../../abstractions/leasing-policy";

export class CollectionLeasingRequest {
  leasingEnabled: boolean;
  policy: LeasingPolicy | null;

  constructor(init: { leasingEnabled: boolean; policy: LeasingPolicy | null }) {
    this.leasingEnabled = init.leasingEnabled;
    this.policy = init.policy;
  }
}
