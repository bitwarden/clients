import { ActivatedRouteSnapshot, Params, RouterStateSnapshot } from "@angular/router";

import { OrganizationId } from "@bitwarden/common/types/guid";

import { MemberFilters } from "./members-filter";

/** The `queryParam` namespace the members table mirrors its state under. */
export const MEMBERS_FILTER_NAMESPACE = "members";

/** The route `data` key the members route sets to opt its filters into the memory. */
export const MEMBERS_FILTER_SCOPE = "membersFilterScope";

export type MembersFilterScopeRouteData = { [MEMBERS_FILTER_SCOPE]: true };

/**
 * The plain keys Event Logs links to the members page with. A URL carrying either states what it
 * wants shown, so remembered filters must not be layered over it.
 */
const DEEP_LINK_KEYS: readonly string[] = ["search", "viewEvents"];

const FILTER_KEYS = [
  "search",
  "status",
  "role",
  "access",
  "product",
  "policies",
] as const satisfies readonly (keyof MemberFilters)[];

/**
 * `bit-table-v2` sort and page-size keys. Mirrored rather than imported because the table keeps
 * them module-private.
 */
const TABLE_KEYS = ["sort", "direction", "pageSize"] as const;

/**
 * The keys carried forward to the next visit. An allowlist, so a param added under the namespace
 * later isn't persisted by accident.
 *
 * The page number (`page`) is left out: the member list may have changed since the last visit, so
 * the user starts back on the first page.
 */
const REMEMBERED_KEYS: ReadonlySet<string> = new Set(
  [...FILTER_KEYS, ...TABLE_KEYS].map((key) => `${MEMBERS_FILTER_NAMESPACE}.${key}`),
);

/** The subset of a members URL's query params worth keeping — see {@link REMEMBERED_KEYS}. */
export function rememberableParams(params: Params): Params {
  return Object.fromEntries(Object.entries(params).filter(([key]) => REMEMBERED_KEYS.has(key)));
}

/**
 * Whether a URL already states its own filters, and so shouldn't have remembered ones applied over
 * it: any `members.*` param, including a page number, or an Event Logs deep link.
 */
export function hasFilterParams(params: Params): boolean {
  return Object.keys(params).some(
    (key) => key.startsWith(`${MEMBERS_FILTER_NAMESPACE}.`) || DEEP_LINK_KEYS.includes(key),
  );
}

/**
 * The organization whose members page the activated route shows, or `null` when no route on it
 * opted into the memory.
 */
export function membersFilterScopeOf(state: RouterStateSnapshot): OrganizationId | null {
  const route = scopedRoute(state.root);
  if (route == null) {
    return null;
  }

  // Walk up rather than trusting inherited params, so the lookup doesn't depend on the router's
  // `paramsInheritanceStrategy`.
  for (const ancestor of [...route.pathFromRoot].reverse()) {
    const organizationId = ancestor.paramMap.get("organizationId");
    if (organizationId != null) {
      return organizationId as OrganizationId;
    }
  }
  return null;
}

/** The shallowest activated route opting into filter memory, searching down the primary outlet. */
function scopedRoute(root: ActivatedRouteSnapshot): ActivatedRouteSnapshot | null {
  for (let route: ActivatedRouteSnapshot | null = root; route != null; route = route.firstChild) {
    if (route.data[MEMBERS_FILTER_SCOPE] === true) {
      return route;
    }
  }
  return null;
}
