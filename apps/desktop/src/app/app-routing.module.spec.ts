import { TestBed } from "@angular/core/testing";
import { Route, UrlSegment } from "@angular/router";
import { firstValueFrom, of } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
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

describe("desktop import route", () => {
  // canMatch on the parent route (not canActivate, and not just on the children) is what keeps
  // the whole subtree unreachable while the flag is off.
  // TODO: remove once pm-35053-import-upgrade is retired
  it("gates the entire subtree on the ImportUpgrade flag via canMatch", async () => {
    const importRoutes = findRoute(routes, "import");
    expect(importRoutes).toHaveLength(1);
    expect(importRoutes[0].canMatch).toHaveLength(1);

    const getFeatureFlag$ = jest.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: ConfigService, useValue: { getFeatureFlag$ } }],
    });
    const canMatch = importRoutes[0].canMatch![0];
    const route = {} as Route;
    const segments = [] as UrlSegment[];

    getFeatureFlag$.mockReturnValue(of(false));
    const whenOff = await firstValueFrom(
      TestBed.runInInjectionContext(() => canMatch(route, segments)) as any,
    );
    expect(whenOff).toBe(false);
    expect(getFeatureFlag$).toHaveBeenCalledWith(FeatureFlag.ImportUpgrade);

    getFeatureFlag$.mockReturnValue(of(true));
    const whenOn = await firstValueFrom(
      TestBed.runInInjectionContext(() => canMatch(route, segments)) as any,
    );
    expect(whenOn).toBe(true);
  });
});
