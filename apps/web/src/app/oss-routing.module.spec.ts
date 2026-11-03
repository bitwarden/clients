import { TestBed } from "@angular/core/testing";
import { Route, Router, UrlSegment } from "@angular/router";
import { firstValueFrom, of } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { OssRoutingModule } from "./oss-routing.module";

function findRoute(candidates: Route[], path: string): Route[] {
  return candidates.flatMap((route) => [
    ...(route.path === path ? [route] : []),
    ...findRoute(route.children ?? [], path),
  ]);
}

describe("web import routes", () => {
  let routes: Route[];
  const getFeatureFlag$ = jest.fn();

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OssRoutingModule],
      providers: [{ provide: ConfigService, useValue: { getFeatureFlag$ } }],
    });
    routes = TestBed.inject(Router).config;
  });

  // The upgraded route is listed first and only matches while the flag is on; otherwise routing
  // falls through to the legacy route listed after it.
  // TODO: remove once pm-35053-import-upgrade is retired
  it("lists the flagged upgrade route before the unflagged legacy route", () => {
    const importRoutes = findRoute(routes, "import");
    expect(importRoutes).toHaveLength(2);
    expect(importRoutes[0].canMatch).toHaveLength(1);
    expect((importRoutes[0].children ?? []).map((child) => child.path)).toEqual([
      "",
      ":importType",
    ]);
    expect(importRoutes[1].canMatch).toBeUndefined();
    expect(importRoutes[1].children).toBeUndefined();
  });

  it("matches the upgrade route only while the ImportUpgrade flag is on", async () => {
    const canMatch = findRoute(routes, "import")[0].canMatch![0];
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
