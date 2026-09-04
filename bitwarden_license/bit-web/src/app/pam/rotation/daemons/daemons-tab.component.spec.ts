import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute, Router, provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, FilterMenuComponent, ToastService } from "@bitwarden/components";

import type { AccessConnector, AccessConnectorId, TargetSystemId, TargetSystem } from "../rotation";
import { DaemonStatus } from "../rotation";
import { TargetSystemsService } from "../target-systems/target-systems.service";
import { ORGANIZATION_ID, accessConnector, connectorId, sysId } from "../testing/rotation-builders";

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

  function makeDaemonRow(overrides: Partial<DaemonRow> = {}): DaemonRow {
    return {
      id: connectorId("daemon-1"),
      name: "Test Daemon",
      statusLabelKey: "pamAccessConnectorStatusEnabled",
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

  beforeEach(async () => {
    daemonsService = {
      loading$: loading$.asObservable(),
      rows$: rows$.asObservable(),
      load: jest.fn().mockResolvedValue(undefined),
      registerCompleted: jest.fn().mockResolvedValue(undefined),
      assign: jest.fn().mockResolvedValue(undefined),
      unassign: jest.fn().mockResolvedValue(undefined),
      setEnabled: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<DaemonsService>;

    targetSystemsService = {
      activeAutomaticSystems$: of([] as TargetSystem[]),
      load: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TargetSystemsService>;

    dialogService = mock<DialogService>();
    toastService = mock<ToastService>();
    i18nService = {
      t: (key: string) => key,
    } as unknown as jest.Mocked<I18nService>;

    // Override the template to avoid CDK overlay and other browser-only concerns
    // in tests focused on component logic and service interactions.
    TestBed.overrideComponent(DaemonsTabComponent, { set: { template: "" } });

    await TestBed.configureTestingModule({
      imports: [DaemonsTabComponent],
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
      ["..", "access-connectors", connectorId("daemon-9")],
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
});

describe("DaemonsTabComponent toolbar filters", () => {
  /** The component's protected surface, as these tests read it. */
  type FiltersComp = {
    dataSource: { filteredData?: DaemonRow[] };
    searchControl: { setValue: (value: string) => void };
    statusOptions: () => { value: string; label: string }[];
    connectionOptions: () => { value: boolean; label: string }[];
  };

  let fixture: ComponentFixture<DaemonsTabComponent>;
  let component: FiltersComp;

  function makeRow(overrides: {
    id: AccessConnectorId;
    name: string;
    enabled: boolean;
    isConnected: boolean;
  }): DaemonRow {
    const { id, name, enabled, isConnected } = overrides;
    return {
      id,
      name,
      statusLabelKey: enabled
        ? "pamAccessConnectorStatusEnabled"
        : "pamAccessConnectorStatusDisabled",
      isConnected,
      assignmentNames: [],
      enabled,
      canAssign: enabled,
      daemon: accessConnector({
        id,
        name,
        status: enabled ? DaemonStatus.Enabled : DaemonStatus.Disabled,
        isConnected,
      }),
    };
  }

  const enabledConnected = makeRow({
    id: connectorId("c-1"),
    name: "Prod on-prem",
    enabled: true,
    isConnected: true,
  });
  const enabledOffline = makeRow({
    id: connectorId("c-2"),
    name: "Prod backup",
    enabled: true,
    isConnected: false,
  });
  const disabledOffline = makeRow({
    id: connectorId("c-3"),
    name: "Staging",
    enabled: false,
    isConnected: false,
  });

  /** Renders the real template, unlike the suite above — the chips are what's under test. */
  function setup(rows: DaemonRow[]) {
    TestBed.configureTestingModule({
      imports: [DaemonsTabComponent],
      providers: [
        provideRouter([]),
        {
          provide: DaemonsService,
          useValue: {
            loading$: new BehaviorSubject<boolean>(false),
            rows$: new BehaviorSubject<DaemonRow[]>(rows),
            load: jest.fn().mockResolvedValue(undefined),
            registerCompleted: jest.fn().mockResolvedValue(undefined),
            assign: jest.fn().mockResolvedValue(undefined),
            unassign: jest.fn().mockResolvedValue(undefined),
            setEnabled: jest.fn().mockResolvedValue(undefined),
            delete: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: TargetSystemsService,
          useValue: {
            activeAutomaticSystems$: of([] as TargetSystem[]),
            load: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        {
          provide: ActivatedRoute,
          useValue: { params: of({ organizationId: ORGANIZATION_ID }) },
        },
      ],
    });

    fixture = TestBed.createComponent(DaemonsTabComponent);
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
    setup([enabledConnected]);
    const search = fixture.debugElement.query(By.css("bit-search"));
    expect(search.nativeElement.className).toContain("tw-grow");
    expect(search.nativeElement.className).toContain("tw-max-w-md");
    expect(search.nativeElement.parentElement.className).toContain("tw-flex");
  });

  it("derives the status options from the loaded rows, sorted by label", () => {
    setup([enabledConnected, enabledOffline, disabledOffline]);
    expect(component.statusOptions()).toEqual([
      { value: "pamAccessConnectorStatusDisabled", label: "pamAccessConnectorStatusDisabled" },
      { value: "pamAccessConnectorStatusEnabled", label: "pamAccessConnectorStatusEnabled" },
    ]);
  });

  it("derives the connection options from the rows' liveness flag", () => {
    setup([enabledConnected, enabledOffline, disabledOffline]);
    expect(component.connectionOptions()).toEqual([
      { value: true, label: "pamAccessConnectorConnected" },
      { value: false, label: "pamAccessConnectorOffline" },
    ]);
  });

  it("leaves the chips out of the toolbar when no connectors are registered", () => {
    setup([]);
    expect(fixture.debugElement.query(By.css("bit-search"))).not.toBeNull();
    expect(fixture.debugElement.query(By.css("bit-filter-menu"))).toBeNull();
  });

  it("narrows rows to the selected status", () => {
    setup([enabledConnected, enabledOffline, disabledOffline]);
    chip("status").toggle("pamAccessConnectorStatusDisabled");
    fixture.detectChanges();
    expect(visibleIds()).toEqual([connectorId("c-3") as string]);
  });

  it("narrows rows to the offline side of the connection chip, where the value is false", () => {
    setup([enabledConnected, enabledOffline, disabledOffline]);
    chip("connection").toggle(false);
    fixture.detectChanges();
    expect(visibleIds()).toEqual(
      [connectorId("c-2") as string, connectorId("c-3") as string].sort(),
    );
  });

  it("ANDs the chips with each other and with the search text", () => {
    setup([enabledConnected, enabledOffline, disabledOffline]);
    component.searchControl.setValue("prod");
    chip("connection").toggle(false);
    fixture.detectChanges();
    expect(visibleIds()).toEqual([connectorId("c-2") as string]);
  });

  it("shows the no-results row when the chips alone empty the table", () => {
    setup([enabledConnected]);
    chip("connection").toggle(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("pamAccessConnectorNoResults");
  });
});
