import { LeasingPolicy } from "../../abstractions/leasing-policy";

export class LeasingPolicyRequest {
  name: string;
  description: string | null;
  policy: LeasingPolicy;

  constructor(init: { name: string; description?: string | null; policy: LeasingPolicy }) {
    this.name = init.name;
    this.description = init.description ?? null;
    this.policy = init.policy;
  }
}
