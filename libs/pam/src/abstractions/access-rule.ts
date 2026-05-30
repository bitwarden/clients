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
export type Approvers =
  | { mode: "collection_managers" }
  | { mode: "specific"; userIds: string[] };

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
      return approvers
        ? { kind: "human_approval", approvers }
        : { kind: "human_approval" };
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
