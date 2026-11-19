import { ChangeDetectionStrategy, Component, Provider } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter, Route, Router, RouterOutlet, Routes } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";

import { routes as desktopRoutes } from "../app-routing.module";

import { PAM_DESKTOP_ROUTES } from "./pam-routes.token";

@Component({
  selector: "app-shell",
  template: "<router-outlet></router-outlet>",
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ShellComponent {}

@Component({
  selector: "app-pam",
  template: "pam-page",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class PamPageComponent {}

/** The real `pam` route, found by path so the spec cannot drift from the app's routing. */
function findPamRoute(routes: Routes): Route | undefined {
  for (const route of routes) {
    if (route.path === "pam") {
      return route;
    }
    const nested = route.children ? findPamRoute(route.children) : undefined;
    if (nested) {
      return nested;
    }
  }
  return undefined;
}

describe("PAM_DESKTOP_ROUTES seam", () => {
  const pamRoute = findPamRoute(desktopRoutes);

  const setup = async (providePamRoutes: boolean) => {
    // The feature-flag guard needs a flag service of its own; its presence is asserted below.
    const routes: Routes = [
      {
        path: "",
        component: ShellComponent,
        children: [{ ...pamRoute, canActivate: [] }],
      },
      { path: "**", redirectTo: "" },
    ];
    const providers: Provider[] = [provideRouter(routes)];
    if (providePamRoutes) {
      providers.push({
        provide: PAM_DESKTOP_ROUTES,
        useValue: () => [{ path: "", component: PamPageComponent }],
      });
    }
    TestBed.configureTestingModule({ providers });
    return await RouterTestingHarness.create();
  };

  it("is declared under the desktop layout behind the VFO1 and PAM feature-flag guards", () => {
    expect(pamRoute).toBeDefined();
    expect(pamRoute.canActivate).toHaveLength(2);
  });

  it("resolves /pam to the commercial pages when a host provides the seam", async () => {
    const harness = await setup(true);

    await harness.navigateByUrl("/pam");
    harness.detectChanges();

    expect(TestBed.inject(Router).url).toBe("/pam");
    expect(harness.fixture.nativeElement.textContent).toContain("pam-page");
  });

  it("never matches /pam in an OSS-only build where nothing provides the seam", async () => {
    const harness = await setup(false);

    await harness.navigateByUrl("/pam");

    // canMatch declines, so /pam isn't a route at all, and the wildcard sends the user home.
    expect(TestBed.inject(Router).url).toBe("/");
  });
});
