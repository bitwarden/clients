import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { RotationDaemonResponse, TargetSystemResponse } from "@bitwarden/bit-pam";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { TargetSystemsService } from "../target-systems/target-systems.service";

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
      id: "daemon-1",
      name: "Test Daemon",
      statusLabelKey: "pamDaemonStatusEnrolled",
      isConnected: true,
      assignmentNames: [],
      canRevoke: true,
      canAssign: true,
      daemon: {
        id: "daemon-1",
        name: "Test Daemon",
        assignments: [],
        status: 0,
        isConnected: true,
      } as unknown as RotationDaemonResponse,
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
      revoke: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<DaemonsService>;

    targetSystemsService = {
      activeAutomaticSystems$: of([] as TargetSystemResponse[]),
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
        { provide: DaemonsService, useValue: daemonsService },
        { provide: TargetSystemsService, useValue: targetSystemsService },
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: toastService },
        { provide: I18nService, useValue: i18nService },
        {
          provide: ActivatedRoute,
          useValue: { params: of({ organizationId: "org-1" }) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DaemonsTabComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it("calls daemonsService.load on init", async () => {
    expect(daemonsService.load).toHaveBeenCalledWith("org-1");
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
    const noMatchRow = makeDaemonRow({ id: "d2", name: "staging" });

    expect(component.dataSource.filter!(matchRow)).toBe(true);
    expect(component.dataSource.filter!(noMatchRow)).toBe(false);
  });

  it("calls daemonsService.revoke after confirmation", async () => {
    (dialogService.openSimpleDialog as jest.Mock).mockResolvedValue(true);
    const row = makeDaemonRow();

    const component = fixture.componentInstance as unknown as {
      revoke: (row: DaemonRow) => Promise<void>;
    };
    await component.revoke(row);

    expect(daemonsService.revoke).toHaveBeenCalledWith(row.daemon);
  });

  it("does not call daemonsService.revoke when revoke confirmation is cancelled", async () => {
    (dialogService.openSimpleDialog as jest.Mock).mockResolvedValue(false);
    const row = makeDaemonRow();

    const component = fixture.componentInstance as unknown as {
      revoke: (row: DaemonRow) => Promise<void>;
    };
    await component.revoke(row);

    expect(daemonsService.revoke).not.toHaveBeenCalled();
  });

  it("calls daemonsService.unassign after confirmation", async () => {
    (dialogService.openSimpleDialog as jest.Mock).mockResolvedValue(true);
    const daemon = makeDaemonRow().daemon;

    const component = fixture.componentInstance as unknown as {
      unassign: (daemon: RotationDaemonResponse, targetId: string, name: string) => Promise<void>;
    };
    await component.unassign(daemon, "ts-1", "Prod");

    expect(daemonsService.unassign).toHaveBeenCalledWith(daemon, "ts-1");
  });
});
