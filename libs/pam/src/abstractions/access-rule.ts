export const ConditionKind = Object.freeze({
  HumanApproval: "human_approval",
  IpAllowlist: "ip_allowlist",
} as const);
export type ConditionKind = (typeof ConditionKind)[keyof typeof ConditionKind];

/**
 * How human approval routes a request.
 *  - `collection_managers`: any manager on the gated collection can approve.
 *  - `specific`: only the listed users can approve.
 */
export type Approvers = { mode: "collection_managers" } | { mode: "specific"; userIds: string[] };

/**
 * A single access check on a lease request. An access rule is a flat list of
 * conditions, ANDed together. Zero conditions means no access checks — the
 * lease settings still apply, but anyone with collection access can lease.
 */
export type Condition =
  | { kind: "human_approval"; approvers?: Approvers }
  | { kind: "ip_allowlist"; cidrs: string[] };

const get = (obj: Record<string, unknown>, key: string): unknown =>
  obj[key] ?? obj[key.charAt(0).toUpperCase() + key.slice(1)];

function parseApprovers(json: unknown): Approvers | undefined {
  if (json == null || typeof json !== "object") {
    return undefined;
  }
  const obj = json as Record<string, unknown>;
  const mode = get(obj, "mode");
  if (mode === "collection_managers") {
    return { mode: "collection_managers" };
  }
  if (mode === "specific") {
    const ids = get(obj, "userIds");
    return { mode: "specific", userIds: Array.isArray(ids) ? ids.map(String) : [] };
  }
  return undefined;
}

export function parseCondition(json: unknown): Condition {
  if (json == null || typeof json !== "object") {
    throw new Error("Invalid condition: not an object");
  }
  const obj = json as Record<string, unknown>;
  const kind = get(obj, "kind");
  switch (kind) {
    case ConditionKind.HumanApproval: {
      const approvers = parseApprovers(get(obj, "approvers"));
      return approvers ? { kind: "human_approval", approvers } : { kind: "human_approval" };
    }
    case ConditionKind.IpAllowlist:
      return { kind: "ip_allowlist", cidrs: get(obj, "cidrs") as string[] };
    default:
      throw new Error(`Invalid condition: unknown kind "${String(kind)}"`);
  }
}

export function parseConditions(json: unknown): Condition[] {
  if (json == null) {
    return [];
  }
  if (!Array.isArray(json)) {
    throw new Error("Invalid conditions: not an array");
  }
  return json.map(parseCondition);
}

// Server-side AccessRule shape: a single tree, not a flat conditions list.
// The UI still works in terms of `Condition[]`; AccessRuleRequest derives the
// tree from those conditions before sending.
export type AccessRule =
  | { kind: "human_approval" }
  | { kind: "ip_allowlist"; cidrs: string[] }
  | { kind: "all_of"; rules: AccessRule[] };

export function parseRule(json: unknown): AccessRule | null {
  if (json == null || typeof json !== "object") {
    return null;
  }
  const obj = json as Record<string, unknown>;
  const kind = get(obj, "kind");
  switch (kind) {
    case ConditionKind.HumanApproval:
      return { kind: "human_approval" };
    case ConditionKind.IpAllowlist:
      return { kind: "ip_allowlist", cidrs: (get(obj, "cidrs") as string[]) ?? [] };
    case "all_of": {
      const rules = get(obj, "rules");
      const parsed = Array.isArray(rules)
        ? rules.map(parseRule).filter((r): r is AccessRule => r != null)
        : [];
      return { kind: "all_of", rules: parsed };
    }
    default:
      return null;
  }
}

/**
 * Flatten the server's AccessRule tree back into the UI's `Condition[]` — the
 * inverse of {@link AccessRuleRequest}'s `conditionsToRule`. The server stores
 * the tree, not the conditions list, so this reconstructs the list on read.
 * Note the tree carries no `approvers` (the forward mapping drops them), so a
 * reconstructed `human_approval` has no approvers — all the current UI needs.
 */
export function ruleToConditions(rule: AccessRule): Condition[] {
  switch (rule.kind) {
    case "human_approval":
      return [{ kind: "human_approval" }];
    case "ip_allowlist":
      return [{ kind: "ip_allowlist", cidrs: rule.cidrs }];
    case "all_of":
      return rule.rules.flatMap(ruleToConditions);
  }
}
