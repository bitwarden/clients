import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { provideRouter, Router } from "@angular/router";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import {
  AgentAccessOpenShellViewToggleComponent,
  OPENSHELL_ENVIRONMENTS_ROUTE,
  OPENSHELL_SANDBOXES_ROUTE,
} from "./agent-access-openshell-view-toggle.component";

describe("AgentAccessOpenShellViewToggleComponent (§M8.20 rule 17)", () => {
  let router: Router;

  beforeAll(() => {
    (global as any).ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  function render(view: "sandboxes" | "environments"): ComponentFixture<unknown> {
    const i18n = mock<I18nService>();
    i18n.t.mockImplementation((key: string) => key);
    TestBed.configureTestingModule({
      imports: [AgentAccessOpenShellViewToggleComponent, NoopAnimationsModule],
      providers: [{ provide: I18nService, useValue: i18n }, provideRouter([])],
    });
    router = TestBed.inject(Router);
    jest.spyOn(router, "navigate").mockResolvedValue(true);
    const fixture = TestBed.createComponent(AgentAccessOpenShellViewToggleComponent);
    fixture.componentRef.setInput("view", view);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => TestBed.resetTestingModule());

  const radio = (fixture: ComponentFixture<unknown>, testId: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-testid="${testId}"]`);

  it("offers Sandboxes and Environments", () => {
    const fixture = render("sandboxes");
    expect(radio(fixture, "openshell-view-sandboxes")?.textContent).toContain(
      "agentAccessOsViewSandboxes",
    );
    expect(radio(fixture, "openshell-view-environments")?.textContent).toContain(
      "agentAccessOsViewEnvironments",
    );
  });

  it("navigates to the other view and not to the current one", () => {
    const fixture = render("sandboxes");
    (fixture.componentInstance as any).select("sandboxes");
    expect(router.navigate).not.toHaveBeenCalled();
    (fixture.componentInstance as any).select("environments");
    expect(router.navigate).toHaveBeenCalledWith([OPENSHELL_ENVIRONMENTS_ROUTE]);

    TestBed.resetTestingModule();
    const back = render("environments");
    (back.componentInstance as any).select("sandboxes");
    expect(router.navigate).toHaveBeenCalledWith([OPENSHELL_SANDBOXES_ROUTE]);
  });

  it("ignores an empty selection", () => {
    const fixture = render("sandboxes");
    (fixture.componentInstance as any).select(undefined);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("uses a route a sandbox name can never take", () => {
    expect(OPENSHELL_ENVIRONMENTS_ROUTE.split("/").pop()).toMatch(/^_/);
  });
});
