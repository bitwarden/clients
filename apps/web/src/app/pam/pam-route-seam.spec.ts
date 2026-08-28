import { ChangeDetectionStrategy, Component, inject, Provider } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter, Router, RouterOutlet, Routes } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";

import { PAM_ROUTES } from "./pam-routes.token";

@Component({
  selector: "app-shell",
  template: "<router-outlet></router-outlet>",
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ShellComponent {}

@Component({
  selector: "app-blank",
  template: "blank",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class BlankComponent {}

@Component({
  selector: "app-pam",
  template: "pam-page",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class PamPageComponent {}

const pamChildRoutes: Routes = [{ path: "", component: PamPageComponent }];

describe("PAM_ROUTES seam", () => {
  let calls: string[];

  /** Stands in for a real guard, recording that it ran and allowing navigation. */
  const record = (name: string) => () => {
    calls.push(name);
    return true;
  };

  /**
   * The shape `OssRoutingModule` gives the user shell: one `UserLayoutComponent` mount behind
   * `deepLinkGuard` + `authGuard`, with `pam` as one of its children. The guards are recorders
   * rather than the real ones so their relative order is observable.
   */
  const routes: Routes = [
    {
      path: "",
      component: ShellComponent,
      canActivate: [record("deepLinkGuard"), record("authGuard")],
      children: [
        { path: "vault", component: BlankComponent },
        {
          path: "pam",
          canMatch: [() => inject(PAM_ROUTES, { optional: true }) != null],
          canActivate: [record("canAccessFeature(Pam)")],
          loadChildren: () => pamChildRoutes,
        },
      ],
    },
    { path: "**", redirectTo: "" },
  ];

  const setup = async (providePamRoutes: boolean) => {
    calls = [];
    const providers: Provider[] = [provideRouter(routes)];
    if (providePamRoutes) {
      providers.push({ provide: PAM_ROUTES, useValue: () => pamChildRoutes });
    }
    TestBed.configureTestingModule({ providers });
    return await RouterTestingHarness.create();
  };

  it("resolves /pam to the commercial pages when a host provides the seam", async () => {
    const harness = await setup(true);

    await harness.navigateByUrl("/pam");
    harness.detectChanges();

    expect(TestBed.inject(Router).url).toBe("/pam");
    expect(harness.fixture.nativeElement.textContent).toContain("pam-page");
  });

  it("gates /pam behind the shell's auth guards before the feature-flag guard", async () => {
    const harness = await setup(true);

    await harness.navigateByUrl("/pam");

    expect(calls).toEqual(["deepLinkGuard", "authGuard", "canAccessFeature(Pam)"]);
  });

  it("never matches /pam in an OSS-only build where nothing provides the seam", async () => {
    const harness = await setup(false);

    await harness.navigateByUrl("/pam");

    // canMatch declines, so /pam is not a route at all and the wildcard sends the user home —
    // how an OSS-only build treats any unknown path.
    expect(TestBed.inject(Router).url).toBe("/");
    expect(calls).not.toContain("canAccessFeature(Pam)");
  });
});
