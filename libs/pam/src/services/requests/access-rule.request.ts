import { AccessRule } from "../../abstractions/access-rule";

export class AccessRuleRequest {
  name: string;
  description: string | null;
  rule: AccessRule;
  collections: string[];

  constructor(init: {
    name: string;
    description?: string | null;
    rule: AccessRule;
    collections?: string[];
  }) {
    this.name = init.name;
    this.description = init.description ?? null;
    this.rule = init.rule;
    this.collections = init.collections ?? [];
  }
}
