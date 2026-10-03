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

  const rootSnapshot = (firstChildComponent: unknown) =>
    ({
      routeConfig: null,
      firstChild: { routeConfig: { component: firstChildComponent } },
    }) as unknown as ActivatedRouteSnapshot;

  it("reuses the root node when both sides stay inside the import shell, so the router recurses into children at all", () => {
    expect(
      strategy.shouldReuseRoute(
        rootSnapshot(ImportShellBrowserComponent),
        rootSnapshot(ImportShellBrowserComponent),
      ),
    ).toBe(true);
  });

  it("does not reuse the root node for a navigation unrelated to the import shell — the regression this narrowing exists to prevent", () => {
    class Unrelated {}

    expect(strategy.shouldReuseRoute(rootSnapshot(Unrelated), rootSnapshot(Unrelated))).toBe(false);
  });

  it("does not reuse the root node when entering the import shell from elsewhere", () => {
    class Unrelated {}

    expect(
      strategy.shouldReuseRoute(rootSnapshot(ImportShellBrowserComponent), rootSnapshot(Unrelated)),
    ).toBe(false);
  });

  it("does not reuse the root node when leaving the import shell for elsewhere", () => {
    class Unrelated {}

    expect(
      strategy.shouldReuseRoute(rootSnapshot(Unrelated), rootSnapshot(ImportShellBrowserComponent)),
    ).toBe(false);
  });
});
