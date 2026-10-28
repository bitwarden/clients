import { ChangeDetectionStrategy, Component, NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { ActivatedRoute, provideRouter, Router, Routes } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import { RotationConfigsService } from "./managed-credentials/rotation-configs.service";
import { RotationShellComponent } from "./rotation-shell.component";
import { rotationRoutes } from "./rotation.routes";

// JSDOM has no ResizeObserver; the tab nav bar's overflow list constructs one.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(global as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;

describe("RotationShellComponent", () => {
  let fixture: ComponentFixture<RotationShellComponent>;
  let awaitingManualCount$: BehaviorSubject<number>;
  let loadMock: jest.Mock;

  const ORG_ID = "org-abc-123";

  beforeEach(async () => {
    awaitingManualCount$ = new BehaviorSubject<number>(0);
    loadMock = jest.fn().mockResolvedValue(undefined);

    const i18nService = { t: (key: string) => key };

    await TestBed.configureTestingModule({
      imports: [RotationShellComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            params: new BehaviorSubject({ organizationId: ORG_ID }),
            snapshot: { params: { organizationId: ORG_ID } },
          },
        },
        {
          provide: RotationConfigsService,
          useValue: { awaitingManualCount$, load: loadMock },
        },
        { provide: I18nService, useValue: i18nService },
      ],
    })
      .overrideComponent(RotationShellComponent, {
        remove: { imports: [HeaderModule] },
        add: { schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(RotationShellComponent);
  });

  const init = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it("renders the three tab links ordered by the setup each one requires", async () => {
    await init();
    const labels = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll("bit-tab-link"),
    ).map((el) => el.textContent?.trim());
    expect(labels).toEqual([
      "pamRotationTabAccessConnectors",
      "pamRotationTabTargetSystems",
      "pamRotationTabManagedCredentials",
    ]);
  });

  it("renders the page description in the header's subtitle slot", async () => {
    await init();
    const subtitle = (fixture.nativeElement as HTMLElement).querySelector('[slot="subtitle"]');
    expect(subtitle?.textContent?.trim()).toBe("pamRotationSubtitle");
  });

  it("calls load on RotationConfigsService with the organization id on init", async () => {
    await init();
    expect(loadMock).toHaveBeenCalledWith(ORG_ID);
  });

  it("passes the awaiting-manual count to the Managed credentials tab berry", async () => {
    awaitingManualCount$.next(3);
    await init();
    const count = (
      fixture.componentInstance as unknown as { awaitingManualCount: () => number }
    ).awaitingManualCount();
    expect(count).toBe(3);
  });
});

describe("RotationShellComponent (real router)", () => {
  @Component({
    template: "",
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
  })
  class StubComponent {}

  const stubEveryComponentButTheShell = (config: Routes): Routes =>
    config.map((route) => ({
      ...route,
      providers: undefined,
      canDeactivate: undefined,
      ...(route.component && route.component !== RotationShellComponent
        ? { component: StubComponent }
        : {}),
      ...(route.children ? { children: stubEveryComponentButTheShell(route.children) } : {}),
    }));

  const routes: Routes = [
    { path: "rotation", children: stubEveryComponentButTheShell(rotationRoutes) },
  ];

  const tabs = ["access-connectors", "target-systems", "managed-credentials"];

  let harness: RouterTestingHarness;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RotationShellComponent, NoopAnimationsModule],
      providers: [
        provideRouter(routes),
        {
          provide: RotationConfigsService,
          useValue: { awaitingManualCount$: new BehaviorSubject(0), load: jest.fn() },
        },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    })
      .overrideComponent(RotationShellComponent, {
        remove: { imports: [HeaderModule] },
        add: { schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });

  const renderHeader = async (tab: string): Promise<HTMLElement> => {
    await harness.navigateByUrl(`/rotation/${tab}`, RotationShellComponent);
    harness.detectChanges();
    return harness.fixture.nativeElement.querySelector("app-header") as HTMLElement;
  };

  it("lands on the access connectors tab from the shell's bare path", async () => {
    await harness.navigateByUrl("/rotation", RotationShellComponent);
    expect(router.url).toBe("/rotation/access-connectors");
  });

  it.each(tabs)("keeps the page description on the %s tab", async (tab) => {
    const header = await renderHeader(tab);

    const subtitle = header.querySelector('[slot="subtitle"]');
    expect(subtitle?.textContent?.trim()).toBe("pamRotationSubtitle");
  });

  it.each(tabs)("keeps the tab nav bar in the header on the %s tab", async (tab) => {
    const header = await renderHeader(tab);

    expect(header.querySelector("bit-tab-nav-bar")).not.toBeNull();
    expect(header.querySelectorAll("bit-tab-link")).toHaveLength(3);
  });
});
