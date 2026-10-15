import { ChangeDetectionStrategy, Component, NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { ActivatedRoute, provideRouter, Route, Router, Routes } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import { AccessConnectorsService } from "./access-connectors/access-connectors.service";
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

/** The ids the per-tab create buttons carried before the Add menu, which no longer render. */
const CREATE_BUTTON_ID = {
  "access-connectors": "rotation-shell_button_new-access-connector",
  "target-systems": "rotation-shell_button_new-target-system",
  "managed-credentials": "rotation-shell_button_new-managed-credential",
} as const;

describe("RotationShellComponent", () => {
  let fixture: ComponentFixture<RotationShellComponent>;
  let awaitingManualCount$: BehaviorSubject<number>;
  let loadMock: jest.Mock;
  let accessConnectorsService: { registerCompleted: jest.Mock };
  let dialogService: ReturnType<typeof mock<DialogService>>;
  let toastService: ReturnType<typeof mock<ToastService>>;

  const ORG_ID = "org-abc-123";

  beforeEach(async () => {
    awaitingManualCount$ = new BehaviorSubject<number>(0);
    loadMock = jest.fn().mockResolvedValue(undefined);
    accessConnectorsService = { registerCompleted: jest.fn().mockResolvedValue(undefined) };
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
        { provide: AccessConnectorsService, useValue: accessConnectorsService },
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
    expect(subtitle?.textContent?.trim()).toBe("pamRotationSubtitleManage");
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

  it("navigates to the managed-credential create page on createManagedCredential", async () => {
    await init();
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, "navigate").mockResolvedValue(true);

    await (
      fixture.componentInstance as unknown as { createManagedCredential: () => Promise<boolean> }
    ).createManagedCredential();

    expect(navigateSpy).toHaveBeenCalledWith(
      ["managed-credentials", "new"],
      expect.objectContaining({ relativeTo: expect.anything() }),
    );
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

  it("refreshes accessConnectors and toasts after a successful registration", async () => {
    await init();
    dialogService.open.mockReturnValue({ closed: of(true) } as never);

    await (
      fixture.componentInstance as unknown as { registerAccessConnector: () => Promise<void> }
    ).registerAccessConnector();

    expect(accessConnectorsService.registerCompleted).toHaveBeenCalledWith(ORG_ID);
    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" }),
    );
  });

  it("does not refresh accessConnectors when registration is canceled", async () => {
    await init();
    dialogService.open.mockReturnValue({ closed: of(undefined) } as never);

    await (
      fixture.componentInstance as unknown as { registerAccessConnector: () => Promise<void> }
    ).registerAccessConnector();

    expect(accessConnectorsService.registerCompleted).not.toHaveBeenCalled();
    expect(toastService.showToast).not.toHaveBeenCalled();
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
      providers: undefined as Route["providers"],
      canDeactivate: undefined as Route["canDeactivate"],
      ...(route.component && route.component !== RotationShellComponent
        ? { component: StubComponent }
        : {}),
      ...(route.children ? { children: stubEveryComponentButTheShell(route.children) } : {}),
    }));

  const routes: Routes = [
    { path: "rotation", children: stubEveryComponentButTheShell(rotationRoutes) },
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
        { provide: AccessConnectorsService, useValue: { registerCompleted: jest.fn() } },
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

  const renderHeader = async (tab: keyof typeof CREATE_BUTTON_ID): Promise<HTMLElement> => {
    await harness.navigateByUrl(`/rotation/${tab}`, RotationShellComponent);
    harness.detectChanges();
    return harness.fixture.nativeElement.querySelector("app-header") as HTMLElement;
  };

  it("lands on the access connectors tab from the shell's bare path", async () => {
    await harness.navigateByUrl("/rotation", RotationShellComponent);
    expect(router.url).toBe("/rotation/access-connectors");
  });

  it.each(["access-connectors", "target-systems", "managed-credentials"])(
    "keeps the page description on the %s tab",
    async (tab) => {
      await harness.navigateByUrl(`/rotation/${tab}`, RotationShellComponent);
      harness.detectChanges();

      const subtitle = harness.routeNativeElement?.querySelector('[slot="subtitle"]');
      expect(subtitle?.textContent?.trim()).toBe("pamRotationSubtitleManage");
    },
  );

  it("navigates from the shell to the sibling create page", async () => {
    const shell = (await harness.navigateByUrl(
      "/rotation/target-systems",
      RotationShellComponent,
    )) as unknown as { createTargetSystem: () => Promise<boolean> };

    await shell.createTargetSystem();

    expect(router.url).toBe("/rotation/target-systems/new");
  });

  it("navigates from the shell to the sibling managed-credential create page", async () => {
    const shell = (await harness.navigateByUrl(
      "/rotation/managed-credentials",
      RotationShellComponent,
    )) as unknown as { createManagedCredential: () => Promise<boolean> };

    await shell.createManagedCredential();

    expect(router.url).toBe("/rotation/managed-credentials/new");
  });

  describe("create action placement", () => {
    const tabs = Object.keys(CREATE_BUTTON_ID) as (keyof typeof CREATE_BUTTON_ID)[];

    it.each(tabs)("renders no %s create button anywhere in the shell", async (tab) => {
      await renderHeader(tab);

      expect(harness.fixture.nativeElement.querySelector(`#${CREATE_BUTTON_ID[tab]}`)).toBeNull();
    });

    it.each(tabs)("keeps the %s tab nav bar in the header", async (tab) => {
      const header = await renderHeader(tab);

      expect(header.querySelector("bit-tab-nav-bar")).not.toBeNull();
      expect(header.querySelectorAll("bit-tab-link")).toHaveLength(3);
    });

    describe("Add menu", () => {
      const ADD_BUTTON = "#rotation-shell_button_add";

      const openMenu = async (tab: keyof typeof CREATE_BUTTON_ID): Promise<HTMLButtonElement[]> => {
        const header = await renderHeader(tab);
        header.querySelector<HTMLButtonElement>(ADD_BUTTON)!.click();
        harness.detectChanges();
        const panels = document.querySelectorAll<HTMLElement>(".bit-menu-panel");
        return Array.from(
          panels[panels.length - 1].querySelectorAll<HTMLButtonElement>("[bitmenuitem]"),
        );
      };

      it.each(tabs)(
        "offers one primary Add button with the plus icon on the %s tab",
        async (tab) => {
          const header = await renderHeader(tab);

          const buttons = header.querySelectorAll<HTMLButtonElement>(ADD_BUTTON);
          expect(buttons).toHaveLength(1);
          expect(buttons[0].textContent?.trim()).toBe("add");
          expect(buttons[0].querySelector(".bwi-plus")).not.toBeNull();
        },
      );

      it.each(tabs)("lists the same three options, in order, on the %s tab", async (tab) => {
        const items = await openMenu(tab);

        expect(items.map((item) => item.textContent?.trim())).toEqual([
          "pamRotationAddManagedCredential",
          "pamRotationAddTargetSystem",
          "pamRotationAddAccessConnector",
        ]);
      });

      it.each(tabs)("shows the Add button on an empty %s tab too", async (tab) => {
        const header = await renderHeader(tab);

        expect(header.querySelector(ADD_BUTTON)).not.toBeNull();
      });

      it("opens the managed credential create page from its item", async () => {
        const navigate = jest.spyOn(router, "navigate");
        const [managedCredential] = await openMenu("access-connectors");

        managedCredential.click();

        expect(navigate).toHaveBeenCalledWith(
          ["managed-credentials", "new"],
          expect.objectContaining({ relativeTo: expect.anything() }),
        );
      });

      it("opens the target system create page from its item", async () => {
        const navigate = jest.spyOn(router, "navigate");
        const [, targetSystem] = await openMenu("managed-credentials");

        targetSystem.click();

        expect(navigate).toHaveBeenCalledWith(
          ["target-systems", "new"],
          expect.objectContaining({ relativeTo: expect.anything() }),
        );
      });

      it("opens the access connector registration dialog from its item", async () => {
        const dialogService = TestBed.inject(DialogService) as ReturnType<
          typeof mock<DialogService>
        >;
        dialogService.open.mockReturnValue({ closed: of(false) } as never);
        const [, , accessConnector] = await openMenu("target-systems");

        accessConnector.click();

        expect(dialogService.open).toHaveBeenCalled();
      });
    });
  });
});
