import { ActivatedRouteSnapshot } from "@angular/router";

import { ImportShellBrowserComponent } from "../tools/popup/settings/import/import-shell-browser.component";

import { NoRouteReuseStrategy } from "./no-route-reuse-strategy";

describe("NoRouteReuseStrategy", () => {
  const strategy = new NoRouteReuseStrategy();
  const snapshot = (routeConfig: unknown) => ({ routeConfig }) as ActivatedRouteSnapshot;

  it("reuses the import shell's own route node across its child routes", () => {
    const routeConfig = { component: ImportShellBrowserComponent };

    expect(strategy.shouldReuseRoute(snapshot(routeConfig), snapshot(routeConfig))).toBe(true);
  });

  it("does not reuse any other route, even with an identical routeConfig reference", () => {
    const routeConfig = { component: class Unrelated {} };

    expect(strategy.shouldReuseRoute(snapshot(routeConfig), snapshot(routeConfig))).toBe(false);
  });

  it("does not reuse when the two snapshots have different routeConfig references", () => {
    const future = { component: ImportShellBrowserComponent };
    const curr = { component: ImportShellBrowserComponent };

    expect(strategy.shouldReuseRoute(snapshot(future), snapshot(curr))).toBe(false);
  });
});
