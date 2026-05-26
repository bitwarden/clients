import { AccessRule } from "../../abstractions/access-rule";

export class AccessRuleRequest {
  name: string;
  description: string | null;
  rule: AccessRule;

  constructor(init: { name: string; description?: string | null; rule: AccessRule }) {
    this.name = init.name;
    this.description = init.description ?? null;
    this.rule = init.rule;
  }
}
