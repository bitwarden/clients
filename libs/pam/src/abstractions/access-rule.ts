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
 * A single access check on an access request. An access rule is a flat list of
 * conditions, ANDed together. Zero conditions means no access checks — the
 * lease settings still apply, but anyone with collection access can lease.
 */
export type AccessCondition =
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

export function parseAccessCondition(json: unknown): AccessCondition {
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

export function parseAccessConditions(json: unknown): AccessCondition[] {
  if (json == null) {
    return [];
  }
  if (!Array.isArray(json)) {
    throw new Error("Invalid conditions: not an array");
  }
  return json.map(parseAccessCondition);
}

// Server-side conditions document shape: a single AccessCondition tree, not a
// flat list. The UI still works in terms of `AccessCondition[]`;
// AccessRuleRequest derives the tree from those conditions before sending.
export type AccessConditionTree =
  | { kind: "human_approval" }
  | { kind: "ip_allowlist"; cidrs: string[] }
  | { kind: "all_of"; conditions: AccessConditionTree[] };

export function parseConditionTree(json: unknown): AccessConditionTree | null {
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
      const children = get(obj, "conditions");
      const parsed = Array.isArray(children)
        ? children.map(parseConditionTree).filter((c): c is AccessConditionTree => c != null)
        : [];
      return { kind: "all_of", conditions: parsed };
    }
    default:
      return null;
  }
}

/**
 * Flatten the server's condition tree back into the UI's `AccessCondition[]` —
 * the inverse of {@link AccessRuleRequest}'s `conditionsToTree`. The server
 * stores the tree, not the conditions list, so this reconstructs the list on
 * read. Note the tree carries no `approvers` (the forward mapping drops them),
 * so a reconstructed `human_approval` has no approvers — all the current UI
 * needs.
 */
export function treeToConditions(tree: AccessConditionTree): AccessCondition[] {
  switch (tree.kind) {
    case "human_approval":
      return [{ kind: "human_approval" }];
    case "ip_allowlist":
      return [{ kind: "ip_allowlist", cidrs: tree.cidrs }];
    case "all_of":
      return tree.conditions.flatMap(treeToConditions);
  }
}
