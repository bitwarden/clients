import { AccessRule, Condition } from "../../abstractions/access-rule";

export class AccessRuleRequest {
  name: string;
  description: string | null;
  /** Access conditions, ANDed together. Empty array = no access checks (lease settings still apply). */
  conditions: Condition[];
  /**
   * Server-required AccessRule tree. Derived from {@link conditions} so the UI
   * doesn't need to maintain both shapes: each condition maps to a leaf rule,
   * multiple conditions are wrapped in an `all_of`, and zero conditions
   * collapse to an empty `all_of` (a no-op gate, which the server accepts).
   */
  rule: AccessRule;
  collections: string[];
  /** Default lease duration in seconds. Null = backend default. */
  defaultLeaseDurationSeconds: number | null;
  /**
   * Hard ceiling on the total duration of any single lease granted under this
   * rule, in seconds. The lease window is clamped to at most this long at start,
   * regardless of what the requester asked for. Null = no cap.
   */
  maxLeaseDurationSeconds: number | null;
  /** When true, only one active lease may exist for this rule at a time across all users. */
  singleActiveLease: boolean;
  /** When false, the rule is inactive and does not restrict access. */
  enabled: boolean;

  constructor(init: {
    name: string;
    description?: string | null;
    conditions: Condition[];
    collections?: string[];
    defaultLeaseDurationSeconds?: number | null;
    maxLeaseDurationSeconds?: number | null;
    singleActiveLease?: boolean;
    enabled?: boolean;
  }) {
    this.name = init.name;
    this.description = init.description ?? null;
    this.conditions = init.conditions;
    this.rule = conditionsToRule(init.conditions);
    this.collections = init.collections ?? [];
    this.defaultLeaseDurationSeconds = init.defaultLeaseDurationSeconds ?? null;
    this.maxLeaseDurationSeconds = init.maxLeaseDurationSeconds ?? null;
    this.singleActiveLease = init.singleActiveLease ?? false;
    this.enabled = init.enabled ?? true;
  }
}

function conditionToRule(condition: Condition): AccessRule {
  switch (condition.kind) {
    case "human_approval":
      return { kind: "human_approval" };
    case "ip_allowlist":
      return { kind: "ip_allowlist", cidrs: condition.cidrs };
  }
}

function conditionsToRule(conditions: Condition[]): AccessRule {
  if (conditions.length === 1) {
    return conditionToRule(conditions[0]);
  }
  return { kind: "all_of", rules: conditions.map(conditionToRule) };
}
