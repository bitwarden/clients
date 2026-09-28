import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";

import { BreadcrumbComponent } from "./breadcrumb.component";

/**
 * Mirrors how the vault headers build their trail: every crumb targets the *same* path and is
 * distinguished only by the query params it merges into the URL.
 */
@Component({
  template: `
    <bit-breadcrumb
      [route]="orgRoute()"
      [queryParams]="{ organizationId: 'org-1', collectionId: null }"
      queryParamsHandling="merge"
    >
      Acme Corp
    </bit-breadcrumb>
    <bit-breadcrumb
      [route]="[]"
      [queryParams]="{ collectionId: 'col-1' }"
      queryParamsHandling="merge"
    >
      Engineering
    </bit-breadcrumb>
    <bit-breadcrumb
      [route]="[]"
      [queryParams]="{ collectionId: 'col-2' }"
      queryParamsHandling="merge"
    >
      Frontend
    </bit-breadcrumb>
    <bit-breadcrumb>No route</bit-breadcrumb>
  `,
  imports: [BreadcrumbComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestHostComponent {
  /** The org crumb's route, so the string and command-array forms can both be exercised. */
  readonly orgRoute = signal<string | unknown[]>([]);
}

describe("BreadcrumbComponent", () => {
  /**
   * Navigates to `url` and renders the host at that route, so the crumbs resolve against a real
   * `Router` and `ActivatedRoute` — and are created *after* the `NavigationEnd`, as they are when
   * a collection filter reveals them.
   */
  async function setup(url: string) {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: "**", component: TestHostComponent }])],
    });

    const harness = await RouterTestingHarness.create();
    const host = await harness.navigateByUrl(url, TestHostComponent);

    const crumbs = harness.fixture.debugElement
      .queryAll(By.directive(BreadcrumbComponent))
      .map((debugEl) => debugEl.componentInstance as BreadcrumbComponent);

    return { harness, host, crumbs };
  }

  it("marks only the crumb whose merged query params match the URL as active", async () => {
    const { crumbs } = await setup("/vault?organizationId=org-1&collectionId=col-2");
    const [org, parentCollection, currentCollection] = crumbs;

    // The org crumb clears `collectionId`, so it points one level up — not at the current URL.
    expect(org.isActiveRoute()).toBe(false);
    expect(parentCollection.isActiveRoute()).toBe(false);
    expect(currentCollection.isActiveRoute()).toBe(true);
  });

  it("marks the org crumb active once the collection filter is cleared", async () => {
    const { crumbs } = await setup("/vault?organizationId=org-1");
    const [org, parentCollection, currentCollection] = crumbs;

    expect(org.isActiveRoute()).toBe(true);
    expect(parentCollection.isActiveRoute()).toBe(false);
    expect(currentCollection.isActiveRoute()).toBe(false);
  });

  it("applies query params to a string route", async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: "**", component: TestHostComponent }])],
    });
    const harness = await RouterTestingHarness.create();
    const host = await harness.navigateByUrl("/vault?organizationId=org-1", TestHostComponent);
    host.orgRoute.set("/vault");
    harness.detectChanges();

    const [org] = harness.fixture.debugElement
      .queryAll(By.directive(BreadcrumbComponent))
      .map((debugEl) => debugEl.componentInstance as BreadcrumbComponent);
    org.checkActiveRoute();

    expect(org.isActiveRoute()).toBe(true);
  });

  it("leaves a crumb without a route inactive", async () => {
    const { crumbs } = await setup("/vault?organizationId=org-1");

    expect(crumbs[3].isActiveRoute()).toBe(false);
  });

  it("rechecks on navigation", async () => {
    const { harness, crumbs } = await setup("/vault?organizationId=org-1&collectionId=col-1");
    const [, parentCollection, currentCollection] = crumbs;

    expect(parentCollection.isActiveRoute()).toBe(true);
    expect(currentCollection.isActiveRoute()).toBe(false);

    await harness.navigateByUrl("/vault?organizationId=org-1&collectionId=col-2");

    expect(parentCollection.isActiveRoute()).toBe(false);
    expect(currentCollection.isActiveRoute()).toBe(true);
  });
});
