import { Route } from "@angular/router";

import { vaultFilterRestoreGuard, VAULT_FILTER_SCOPE } from "@bitwarden/vault";

import { routes } from "./app-routing.module";

/** A route that omits the filter memory fails silently, so every scoped path is asserted here. */
const SCOPED_VAULT_PATHS = [
  "",
  ":vaultId",
  ":vaultId/my-items",
  ":vaultId/shared-folders/:collectionId",
];

function findRoute(candidates: Route[], path: string): Route[] {
  return candidates.flatMap((route) => [
    ...(route.path === path ? [route] : []),
    ...findRoute(route.children ?? [], path),
  ]);
}

function vaultChildren(): Route[] {
  const vaultRoutes = findRoute(routes, "vault");
  expect(vaultRoutes).toHaveLength(1);
  return vaultRoutes[0].children ?? [];
}

describe("desktop vault routes", () => {
  describe.each(SCOPED_VAULT_PATHS)("%s", (path) => {
    // The "" path resolves to two routes — the flag swap holds one for each nav. Only the flagged
    // one carries the filter memory, so a scoped route is the one to assert against.
    const scopedRoutes = () =>
      findRoute(vaultChildren(), path).filter((route) => route.data?.[VAULT_FILTER_SCOPE] === true);

    it("opts into the filter memory", () => {
      expect(scopedRoutes()).toHaveLength(1);
    });

    it("restores the remembered filters", () => {
      expect(scopedRoutes()[0].canActivate).toContain(vaultFilterRestoreGuard);
    });
  });
});
