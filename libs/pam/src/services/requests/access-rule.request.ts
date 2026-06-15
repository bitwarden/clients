import { AccessCondition } from "../../abstractions/access-rule";
import { AccessRuleResponse } from "../../abstractions/responses/access-rule.response";

export class AccessRuleRequest {
  name: string;
  description: string | null;
  /**
   * Server-required conditions document: a flat list of conditions, ANDed together. UI-only fields
   * (such as `approvers`) are dropped so each entry matches the server's leaf shape. Zero conditions
   * is a valid no-op gate.
   */
  conditions: AccessCondition[];
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
  /** When true, an active lease under this rule may be extended once (always auto-approved). */
  allowsExtensions: boolean;
  /** Longest a single extension may run, in seconds. Null when extensions are not allowed. */
  maxExtensionDurationSeconds: number | null;

  constructor(init: {
    name: string;
    description?: string | null;
    conditions: AccessCondition[];
    collections?: string[];
    defaultLeaseDurationSeconds?: number | null;
    maxLeaseDurationSeconds?: number | null;
    singleActiveLease?: boolean;
    enabled?: boolean;
    allowsExtensions?: boolean;
    maxExtensionDurationSeconds?: number | null;
  }) {
    this.name = init.name;
    this.description = init.description ?? null;
    this.conditions = init.conditions.map(toWireCondition);
    this.collections = init.collections ?? [];
    this.defaultLeaseDurationSeconds = init.defaultLeaseDurationSeconds ?? null;
    this.maxLeaseDurationSeconds = init.maxLeaseDurationSeconds ?? null;
    this.singleActiveLease = init.singleActiveLease ?? false;
    this.enabled = init.enabled ?? true;
    this.allowsExtensions = init.allowsExtensions ?? false;
    this.maxExtensionDurationSeconds = init.maxExtensionDurationSeconds ?? null;
  }
}

/**
 * Build the create/update payload for a rule, overriding only `enabled`. Used by
 * the enable/disable toggles, which round-trip the whole rule unchanged otherwise.
 */
export function accessRuleToRequest(rule: AccessRuleResponse, enabled: boolean): AccessRuleRequest {
  return new AccessRuleRequest({
    name: rule.name,
    description: rule.description,
    conditions: rule.conditions,
    collections: rule.collections,
    defaultLeaseDurationSeconds: rule.defaultLeaseDurationSeconds,
    maxLeaseDurationSeconds: rule.maxLeaseDurationSeconds,
    singleActiveLease: rule.singleActiveLease,
    enabled,
  });
}

/** Map a UI condition to the server's leaf shape, dropping UI-only fields (e.g. approvers). */
function toWireCondition(condition: AccessCondition): AccessCondition {
  switch (condition.kind) {
    case "human_approval":
      return { kind: "human_approval" };
    case "ip_allowlist":
      return { kind: "ip_allowlist", cidrs: condition.cidrs };
  }
}
