import { ChangeDetectionStrategy, Component, NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { ActivatedRoute, provideRouter, Router, Routes } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import { DaemonsService } from "./daemons/daemons.service";
import { RotationConfigsService } from "./managed-credentials/rotation-configs.service";
import { RotationShellComponent } from "./rotation-shell.component";
import { TargetSystemsService } from "./target-systems/target-systems.service";

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
  let daemonsService: { registerCompleted: jest.Mock };
  let targetSystemsService: { systems$: BehaviorSubject<unknown[]> };
  let dialogService: ReturnType<typeof mock<DialogService>>;
  let toastService: ReturnType<typeof mock<ToastService>>;

  const ORG_ID = "org-abc-123";

  beforeEach(async () => {
    awaitingManualCount$ = new BehaviorSubject<number>(0);
    loadMock = jest.fn().mockResolvedValue(undefined);
    daemonsService = { registerCompleted: jest.fn().mockResolvedValue(undefined) };
    targetSystemsService = { systems$: new BehaviorSubject<unknown[]>([]) };
    dialogService = mock<DialogService>();
    toastService = mock<ToastService>();

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
        { provide: DaemonsService, useValue: daemonsService },
        { provide: TargetSystemsService, useValue: targetSystemsService },
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: toastService },
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

  it("renders the three tab links", async () => {
    await init();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? "";
    expect(text).toContain("pamRotationTabManagedCredentials");
    expect(text).toContain("pamRotationTabTargetSystems");
    expect(text).toContain("pamRotationTabDaemons");
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

  it("navigates to the target-system create page on createTargetSystem", async () => {
    await init();
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, "navigate").mockResolvedValue(true);

    await (
      fixture.componentInstance as unknown as { createTargetSystem: () => Promise<boolean> }
    ).createTargetSystem();

    expect(navigateSpy).toHaveBeenCalledWith(
      ["target-systems", "new"],
      expect.objectContaining({ relativeTo: expect.anything() }),
    );
  });

  it("refreshes daemons and toasts after a successful registration", async () => {
    await init();
    dialogService.open.mockReturnValue({ closed: of(true) } as never);

    await (
      fixture.componentInstance as unknown as { registerDaemon: () => Promise<void> }
    ).registerDaemon();

    expect(daemonsService.registerCompleted).toHaveBeenCalledWith(ORG_ID);
    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" }),
    );
  });

  it("does not refresh daemons when registration is cancelled", async () => {
    await init();
    dialogService.open.mockReturnValue({ closed: of(undefined) } as never);

    await (
      fixture.componentInstance as unknown as { registerDaemon: () => Promise<void> }
    ).registerDaemon();

    expect(daemonsService.registerCompleted).not.toHaveBeenCalled();
    expect(toastService.showToast).not.toHaveBeenCalled();
  });
});

// Exercises the shell against the REAL production route shape so relative
// navigation from the empty-path shell route and the router-driven activeTab
// signal are validated end-to-end (things static checks / template-override
// specs cannot catch).
describe("RotationShellComponent (real router)", () => {
  @Component({
    template: "",
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
  })
  class StubComponent {}

  // Mirrors rotation.routes.ts: the shell is an empty-path child of "rotation",
  // and the create page is its sibling (not a child).
  const routes: Routes = [
    {
      path: "rotation",
      children: [
        { path: "target-systems/new", component: StubComponent },
        {
          path: "",
          component: RotationShellComponent,
          children: [
            { path: "", pathMatch: "full", redirectTo: "target-systems" },
            { path: "managed-credentials", component: StubComponent },
            { path: "target-systems", component: StubComponent },
            { path: "daemons", component: StubComponent },
          ],
        },
      ],
    },
  ];

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
        { provide: DaemonsService, useValue: { registerCompleted: jest.fn() } },
        {
          provide: TargetSystemsService,
          useValue: { systems$: new BehaviorSubject<unknown[]>([]) },
        },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
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

  it("reports the active tab from the child route", async () => {
    const shell = (await harness.navigateByUrl(
      "/rotation/daemons",
      RotationShellComponent,
    )) as unknown as { activeTab: () => string | null };
    expect(shell.activeTab()).toBe("daemons");
  });

  it("navigates from the shell to the sibling create page", async () => {
    const shell = (await harness.navigateByUrl(
      "/rotation/target-systems",
      RotationShellComponent,
    )) as unknown as { createTargetSystem: () => Promise<boolean> };

    await shell.createTargetSystem();

    expect(router.url).toBe("/rotation/target-systems/new");
  });
});
