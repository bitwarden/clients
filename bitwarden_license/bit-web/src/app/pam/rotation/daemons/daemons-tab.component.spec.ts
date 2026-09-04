import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { ActivatedRoute, Router, provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, ToastService } from "@bitwarden/components";

import type { AccessConnector, TargetSystemId, TargetSystem } from "../rotation";
import { TargetSystemsService } from "../target-systems/target-systems.service";
import { ORGANIZATION_ID, connectorId, sysId } from "../testing/rotation-builders";

import { DaemonsTabComponent } from "./daemons-tab.component";
import { DaemonsService, DaemonRow } from "./daemons.service";

describe("DaemonsTabComponent", () => {
  let fixture: ComponentFixture<DaemonsTabComponent>;
  let daemonsService: jest.Mocked<DaemonsService>;
  let targetSystemsService: jest.Mocked<TargetSystemsService>;
  let dialogService: jest.Mocked<DialogService>;
  let toastService: jest.Mocked<ToastService>;
  let i18nService: jest.Mocked<I18nService>;

  const rows$ = new BehaviorSubject<DaemonRow[]>([]);
  const loading$ = new BehaviorSubject<boolean>(false);
  const loadError$ = new BehaviorSubject<unknown | null>(null);
  const targetSystemsLoadError$ = new BehaviorSubject<unknown | null>(null);

  function makeDaemonRow(overrides: Partial<DaemonRow> = {}): DaemonRow {
    return {
      id: connectorId("daemon-1"),
      name: "Test Daemon",
      statusLabelKey: "pamDaemonStatusEnabled",
      isConnected: true,
      assignmentNames: [],
      enabled: true,
      canAssign: true,
      daemon: {
        id: connectorId("daemon-1"),
        name: "Test Daemon",
        assignments: [],
        status: 0,
        isConnected: true,
      } as unknown as AccessConnector,
      ...overrides,
    };
  }

  async function createComponent({ renderTemplate = false } = {}) {
    if (!renderTemplate) {
      // Override the template to avoid CDK overlay and other browser-only concerns
      // in tests focused on component logic and service interactions.
      TestBed.overrideComponent(DaemonsTabComponent, { set: { template: "" } });
    }

    await TestBed.configureTestingModule({
      imports: [DaemonsTabComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: DaemonsService, useValue: daemonsService },
        { provide: TargetSystemsService, useValue: targetSystemsService },
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: toastService },
        { provide: I18nService, useValue: i18nService },
        {
          provide: ActivatedRoute,
          useValue: { params: of({ organizationId: ORGANIZATION_ID }) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DaemonsTabComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    daemonsService = {
      loading$: loading$.asObservable(),
      loadError$: loadError$.asObservable(),
      rows$: rows$.asObservable(),
      load: jest.fn().mockResolvedValue(undefined),
      registerCompleted: jest.fn().mockResolvedValue(undefined),
      assign: jest.fn().mockResolvedValue(undefined),
      unassign: jest.fn().mockResolvedValue(undefined),
      setEnabled: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<DaemonsService>;

    targetSystemsLoadError$.next(null);
    targetSystemsService = {
      activeAutomaticSystems$: of([] as TargetSystem[]),
      loadError$: targetSystemsLoadError$.asObservable(),
      load: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TargetSystemsService>;

    dialogService = mock<DialogService>();
    toastService = mock<ToastService>();
    i18nService = {
      t: (key: string) => key,
    } as unknown as jest.Mocked<I18nService>;

    await createComponent();
  });

  it("calls daemonsService.load on init", async () => {
    expect(daemonsService.load).toHaveBeenCalledWith(ORGANIZATION_ID);
  });

  it("navigates to the daemon detail page on openDetail", async () => {
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, "navigate").mockResolvedValue(true);
    const row = makeDaemonRow({ id: connectorId("daemon-9") });

    const component = fixture.componentInstance as unknown as {
      openDetail: (row: DaemonRow) => Promise<boolean>;
    };
    await component.openDetail(row);

    expect(navigateSpy).toHaveBeenCalledWith(
      ["..", "daemons", connectorId("daemon-9")],
      expect.objectContaining({ relativeTo: expect.anything() }),
    );
  });

  it("sets the dataSource.data from the rows signal", () => {
    const row = makeDaemonRow();
    rows$.next([row]);
    fixture.detectChanges();

    const component = fixture.componentInstance as unknown as {
      dataSource: { data: DaemonRow[] };
    };
    expect(component.dataSource.data).toEqual([row]);
  });

  it("applies a name filter to the dataSource", () => {
    const component = fixture.componentInstance as unknown as {
      searchControl: { setValue: (v: string) => void };
      dataSource: { filter: ((row: DaemonRow) => boolean) | null };
    };
    component.searchControl.setValue("prod");
    fixture.detectChanges();

    // The filter function should accept rows whose name contains the search text.
    const matchRow = makeDaemonRow({ name: "production-daemon" });
    const noMatchRow = makeDaemonRow({ id: connectorId("d2"), name: "staging" });

    expect(component.dataSource.filter!(matchRow)).toBe(true);
    expect(component.dataSource.filter!(noMatchRow)).toBe(false);
  });

  it("calls daemonsService.setEnabled(false) on disable after confirmation", async () => {
    (dialogService.openSimpleDialog as jest.Mock).mockResolvedValue(true);
    const row = makeDaemonRow();

    const component = fixture.componentInstance as unknown as {
      disable: (row: DaemonRow) => Promise<void>;
    };
    await component.disable(row);

    expect(daemonsService.setEnabled).toHaveBeenCalledWith(row.daemon, false);
  });

  it("does not disable when confirmation is cancelled", async () => {
    (dialogService.openSimpleDialog as jest.Mock).mockResolvedValue(false);
    const row = makeDaemonRow();

    const component = fixture.componentInstance as unknown as {
      disable: (row: DaemonRow) => Promise<void>;
    };
    await component.disable(row);

    expect(daemonsService.setEnabled).not.toHaveBeenCalled();
  });

  it("calls daemonsService.setEnabled(true) on enable", async () => {
    const row = makeDaemonRow({ enabled: false });

    const component = fixture.componentInstance as unknown as {
      enable: (row: DaemonRow) => Promise<void>;
    };
    await component.enable(row);

    expect(daemonsService.setEnabled).toHaveBeenCalledWith(row.daemon, true);
  });

  it("calls daemonsService.delete after confirmation", async () => {
    (dialogService.openSimpleDialog as jest.Mock).mockResolvedValue(true);
    const row = makeDaemonRow();

    const component = fixture.componentInstance as unknown as {
      confirmDelete: (row: DaemonRow) => Promise<void>;
    };
    await component.confirmDelete(row);

    expect(daemonsService.delete).toHaveBeenCalledWith(row.daemon);
  });

  it("does not delete when confirmation is cancelled", async () => {
    (dialogService.openSimpleDialog as jest.Mock).mockResolvedValue(false);
    const row = makeDaemonRow();

    const component = fixture.componentInstance as unknown as {
      confirmDelete: (row: DaemonRow) => Promise<void>;
    };
    await component.confirmDelete(row);

    expect(daemonsService.delete).not.toHaveBeenCalled();
  });

  it("calls daemonsService.unassign after confirmation", async () => {
    (dialogService.openSimpleDialog as jest.Mock).mockResolvedValue(true);
    const daemon = makeDaemonRow().daemon;

    const component = fixture.componentInstance as unknown as {
      unassign: (daemon: AccessConnector, targetId: TargetSystemId, name: string) => Promise<void>;
    };
    await component.unassign(daemon, sysId("ts-1"), "Prod");

    expect(daemonsService.unassign).toHaveBeenCalledWith(daemon, sysId("ts-1"));
  });

  describe("openAssignDialog", () => {
    const activeSystem = { id: sysId("ts-1"), name: "Prod DB" } as unknown as TargetSystem;

    function daemonWithAssignments(...ids: TargetSystemId[]): DaemonRow {
      const row = makeDaemonRow();
      return {
        ...row,
        daemon: { ...row.daemon, assignedTargetSystemIds: ids } as unknown as AccessConnector,
      };
    }

    async function openWith(systems: TargetSystem[], row: DaemonRow): Promise<void> {
      TestBed.resetTestingModule();
      targetSystemsService = {
        activeAutomaticSystems$: of(systems),
        loadError$: targetSystemsLoadError$.asObservable(),
        load: jest.fn().mockResolvedValue(undefined),
      } as unknown as jest.Mocked<TargetSystemsService>;
      await createComponent();

      (dialogService.open as jest.Mock).mockReturnValue({ closed: of(undefined) });
      const component = fixture.componentInstance as unknown as {
        openAssignDialog: (row: DaemonRow) => Promise<void>;
      };
      await component.openAssignDialog(row);
    }

    function dialogData(): { options: TargetSystem[]; noActiveAutomaticSystems: boolean } {
      return (dialogService.open as jest.Mock).mock.calls[0][1].data;
    }

    it("flags that the org has no active automatic target system", async () => {
      await openWith([], daemonWithAssignments());

      expect(dialogData().options).toEqual([]);
      expect(dialogData().noActiveAutomaticSystems).toBe(true);
    });

    it("does not flag when the only active system is already assigned to this daemon", async () => {
      await openWith([activeSystem], daemonWithAssignments(activeSystem.id));

      expect(dialogData().options).toEqual([]);
      expect(dialogData().noActiveAutomaticSystems).toBe(false);
    });

    it("surfaces the error instead of opening the dialog when the target-systems load failed", async () => {
      targetSystemsLoadError$.next(new Error("boom"));

      await openWith([], daemonWithAssignments());

      expect(dialogService.open).not.toHaveBeenCalled();
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
    });
  });

  describe("load error state", () => {
    beforeEach(async () => {
      TestBed.resetTestingModule();
      loadError$.next(null);
      rows$.next([]);
      loading$.next(false);

      await createComponent({ renderTemplate: true });
    });

    afterEach(() => {
      loadError$.next(null);
    });

    it("renders the load-error state instead of the empty state", () => {
      loadError$.next(new Error("boom"));
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector("pam-rotation-load-error")).not.toBeNull();
      expect(el.textContent).toContain("pamRotationListLoadErrorTitle");
      expect(el.textContent).not.toContain("pamDaemonEmptyStateTitle");
    });

    it("retries both loads from the error state", async () => {
      loadError$.next(new Error("boom"));
      fixture.detectChanges();
      (daemonsService.load as jest.Mock).mockClear();
      (targetSystemsService.load as jest.Mock).mockClear();

      (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLButtonElement>("#rotation-load-error_button_retry")!
        .click();
      await fixture.whenStable();

      expect(daemonsService.load).toHaveBeenCalledWith(ORGANIZATION_ID);
      expect(targetSystemsService.load).toHaveBeenCalledWith(ORGANIZATION_ID);
    });
  });
});
