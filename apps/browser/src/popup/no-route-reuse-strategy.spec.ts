import { ActivatedRouteSnapshot } from "@angular/router";

import { NoRouteReuseStrategy } from "./app-routing.module";

// 'qrcode-parser' is an es6 module jest can't compile; the routing module pulls it in through BrowserTotpCaptureService.
jest.mock("qrcode-parser", () => {});

describe("NoRouteReuseStrategy", () => {
  const strategy = new NoRouteReuseStrategy();
  const snapshot = (routeConfig: unknown) => ({ routeConfig }) as ActivatedRouteSnapshot;
  const shellConfig = () => ({ data: { importShell: true } });
  const otherConfig = () => ({ data: { elevation: 1 } });

  it("reuses the import shell's own route node across its child routes", () => {
    const routeConfig = shellConfig();

    expect(strategy.shouldReuseRoute(snapshot(routeConfig), snapshot(routeConfig))).toBe(true);
  });

  it("does not reuse any other route, even with an identical routeConfig reference", () => {
    const routeConfig = otherConfig();

    expect(strategy.shouldReuseRoute(snapshot(routeConfig), snapshot(routeConfig))).toBe(false);
  });

  it("does not reuse a route that has no data at all", () => {
    const routeConfig = {};

    expect(strategy.shouldReuseRoute(snapshot(routeConfig), snapshot(routeConfig))).toBe(false);
  });

  it("does not reuse when the two snapshots have different routeConfig references", () => {
    expect(strategy.shouldReuseRoute(snapshot(shellConfig()), snapshot(shellConfig()))).toBe(false);
  });

  const rootSnapshot = (firstChildConfig: unknown) =>
    ({
      routeConfig: null,
      firstChild: { routeConfig: firstChildConfig },
    }) as unknown as ActivatedRouteSnapshot;

  it("reuses the root node when both sides stay inside the import shell, so the router recurses into children at all", () => {
    expect(
      strategy.shouldReuseRoute(rootSnapshot(shellConfig()), rootSnapshot(shellConfig())),
    ).toBe(true);
  });

  it("does not reuse the root node for a navigation unrelated to the import shell — the regression this narrowing exists to prevent", () => {
    expect(
      strategy.shouldReuseRoute(rootSnapshot(otherConfig()), rootSnapshot(otherConfig())),
    ).toBe(false);
  });

  it("does not reuse the root node when entering the import shell from elsewhere", () => {
    expect(
      strategy.shouldReuseRoute(rootSnapshot(shellConfig()), rootSnapshot(otherConfig())),
    ).toBe(false);
  });

  it("does not reuse the root node when leaving the import shell for elsewhere", () => {
    expect(
      strategy.shouldReuseRoute(rootSnapshot(otherConfig()), rootSnapshot(shellConfig())),
    ).toBe(false);
  });
});
