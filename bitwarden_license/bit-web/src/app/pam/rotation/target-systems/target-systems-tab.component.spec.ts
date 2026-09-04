import { ComponentFixture, TestBed, fakeAsync, tick, flushMicrotasks } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { ActivatedRoute, Router, provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, FilterMenuComponent, ToastService } from "@bitwarden/components";

import { DaemonsService } from "../daemons/daemons.service";
import { DaemonStatus, type AccessConnector, type TargetSystem } from "../rotation";
import { TargetSystemKind, TargetSystemMethod, TargetSystemStatus } from "../rotation";
import { accessConnector, connectorId, ORGANIZATION_ID, sysId } from "../testing/rotation-builders";

import { TargetSystemRow, TargetSystemsTabComponent } from "./target-systems-tab.component";
import { TargetSystemsService } from "./target-systems.service";

/** Echoes the key as its translation so form-field components don't crash. */
const i18nFake: Pick<I18nService, "t" | "translate"> = {
  t: (id: string) => id,
  translate: (id: string) => id,
};

function makeSystem(overrides: Partial<TargetSystem> = {}): TargetSystem {
  return {
    id: sysId("sys-1"),
    name: "Prod Entra",
    method: TargetSystemMethod.Automatic,
    kind: TargetSystemKind.Entra,
    status: TargetSystemStatus.Active,
    passwordPolicy: null,
    supportsSessionTermination: true,
    ...overrides,
  } as TargetSystem;
}

describe("TargetSystemsTabComponent", () => {
  let fixture: ComponentFixture<TargetSystemsTabComponent>;
  let component: TargetSystemsTabComponent;
  let targetSystemsService: {
    loading$: BehaviorSubject<boolean>;
    systems$: BehaviorSubject<TargetSystem[]>;
    systemById$: BehaviorSubject<Map<string, TargetSystem>>;
    activeAutomaticSystems$: BehaviorSubject<TargetSystem[]>;
    load: jest.Mock;
    setEnabled: jest.Mock;
    delete: jest.Mock;
  };
  let daemonsService: {
    daemons$: BehaviorSubject<AccessConnector[]>;
    forgetTargetSystem: jest.Mock;
    assign: jest.Mock;
  };
  let router: Router;
  let dialogService: ReturnType<typeof mock<DialogService>>;
  let toastService: ReturnType<typeof mock<ToastService>>;

  beforeEach(async () => {
    targetSystemsService = {
      loading$: new BehaviorSubject<boolean>(false),
      systems$: new BehaviorSubject<TargetSystem[]>([]),
      systemById$: new BehaviorSubject(new Map()),
      activeAutomaticSystems$: new BehaviorSubject<TargetSystem[]>([]),
      load: jest.fn().mockResolvedValue(undefined),
      setEnabled: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    daemonsService = {
      daemons$: new BehaviorSubject<AccessConnector[]>([]),
      forgetTargetSystem: jest.fn(),
      assign: jest.fn().mockResolvedValue(undefined),
    };
    dialogService = mock<DialogService>();
    dialogService.openSimpleDialog.mockResolvedValue(false);
    toastService = mock<ToastService>();

    // Override the template AND imports to avoid pulling in HeaderModule → SharedModule → DialogModule
    // which would provide a real DialogService, overriding our test mock.
    // Must come before configureTestingModule.
    TestBed.overrideComponent(TargetSystemsTabComponent, { set: { template: "", imports: [] } });

    await TestBed.configureTestingModule({
      imports: [TargetSystemsTabComponent, ReactiveFormsModule, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: TargetSystemsService, useValue: targetSystemsService },
        { provide: DaemonsService, useValue: daemonsService },
        { provide: I18nService, useValue: i18nFake },
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: toastService },
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({ organizationId: ORGANIZATION_ID }),
            snapshot: { params: { organizationId: ORGANIZATION_ID } },
          },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(TargetSystemsTabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it("calls load with the organization id on init", () => {
    expect(targetSystemsService.load).toHaveBeenCalledWith(ORGANIZATION_ID);
  });

  it("navigates to the create page on openCreate", async () => {
    const navigateSpy = jest.spyOn(router, "navigate").mockResolvedValue(true);
    await (component as unknown as { openCreate: () => Promise<boolean> }).openCreate();
    expect(navigateSpy).toHaveBeenCalledWith(
      ["..", "target-systems", "new"],
      expect.objectContaining({ relativeTo: expect.anything() }),
    );
  });

  it("navigates to the create page with a template query param on openFromTemplate", async () => {
    const navigateSpy = jest.spyOn(router, "navigate").mockResolvedValue(true);
    await (
      component as unknown as { openFromTemplate: (k: string) => Promise<boolean> }
    ).openFromTemplate("entra");
    expect(navigateSpy).toHaveBeenCalledWith(
      ["..", "target-systems", "new"],
      expect.objectContaining({ queryParams: { template: "entra" } }),
    );
  });

  it("navigates to edit page on openEdit", async () => {
    const sys = makeSystem({ id: sysId("sys-edit") });
    const navigateSpy = jest.spyOn(router, "navigate").mockResolvedValue(true);
    await (component as unknown as { openEdit: (s: TargetSystem) => Promise<boolean> }).openEdit(
      sys,
    );
    expect(navigateSpy).toHaveBeenCalledWith(
      ["..", "target-systems", sysId("sys-edit")],
      expect.objectContaining({ relativeTo: expect.anything() }),
    );
  });

  describe("disable action", () => {
    it("calls setEnabled(false) after confirmation", fakeAsync(() => {
      const sys = makeSystem({ id: sysId("sys-1"), status: TargetSystemStatus.Active });
      dialogService.openSimpleDialog.mockResolvedValue(true);

      const comp = component as unknown as {
        disable: (s: TargetSystem) => Promise<void>;
      };
      void comp.disable(sys);
      tick();

      expect(targetSystemsService.setEnabled).toHaveBeenCalledWith(sys, false);
    }));

    it("does not call setEnabled when confirmation is cancelled", fakeAsync(() => {
      const sys = makeSystem({ id: sysId("sys-1"), status: TargetSystemStatus.Active });
      dialogService.openSimpleDialog.mockResolvedValue(false);

      const comp = component as unknown as {
        disable: (s: TargetSystem) => Promise<void>;
      };
      void comp.disable(sys);
      flushMicrotasks();

      expect(targetSystemsService.setEnabled).not.toHaveBeenCalled();
    }));

    it("shows success toast after disabling", fakeAsync(() => {
      const sys = makeSystem({ id: sysId("sys-1"), status: TargetSystemStatus.Active });
      dialogService.openSimpleDialog.mockResolvedValue(true);

      const comp = component as unknown as {
        disable: (s: TargetSystem) => Promise<void>;
      };
      void comp.disable(sys);
      flushMicrotasks();

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    }));
  });

  describe("enable action", () => {
    it("calls setEnabled(true)", async () => {
      const sys = makeSystem({ id: sysId("sys-1"), status: TargetSystemStatus.Disabled });

      const comp = component as unknown as {
        enable: (s: TargetSystem) => Promise<void>;
      };
      await comp.enable(sys);

      expect(targetSystemsService.setEnabled).toHaveBeenCalledWith(sys, true);
    });

    it("shows success toast after enabling", async () => {
      const sys = makeSystem({ id: sysId("sys-1"), status: TargetSystemStatus.Disabled });

      const comp = component as unknown as {
        enable: (s: TargetSystem) => Promise<void>;
      };
      await comp.enable(sys);

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    });
  });

  describe("delete action", () => {
    type DeleteComp = { confirmDelete: (s: TargetSystem) => Promise<void> };

    it("deletes after confirmation and shows a success toast", fakeAsync(() => {
      const sys = makeSystem({ id: sysId("sys-1") });
      dialogService.openSimpleDialog.mockResolvedValue(true);

      void (component as unknown as DeleteComp).confirmDelete(sys);
      flushMicrotasks();

      expect(targetSystemsService.delete).toHaveBeenCalledWith(sys);
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    }));

    it("confirms with a danger dialog naming the target system", fakeAsync(() => {
      const sys = makeSystem({ id: sysId("sys-1"), name: "Prod Entra" });
      dialogService.openSimpleDialog.mockResolvedValue(true);

      void (component as unknown as DeleteComp).confirmDelete(sys);
      flushMicrotasks();

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "danger",
          content: { key: "pamTargetSystemDeleteContent", placeholders: ["Prod Entra"] },
        }),
      );
    }));

    it("does not delete when confirmation is cancelled", fakeAsync(() => {
      const sys = makeSystem({ id: sysId("sys-1") });
      dialogService.openSimpleDialog.mockResolvedValue(false);

      void (component as unknown as DeleteComp).confirmDelete(sys);
      flushMicrotasks();

      expect(targetSystemsService.delete).not.toHaveBeenCalled();
      expect(daemonsService.forgetTargetSystem).not.toHaveBeenCalled();
    }));

    it("prunes the deleted target from daemon assignments", fakeAsync(() => {
      const sys = makeSystem({ id: sysId("sys-1") });
      dialogService.openSimpleDialog.mockResolvedValue(true);

      void (component as unknown as DeleteComp).confirmDelete(sys);
      flushMicrotasks();

      expect(daemonsService.forgetTargetSystem).toHaveBeenCalledWith(sysId("sys-1"));
    }));

    it("surfaces an error toast and leaves daemon assignments alone when the server refuses", fakeAsync(() => {
      const sys = makeSystem({ id: sysId("sys-1") });
      dialogService.openSimpleDialog.mockResolvedValue(true);
      targetSystemsService.delete.mockRejectedValue(new Error("target system in use"));

      void (component as unknown as DeleteComp).confirmDelete(sys);
      flushMicrotasks();

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
      expect(daemonsService.forgetTargetSystem).not.toHaveBeenCalled();
    }));
  });

  describe("canAssignConnectors row flag", () => {
    it("is true only for an active, automatic-method target", () => {
      targetSystemsService.systems$.next([
        makeSystem({
          id: sysId("sys-active-automatic"),
          status: TargetSystemStatus.Active,
          method: TargetSystemMethod.Automatic,
        }),
        makeSystem({
          id: sysId("sys-disabled-automatic"),
          status: TargetSystemStatus.Disabled,
          method: TargetSystemMethod.Automatic,
        }),
        makeSystem({
          id: sysId("sys-active-manual"),
          status: TargetSystemStatus.Active,
          method: TargetSystemMethod.Manual,
        }),
      ]);
      fixture.detectChanges();

      const rows = (component as unknown as { dataSource: { data: TargetSystemRow[] } }).dataSource
        .data;

      expect(rows.find((r) => r.id === sysId("sys-active-automatic"))?.canAssignConnectors).toBe(
        true,
      );
      expect(rows.find((r) => r.id === sysId("sys-disabled-automatic"))?.canAssignConnectors).toBe(
        false,
      );
      expect(rows.find((r) => r.id === sysId("sys-active-manual"))?.canAssignConnectors).toBe(
        false,
      );
    });
  });

  describe("openAssignConnectorDialog", () => {
    type AssignComp = { openAssignConnectorDialog: (s: TargetSystem) => Promise<void> };

    it("assigns the selected connector and shows a success toast", fakeAsync(() => {
      const sys = makeSystem({ id: sysId("sys-1") });
      const connector = accessConnector({ id: connectorId("c-1"), status: DaemonStatus.Enabled });
      daemonsService.daemons$.next([connector]);
      dialogService.open.mockReturnValue({ closed: of(connectorId("c-1")) } as any);

      void (component as unknown as AssignComp).openAssignConnectorDialog(sys);
      flushMicrotasks();

      expect(daemonsService.assign).toHaveBeenCalledWith(connector, sys.id);
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    }));

    it("does not assign when the dialog is dismissed", fakeAsync(() => {
      const sys = makeSystem({ id: sysId("sys-1") });
      dialogService.open.mockReturnValue({ closed: of(undefined) } as any);

      void (component as unknown as AssignComp).openAssignConnectorDialog(sys);
      flushMicrotasks();

      expect(daemonsService.assign).not.toHaveBeenCalled();
    }));

    it("excludes connectors already assigned to this target and disabled connectors from the options", fakeAsync(() => {
      const sys = makeSystem({ id: sysId("sys-1") });
      const alreadyAssigned = accessConnector({
        id: connectorId("c-assigned"),
        status: DaemonStatus.Enabled,
        assignedTargetSystemIds: [sys.id],
      });
      const disabled = accessConnector({
        id: connectorId("c-disabled"),
        status: DaemonStatus.Disabled,
      });
      const available = accessConnector({
        id: connectorId("c-available"),
        status: DaemonStatus.Enabled,
      });
      daemonsService.daemons$.next([alreadyAssigned, disabled, available]);
      dialogService.open.mockReturnValue({ closed: of(undefined) } as any);

      void (component as unknown as AssignComp).openAssignConnectorDialog(sys);
      flushMicrotasks();

      expect(dialogService.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({ options: [available] }),
        }),
      );
    }));
  });
});

describe("TargetSystemsTabComponent toolbar filters", () => {
  /** The component's protected surface, as these tests read it. */
  type FiltersComp = {
    dataSource: { filteredData?: TargetSystemRow[] };
    searchControl: { setValue: (value: string) => void };
    methodOptions: () => { value: string; label: string }[];
    kindOptions: () => { value: string; label: string }[];
    statusOptions: () => { value: string; label: string }[];
  };

  let fixture: ComponentFixture<TargetSystemsTabComponent>;
  let component: FiltersComp;

  const entraActive = makeSystem({
    id: sysId("1"),
    name: "Prod Entra",
    method: TargetSystemMethod.Automatic,
    kind: TargetSystemKind.Entra,
    status: TargetSystemStatus.Active,
  });
  const mssqlDisabled = makeSystem({
    id: sysId("2"),
    name: "Prod SQL reporting",
    method: TargetSystemMethod.Automatic,
    kind: TargetSystemKind.Mssql,
    status: TargetSystemStatus.Disabled,
  });
  const manualActive = makeSystem({
    id: sysId("3"),
    name: "Mainframe payroll",
    method: TargetSystemMethod.Manual,
    kind: null,
    status: TargetSystemStatus.Active,
  });

  /** Renders the real template, unlike the suite above — the chips are what's under test. */
  function setup(systems: TargetSystem[]) {
    TestBed.configureTestingModule({
      imports: [TargetSystemsTabComponent, ReactiveFormsModule, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        {
          provide: TargetSystemsService,
          useValue: {
            loading$: new BehaviorSubject<boolean>(false),
            systems$: new BehaviorSubject<TargetSystem[]>(systems),
            systemById$: new BehaviorSubject(new Map()),
            activeAutomaticSystems$: new BehaviorSubject<TargetSystem[]>([]),
            load: jest.fn().mockResolvedValue(undefined),
            setEnabled: jest.fn().mockResolvedValue(undefined),
            delete: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: DaemonsService,
          useValue: {
            daemons$: new BehaviorSubject<AccessConnector[]>([]),
            forgetTargetSystem: jest.fn(),
            assign: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: I18nService, useValue: i18nFake },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        {
          provide: ActivatedRoute,
          useValue: { params: of({ organizationId: ORGANIZATION_ID }) },
        },
      ],
    });

    fixture = TestBed.createComponent(TargetSystemsTabComponent);
    component = fixture.componentInstance as unknown as FiltersComp;
    fixture.detectChanges();
  }

  function chip(key: string): FilterMenuComponent {
    return fixture.debugElement.query(By.css(`bit-filter-menu[key="${key}"]`)).componentInstance;
  }

  function visibleIds(): string[] {
    return (component.dataSource.filteredData ?? []).map((row) => row.id as string).sort();
  }

  it("caps the search by making it a flex item, not a block child", () => {
    setup([entraActive]);
    const search = fixture.debugElement.query(By.css("bit-search"));
    expect(search.nativeElement.className).toContain("tw-grow");
    expect(search.nativeElement.className).toContain("tw-max-w-md");
    expect(search.nativeElement.parentElement.className).toContain("tw-flex");
  });

  it("derives the method options from the loaded rows, sorted by label", () => {
    setup([entraActive, mssqlDisabled, manualActive]);
    expect(component.methodOptions()).toEqual([
      { value: TargetSystemMethod.Automatic, label: "pamTargetSystemMethodAutomatic" },
      { value: TargetSystemMethod.Manual, label: "pamTargetSystemMethodManual" },
    ]);
  });

  it("derives the status options from the loaded rows, sorted by label", () => {
    setup([entraActive, mssqlDisabled, manualActive]);
    expect(component.statusOptions()).toEqual([
      { value: TargetSystemStatus.Active, label: "pamTargetSystemStatusActive" },
      { value: TargetSystemStatus.Disabled, label: "pamTargetSystemStatusDisabled" },
    ]);
  });

  it("leaves a manual target out of the kind options, since it has no kind", () => {
    setup([entraActive, mssqlDisabled, manualActive]);
    expect(component.kindOptions()).toEqual([
      { value: TargetSystemKind.Entra, label: "pamTargetSystemKindEntra" },
      { value: TargetSystemKind.Mssql, label: "pamTargetSystemKindMssql" },
    ]);
  });

  it("does not render the kind chip when no loaded target carries a kind", () => {
    setup([manualActive]);
    expect(fixture.debugElement.query(By.css('bit-filter-menu[key="kind"]'))).toBeNull();
  });

  it("narrows rows to the selected method", () => {
    setup([entraActive, mssqlDisabled, manualActive]);
    chip("method").toggle(TargetSystemMethod.Manual);
    fixture.detectChanges();
    expect(visibleIds()).toEqual([sysId("3") as string]);
  });

  it("narrows rows to the selected kind", () => {
    setup([entraActive, mssqlDisabled, manualActive]);
    chip("kind").toggle(TargetSystemKind.Mssql);
    fixture.detectChanges();
    expect(visibleIds()).toEqual([sysId("2") as string]);
  });

  it("narrows rows to the selected status", () => {
    setup([entraActive, mssqlDisabled, manualActive]);
    chip("status").toggle(TargetSystemStatus.Disabled);
    fixture.detectChanges();
    expect(visibleIds()).toEqual([sysId("2") as string]);
  });

  it("ANDs the chips with each other and with the search text", () => {
    setup([entraActive, mssqlDisabled, manualActive]);
    component.searchControl.setValue("prod");
    chip("status").toggle(TargetSystemStatus.Active);
    fixture.detectChanges();
    expect(visibleIds()).toEqual([sysId("1") as string]);
  });

  it("shows the no-results row when the chips alone empty the table", () => {
    setup([entraActive]);
    chip("status").toggle(TargetSystemStatus.Disabled);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("pamTargetSystemNoResults");
  });
});
