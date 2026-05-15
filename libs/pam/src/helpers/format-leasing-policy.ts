import { LeasingPolicy } from "../abstractions/leasing-policy";

/**
 * Translatable i18n key + interpolation payload for a rendered leasing policy.
 *
 * Returning a `{ key, params }` pair (instead of a pre-formatted string) keeps
 * this helper non-Angular and lets the caller resolve the user-facing string
 * via their I18nService. The keys live in `apps/web/src/locales/en/messages.json`.
 */
export type LeasingPolicySummary = {
  key: string;
  params?: Record<string, string | number>;
};

/**
 * Produce an i18n-ready summary for a `LeasingPolicy`. `all_of` is rendered by
 * joining child summaries with a separator key the caller resolves itself.
 *
 * Examples:
 *   { kind: "human_approval" }                    -> pamPolicyHumanApproval
 *   { kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] } -> pamPolicyIpAllowlist (count 1)
 *   { kind: "time_of_day", windows, tz }          -> pamPolicyTimeOfDay (count)
 *   { kind: "all_of", children: [...] }           -> pamPolicyAllOf (children joined)
 *
 * Empty `all_of` collapses to `pamPolicyEmpty`.
 */
export function formatLeasingPolicy(policy: LeasingPolicy | null): LeasingPolicySummary {
  if (policy == null) {
    return { key: "pamPolicyNone" };
  }

  switch (policy.kind) {
    case "human_approval":
      return { key: "pamPolicyHumanApproval" };
    case "ip_allowlist": {
      const count = policy.cidrs?.length ?? 0;
      return { key: "pamPolicyIpAllowlist", params: { count } };
    }
    case "time_of_day": {
      const count = policy.windows?.length ?? 0;
      return { key: "pamPolicyTimeOfDay", params: { count } };
    }
    case "all_of": {
      if (policy.children.length === 0) {
        return { key: "pamPolicyEmpty" };
      }
      // Caller can resolve each child via formatLeasingPolicy + i18n.t,
      // and join with the localized separator pamPolicySeparator.
      return {
        key: "pamPolicyAllOf",
        params: { count: policy.children.length },
      };
    }
  }
}

/**
 * Flatten a policy to an ordered list of leaf summaries. Useful when the UI
 * wants to render each child as a separate chip rather than relying on the
 * locale-defined separator inside `pamPolicyAllOf`.
 */
export function flattenLeasingPolicy(policy: LeasingPolicy | null): LeasingPolicySummary[] {
  if (policy == null) {
    return [{ key: "pamPolicyNone" }];
  }
  if (policy.kind === "all_of") {
    return policy.children.flatMap(flattenLeasingPolicy);
  }
  return [formatLeasingPolicy(policy)];
}
