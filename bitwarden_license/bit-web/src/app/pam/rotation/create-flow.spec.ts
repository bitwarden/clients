import { ChangeDetectionStrategy, Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router, RouterOutlet, provideRouter } from "@angular/router";

import { ORGANIZATION_ID } from "./testing/rotation-builders";

@Component({
  template: "",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StubPageComponent {}

@Component({
  template: "<router-outlet></router-outlet>",
  standalone: true,
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StubRootComponent {}

describe("rotation create-flow relative navigation", () => {
  const base = `/organizations/${ORGANIZATION_ID}/pam/rotation`;

  async function activatedRouteFor(url: string): Promise<ActivatedRoute> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: "organizations/:organizationId/pam/rotation",
            children: [
              { path: "managed-credentials", component: StubPageComponent },
              { path: "managed-credentials/new", component: StubPageComponent },
              { path: "target-systems", component: StubPageComponent },
              { path: "target-systems/new", component: StubPageComponent },
            ],
          },
        ]),
      ],
    });
    const harness = TestBed.createComponent(StubRootComponent);
    harness.detectChanges();
    await TestBed.inject(Router).navigateByUrl(url);
    harness.detectChanges();

    let route = TestBed.inject(ActivatedRoute);
    while (route.firstChild != null) {
      route = route.firstChild;
    }
    return route;
  }

  function urlFor(route: ActivatedRoute, commands: unknown[], queryParams: object): string {
    return TestBed.inject(Router)
      .createUrlTree(commands, { relativeTo: route, queryParams })
      .toString();
  }

  it("reaches the target-system create page from the credential create page", async () => {
    const route = await activatedRouteFor(`${base}/managed-credentials/new`);

    expect(urlFor(route.parent!, ["target-systems", "new"], { then: "managed-credential" })).toBe(
      `${base}/target-systems/new?then=managed-credential`,
    );
  });

  it("reaches the credential create page from the target-system create page", async () => {
    const route = await activatedRouteFor(`${base}/target-systems/new`);

    expect(urlFor(route.parent!, ["managed-credentials", "new"], { targetSystemId: "ts-1" })).toBe(
      `${base}/managed-credentials/new?targetSystemId=ts-1`,
    );
  });

  it("does not climb past a two-segment route with a second ..", async () => {
    const route = await activatedRouteFor(`${base}/target-systems/new`);

    expect(urlFor(route, ["..", "..", "managed-credentials", "new"], {})).toContain("/../");
  });

  /** The single `..` the existing pages already use, pinned alongside. */
  it("still reaches the target-systems list from the target-system create page", async () => {
    const route = await activatedRouteFor(`${base}/target-systems/new`);

    expect(urlFor(route, [".."], {})).toBe(`${base}/target-systems`);
  });

  it("reaches the target-system create page from the managed-credentials tab", async () => {
    const route = await activatedRouteFor(`${base}/managed-credentials`);

    expect(urlFor(route, ["..", "target-systems", "new"], { then: "managed-credential" })).toBe(
      `${base}/target-systems/new?then=managed-credential`,
    );
  });

  it("reaches the credential create page from the target-systems tab", async () => {
    const route = await activatedRouteFor(`${base}/target-systems`);

    expect(urlFor(route, ["..", "managed-credentials", "new"], { targetSystemId: "ts-1" })).toBe(
      `${base}/managed-credentials/new?targetSystemId=ts-1`,
    );
  });
});
