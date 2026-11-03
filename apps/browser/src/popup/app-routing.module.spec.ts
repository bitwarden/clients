import { TestBed } from "@angular/core/testing";
import { Route, Router } from "@angular/router";

import { importUpgradeRedirectGuard } from "../tools/popup/guards/import-upgrade-redirect.guard";
import { importUpgradeRequiredGuard } from "../tools/popup/guards/import-upgrade-required.guard";

import { AppRoutingModule } from "./app-routing.module";

// 'qrcode-parser' is an es6 module jest can't compile; the routing module pulls it in through BrowserTotpCaptureService.
jest.mock("qrcode-parser", () => {});

function findRoute(candidates: Route[], path: string): Route[] {
  return candidates.flatMap((route) => [
    ...(route.path === path ? [route] : []),
    ...findRoute(route.children ?? [], path),
  ]);
}

describe("browser import routes", () => {
  let routes: Route[];

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AppRoutingModule] });
    routes = TestBed.inject(Router).config;
  });

  // TODO: remove once pm-35053-import-upgrade is retired
  it("puts the whole new import subtree behind importUpgradeRequiredGuard", () => {
    const newRoutes = findRoute(routes, "import-source-select");
    expect(newRoutes).toHaveLength(1);
    expect(newRoutes[0].canActivate).toContain(importUpgradeRequiredGuard);
    expect(newRoutes[0].data?.["importShell"]).toBe(true);
    expect((newRoutes[0].children ?? []).map((child) => child.path)).toEqual(["", ":importType"]);
  });

  it("keeps the legacy import route behind importUpgradeRedirectGuard", () => {
    const legacyRoutes = findRoute(routes, "import");
    expect(legacyRoutes).toHaveLength(1);
    expect(legacyRoutes[0].canActivate).toContain(importUpgradeRedirectGuard);
  });
});
