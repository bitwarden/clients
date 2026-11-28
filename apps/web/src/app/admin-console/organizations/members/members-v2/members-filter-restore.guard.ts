import { inject } from "@angular/core";
import {
  CanActivateFn,
  createUrlTreeFromSnapshot,
  Router,
  RunGuardsAndResolvers,
} from "@angular/router";

import { MembersFilterMemoryService } from "./members-filter-memory.service";
import { hasFilterParams, membersFilterScopeOf } from "./members-filter-scope";

/**
 * Restores the params an organization's members page was last viewed with by redirecting a
 * filter-less members URL to the same route carrying them.
 *
 * Restoring here rather than at each link means every way in behaves the same: the side nav, the
 * post-unlock landing after a reload, Back, and a bookmark.
 *
 * A user clears the memory by clearing the filters: the bare URL that leaves behind is recorded
 * like any other, after which there is nothing to restore.
 */
export const membersFilterRestoreGuard: CanActivateFn = async (route, state) => {
  const filterMemory = inject(MembersFilterMemoryService);

  const organizationId = membersFilterScopeOf(state);
  if (organizationId == null) {
    return true;
  }

  // The URL states its own filters — including none, when they were just cleared.
  if (hasFilterParams(state.root.queryParams)) {
    return true;
  }

  // Awaited: the memory lives on disk, so on the first members navigation of a session it hasn't
  // been read yet.
  const remembered = await filterMemory.paramsFor(organizationId);
  if (Object.keys(remembered).length === 0) {
    return true;
  }

  return createUrlTreeFromSnapshot(route, [], { ...state.root.queryParams, ...remembered });
};

/**
 * The members route's `runGuardsAndResolvers`. Besides Angular's default (a path param change), it
 * reruns {@link membersFilterRestoreGuard} when a navigation that stays on the page drops every
 * filter param without the table having asked for it — the side nav's Members link clicked while
 * already on Members, a typed bare URL, or Back. The component is reused there, so it keeps showing
 * its filters; without the rerun the URL would disagree with the screen, and the memory would record
 * the bare URL as the filters having been cleared.
 *
 * The table writes its own state with `replaceUrl`, so its **Clear all** isn't rerun, and the bare
 * URL it leaves behind clears the memory as intended.
 */
export const membersFilterRunGuards: RunGuardsAndResolvers = (curr, future) => {
  if (JSON.stringify(curr.params) !== JSON.stringify(future.params)) {
    return true;
  }

  if (hasFilterParams(future.queryParams) || !hasFilterParams(curr.queryParams)) {
    return false;
  }

  const navigation = inject(Router).currentNavigation();
  return navigation?.trigger === "popstate" || navigation?.extras.replaceUrl !== true;
};
