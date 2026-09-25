import { OverlayContainer } from "@angular/cdk/overlay";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { ActivatedRoute, Router, provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, FilterMenuComponent, ToastService } from "@bitwarden/components";

import type { AccessConnector, AccessConnectorId, TargetSystemId, TargetSystem } from "../rotation";
import { AccessConnectorStatus } from "../rotation";
import { TargetSystemsService } from "../target-systems/target-systems.service";
import { deferred } from "../testing/deferred";
import { ORGANIZATION_ID, accessConnector, connectorId, sysId } from "../testing/rotation-builders";

import { AccessConnectorsTabComponent } from "./access-connectors-tab.component";
import { AccessConnectorsService, AccessConnectorRow } from "./access-connectors.service";

function vfo1ConfigService(enabled: boolean): ReturnType<typeof mock<ConfigService>> {
  const configService = mock<ConfigService>();
  configService.getFeatureFlag$.mockReturnValue(of(enabled));
  return configService;
}

describe("AccessConnectorsTabComponent", () => {
  let fixture: ComponentFixture<AccessConnectorsTabComponent>;
  let accessConnectorsService: jest.Mocked<AccessConnectorsService>;
  let targetSystemsService: jest.Mocked<TargetSystemsService>;
  let dialogService: jest.Mocked<DialogService>;
  let toastService: jest.Mocked<ToastService>;
  let i18nService: jest.Mocked<I18nService>;

  const rows$ = new BehaviorSubject<AccessConnectorRow[]>([]);
  const loading$ = new BehaviorSubject<boolean>(false);
  const loadError$ = new BehaviorSubject<unknown | null>(null);
  const targetSystemsLoadError$ = new BehaviorSubject<unknown | null>(null);

  function makeAccessConnectorRow(overrides: Partial<AccessConnectorRow> = {}): AccessConnectorRow {
    const id = overrides.id ?? connectorId("access-connector-1");
    const name = overrides.name ?? "Test access connector";
    return {
      id,
      name,
      statusLabelKey: "pamAccessConnectorStatusActive",
      isConnected: true,
      assignmentNames: [],
      enabled: true,
      canAssign: true,
      ...overrides,
      accessConnector: accessConnector({
        id,
        name,
        isConnected: true,
        ...(overrides.accessConnector ?? {}),
      }),
    };
  }

  async function createComponent({ renderTemplate = false } = {}) {
    if (!renderTemplate) {
      TestBed.overrideComponent(AccessConnectorsTabComponent, { set: { template: "" } });
    }

    await TestBed.configureTestingModule({
      imports: [AccessConnectorsTabComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: AccessConnectorsService, useValue: accessConnectorsService },
        { provide: TargetSystemsService, useValue: targetSystemsService },
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: toastService },
        { provide: I18nService, useValue: i18nService },
        { provide: ConfigService, useValue: vfo1ConfigService(false) },
        {
          provide: ActivatedRoute,
          useValue: { params: of({ organizationId: ORGANIZATION_ID }) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AccessConnectorsTabComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    accessConnectorsService = {
      loading$: loading$.asObservable(),
      loadError$: loadError$.asObservable(),
      rows$: rows$.asObservable(),
      load: jest.fn().mockResolvedValue(undefined),
      registerCompleted: jest.fn().mockResolvedValue(undefined),
      assign: jest.fn().mockResolvedValue(undefined),
      unassign: jest.fn().mockResolvedValue(undefined),
      setEnabled: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AccessConnectorsService>;

    targetSystemsLoadError$.next(null);
    targetSystemsService = {
      automaticSystems$: of([] as TargetSystem[]),
      loading$: of(false),
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

  it("calls accessConnectorsService.load on init", async () => {
    expect(accessConnectorsService.load).toHaveBeenCalledWith(ORGANIZATION_ID);
  });

  it("navigates to the accessConnector detail page on openDetail", async () => {
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, "navigate").mockResolvedValue(true);
    const row = makeAccessConnectorRow({ id: connectorId("access-connector-9") });

    const component = fixture.componentInstance as unknown as {
      openDetail: (row: AccessConnectorRow) => Promise<boolean>;
    };
    await component.openDetail(row);

    expect(navigateSpy).toHaveBeenCalledWith(
      ["..", "access-connectors", connectorId("access-connector-9")],
      expect.objectContaining({ relativeTo: expect.anything() }),
    );
  });

  it("sets the dataSource.data from the rows signal", () => {
    const row = makeAccessConnectorRow();
    rows$.next([row]);
    fixture.detectChanges();

    const component = fixture.componentInstance as unknown as {
      dataSource: { data: AccessConnectorRow[] };
    };
    expect(component.dataSource.data).toEqual([
      { ...row, assignTargetsBlockedKey: "pamAccessConnectorAssignNoTargetSystems" },
    ]);
  });

  it("applies a name filter to the dataSource", () => {
    const component = fixture.componentInstance as unknown as {
      searchControl: { setValue: (v: string) => void };
      dataSource: { filter: ((row: AccessConnectorRow) => boolean) | null };
    };
    component.searchControl.setValue("prod");
    fixture.detectChanges();

    // The filter function should accept rows whose name contains the search text.
    const matchRow = makeAccessConnectorRow({ name: "production-access-connector" });
    const noMatchRow = makeAccessConnectorRow({ id: connectorId("d2"), name: "staging" });

    expect(component.dataSource.filter!(matchRow)).toBe(true);
    expect(component.dataSource.filter!(noMatchRow)).toBe(false);
  });

  it("calls accessConnectorsService.setEnabled(false) on disable after confirmation", async () => {
    (dialogService.openSimpleDialog as jest.Mock).mockResolvedValue(true);
    const row = makeAccessConnectorRow();

    const component = fixture.componentInstance as unknown as {
      disable: (row: AccessConnectorRow) => Promise<void>;
    };
    await component.disable(row);

    expect(accessConnectorsService.setEnabled).toHaveBeenCalledWith(row.accessConnector, false);
  });

  it("does not disable when confirmation is canceled", async () => {
    (dialogService.openSimpleDialog as jest.Mock).mockResolvedValue(false);
    const row = makeAccessConnectorRow();

    const component = fixture.componentInstance as unknown as {
      disable: (row: AccessConnectorRow) => Promise<void>;
    };
    await component.disable(row);

    expect(accessConnectorsService.setEnabled).not.toHaveBeenCalled();
  });

  it("calls accessConnectorsService.setEnabled(true) on enable", async () => {
    const row = makeAccessConnectorRow({ enabled: false });

    const component = fixture.componentInstance as unknown as {
      enable: (row: AccessConnectorRow) => Promise<void>;
    };
    await component.enable(row);

    expect(accessConnectorsService.setEnabled).toHaveBeenCalledWith(row.accessConnector, true);
  });

  it("calls accessConnectorsService.delete after confirmation", async () => {
    (dialogService.openSimpleDialog as jest.Mock).mockResolvedValue(true);
    const row = makeAccessConnectorRow();

    const component = fixture.componentInstance as unknown as {
      confirmDelete: (row: AccessConnectorRow) => Promise<void>;
    };
    await component.confirmDelete(row);

    expect(accessConnectorsService.delete).toHaveBeenCalledWith(row.accessConnector);
  });

  it("does not delete when confirmation is canceled", async () => {
    (dialogService.openSimpleDialog as jest.Mock).mockResolvedValue(false);
    const row = makeAccessConnectorRow();

    const component = fixture.componentInstance as unknown as {
      confirmDelete: (row: AccessConnectorRow) => Promise<void>;
    };
    await component.confirmDelete(row);

    expect(accessConnectorsService.delete).not.toHaveBeenCalled();
  });

  it("calls accessConnectorsService.unassign after confirmation", async () => {
    (dialogService.openSimpleDialog as jest.Mock).mockResolvedValue(true);
    const row = makeAccessConnectorRow();

    const component = fixture.componentInstance as unknown as {
      unassign: (row: AccessConnectorRow, targetId: TargetSystemId, name: string) => Promise<void>;
    };
    await component.unassign(row, sysId("ts-1"), "Prod");

    expect(accessConnectorsService.unassign).toHaveBeenCalledWith(
      row.accessConnector,
      sysId("ts-1"),
    );
  });

  it("does not unassign when confirmation is canceled", async () => {
    (dialogService.openSimpleDialog as jest.Mock).mockResolvedValue(false);
    const row = makeAccessConnectorRow();

    const component = fixture.componentInstance as unknown as {
      unassign: (row: AccessConnectorRow, targetId: TargetSystemId, name: string) => Promise<void>;
    };
    await component.unassign(row, sysId("ts-1"), "Prod");

    expect(accessConnectorsService.unassign).not.toHaveBeenCalled();
    expect(toastService.showToast).not.toHaveBeenCalled();
  });

  /**
   * Every mutation on this tab answers a refusal the same way: one error toast, nothing else
   * claimed.
   */
  describe("a refused mutation", () => {
    type Actions = {
      disable: (row: AccessConnectorRow) => Promise<void>;
      enable: (row: AccessConnectorRow) => Promise<void>;
      confirmDelete: (row: AccessConnectorRow) => Promise<void>;
      unassign: (row: AccessConnectorRow, targetId: TargetSystemId, name: string) => Promise<void>;
    };

    beforeEach(() => {
      (dialogService.openSimpleDialog as jest.Mock).mockResolvedValue(true);
    });

    function actions(): Actions {
      return fixture.componentInstance as unknown as Actions;
    }

    function expectedErrorToast() {
      expect(toastService.showToast).toHaveBeenCalledTimes(1);
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
    }

    it("reports a refused deactivation", async () => {
      (accessConnectorsService.setEnabled as jest.Mock).mockRejectedValue(new Error("boom"));

      await actions().disable(makeAccessConnectorRow());

      expectedErrorToast();
    });

    it("reports a refused activation", async () => {
      (accessConnectorsService.setEnabled as jest.Mock).mockRejectedValue(new Error("boom"));

      await actions().enable(makeAccessConnectorRow());

      expectedErrorToast();
    });

    it("reports a refused delete", async () => {
      (accessConnectorsService.delete as jest.Mock).mockRejectedValue(new Error("boom"));

      await actions().confirmDelete(makeAccessConnectorRow());

      expectedErrorToast();
    });

    it("reports a refused unassign", async () => {
      (accessConnectorsService.unassign as jest.Mock).mockRejectedValue(new Error("boom"));

      await actions().unassign(makeAccessConnectorRow(), sysId("ts-1"), "Prod");

      expectedErrorToast();
    });
  });

  describe("in-flight row guard", () => {
    type Guarded = {
      disable: (row: AccessConnectorRow) => Promise<void>;
      confirmDelete: (row: AccessConnectorRow) => Promise<void>;
      unassign: (row: AccessConnectorRow, targetId: TargetSystemId, name: string) => Promise<void>;
      isRowBusy: (rowId: AccessConnectorId) => boolean;
    };

    function guarded(): Guarded {
      return fixture.componentInstance as unknown as Guarded;
    }

    beforeEach(() => {
      (dialogService.openSimpleDialog as jest.Mock).mockResolvedValue(true);
    });

    it("does not dispatch a second setEnabled while the first is unsettled", async () => {
      const pending = deferred();
      (accessConnectorsService.setEnabled as jest.Mock).mockReturnValue(pending.promise);
      const row = makeAccessConnectorRow();
      const component = guarded();

      const first = component.disable(row);
      const second = component.disable(row);
      pending.settle();
      await Promise.all([first, second]);

      expect(accessConnectorsService.setEnabled).toHaveBeenCalledTimes(1);
    });

    it("does not dispatch a second delete while the first is unsettled", async () => {
      const pending = deferred();
      (accessConnectorsService.delete as jest.Mock).mockReturnValue(pending.promise);
      const row = makeAccessConnectorRow();
      const component = guarded();

      const first = component.confirmDelete(row);
      const second = component.confirmDelete(row);
      pending.settle();
      await Promise.all([first, second]);

      expect(accessConnectorsService.delete).toHaveBeenCalledTimes(1);
    });

    it("re-enables the row once the request settles", async () => {
      const pending = deferred();
      (accessConnectorsService.setEnabled as jest.Mock).mockReturnValue(pending.promise);
      const row = makeAccessConnectorRow();
      const component = guarded();

      const first = component.disable(row);
      expect(component.isRowBusy(row.id)).toBe(true);

      pending.settle();
      await first;
      expect(component.isRowBusy(row.id)).toBe(false);

      await component.disable(row);
      expect(accessConnectorsService.setEnabled).toHaveBeenCalledTimes(2);
    });

    it("marks the row busy under the id the row menu binds, on every action", async () => {
      const pending = deferred();
      (accessConnectorsService.unassign as jest.Mock).mockReturnValue(pending.promise);
      const row = makeAccessConnectorRow({ id: connectorId("row-key") });
      const component = guarded();

      const first = component.unassign(row, sysId("ts-1"), "Prod");
      expect(component.isRowBusy(row.id)).toBe(true);

      pending.settle();
      await first;
      expect(component.isRowBusy(row.id)).toBe(false);
    });

    it("allows a second action on a different row while one is in flight", async () => {
      const pending = deferred();
      (accessConnectorsService.setEnabled as jest.Mock).mockReturnValue(pending.promise);
      const rowA = makeAccessConnectorRow({ id: connectorId("1") });
      const rowB = makeAccessConnectorRow({ id: connectorId("2") });
      const component = guarded();

      const first = component.disable(rowA);
      const second = component.disable(rowB);
      pending.settle();
      await Promise.all([first, second]);

      expect(accessConnectorsService.setEnabled).toHaveBeenCalledTimes(2);
    });
  });

  describe("openAssignDialog", () => {
    const activeSystem = { id: sysId("ts-1"), name: "Prod DB" } as unknown as TargetSystem;

    function accessConnectorWithAssignments(...ids: TargetSystemId[]): AccessConnectorRow {
      const row = makeAccessConnectorRow();
      return {
        ...row,
        accessConnector: {
          ...row.accessConnector,
          assignedTargetSystemIds: ids,
        } as unknown as AccessConnector,
      };
    }

    async function openWith(systems: TargetSystem[], row: AccessConnectorRow): Promise<void> {
      TestBed.resetTestingModule();
      targetSystemsService = {
        automaticSystems$: of(systems),
        loading$: of(false),
        loadError$: targetSystemsLoadError$.asObservable(),
        load: jest.fn().mockResolvedValue(undefined),
      } as unknown as jest.Mocked<TargetSystemsService>;
      await createComponent();

      (dialogService.open as jest.Mock).mockReturnValue({ closed: of(undefined) });
      const component = fixture.componentInstance as unknown as {
        openAssignDialog: (row: AccessConnectorRow) => Promise<void>;
      };
      await component.openAssignDialog(row);
    }

    function dialogData(): { options: TargetSystem[]; noActiveAutomaticSystems: boolean } {
      return (dialogService.open as jest.Mock).mock.calls[0][1].data;
    }

    async function componentWith(
      targetSystemsLoading$: BehaviorSubject<boolean>,
      systems: TargetSystem[] = [],
    ): Promise<{ openAssignDialog: (row: AccessConnectorRow) => Promise<void> }> {
      TestBed.resetTestingModule();
      targetSystemsService = {
        automaticSystems$: of(systems),
        loading$: targetSystemsLoading$.asObservable(),
        loadError$: targetSystemsLoadError$.asObservable(),
        load: jest.fn().mockResolvedValue(undefined),
      } as unknown as jest.Mocked<TargetSystemsService>;
      await createComponent();
      return fixture.componentInstance as unknown as {
        openAssignDialog: (row: AccessConnectorRow) => Promise<void>;
      };
    }

    it("waits for the target-system read to settle before opening", async () => {
      const targetSystemsLoading$ = new BehaviorSubject(true);
      const component = await componentWith(targetSystemsLoading$, [activeSystem]);
      (dialogService.open as jest.Mock).mockReturnValue({ closed: of(undefined) });

      const opening = component.openAssignDialog(accessConnectorWithAssignments());
      await Promise.resolve();
      expect(dialogService.open).not.toHaveBeenCalled();

      targetSystemsLoading$.next(false);
      await opening;

      expect(dialogData().options).toEqual([activeSystem]);
      expect(dialogData().noActiveAutomaticSystems).toBe(false);
    });

    it("reports a failed target-system read instead of opening", async () => {
      const targetSystemsLoading$ = new BehaviorSubject(true);
      const component = await componentWith(targetSystemsLoading$);

      const opening = component.openAssignDialog(accessConnectorWithAssignments());
      targetSystemsLoadError$.next(new Error("boom"));
      targetSystemsLoading$.next(false);
      await opening;

      expect(dialogService.open).not.toHaveBeenCalled();
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "error",
          message: "pamAccessConnectorTargetSystemsLoadError",
        }),
      );
    });

    it("opens nothing when the tab is left while the target-system read is in flight", async () => {
      const targetSystemsLoading$ = new BehaviorSubject(true);
      const component = await componentWith(targetSystemsLoading$, [activeSystem]);
      (dialogService.open as jest.Mock).mockReturnValue({ closed: of(undefined) });

      const opening = component.openAssignDialog(accessConnectorWithAssignments());
      fixture.destroy();
      targetSystemsLoading$.next(false);
      await opening;

      expect(dialogService.open).not.toHaveBeenCalled();
    });

    it("flags that the org has no active automatic target system", async () => {
      await openWith([], accessConnectorWithAssignments());

      expect(dialogData().options).toEqual([]);
      expect(dialogData().noActiveAutomaticSystems).toBe(true);
    });

    it("assigns the picked target and reports it", async () => {
      TestBed.resetTestingModule();
      targetSystemsService = {
        automaticSystems$: of([activeSystem]),
        loading$: of(false),
        loadError$: targetSystemsLoadError$.asObservable(),
        load: jest.fn().mockResolvedValue(undefined),
      } as unknown as jest.Mocked<TargetSystemsService>;
      await createComponent();
      const row = accessConnectorWithAssignments();
      (dialogService.open as jest.Mock).mockReturnValue({ closed: of(String(activeSystem.id)) });

      await (
        fixture.componentInstance as unknown as {
          openAssignDialog: (row: AccessConnectorRow) => Promise<void>;
        }
      ).openAssignDialog(row);

      expect(accessConnectorsService.assign).toHaveBeenCalledWith(
        row.accessConnector,
        activeSystem.id,
      );
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    });

    it("reports a refused assignment", async () => {
      TestBed.resetTestingModule();
      targetSystemsService = {
        automaticSystems$: of([activeSystem]),
        loading$: of(false),
        loadError$: targetSystemsLoadError$.asObservable(),
        load: jest.fn().mockResolvedValue(undefined),
      } as unknown as jest.Mocked<TargetSystemsService>;
      await createComponent();
      (dialogService.open as jest.Mock).mockReturnValue({ closed: of(String(activeSystem.id)) });
      (accessConnectorsService.assign as jest.Mock).mockRejectedValue(new Error("boom"));

      await (
        fixture.componentInstance as unknown as {
          openAssignDialog: (row: AccessConnectorRow) => Promise<void>;
        }
      ).openAssignDialog(accessConnectorWithAssignments());

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
    });

    it("does not flag when the only active system is already assigned to this accessConnector", async () => {
      await openWith([activeSystem], accessConnectorWithAssignments(activeSystem.id));

      expect(dialogData().options).toEqual([]);
      expect(dialogData().noActiveAutomaticSystems).toBe(false);
    });
  });

  describe("assign availability", () => {
    const eligibleSystem = { id: sysId("ts-1"), name: "Prod DB" } as unknown as TargetSystem;

    function assignRow(canAssign: boolean, assignedIds: TargetSystemId[] = []): AccessConnectorRow {
      return makeAccessConnectorRow({
        canAssign,
        enabled: canAssign,
        accessConnector: { assignedTargetSystemIds: assignedIds } as unknown as AccessConnector,
      });
    }

    async function openRowMenu(
      row: AccessConnectorRow,
      eligible: TargetSystem[] = [eligibleSystem],
    ): Promise<HTMLButtonElement> {
      TestBed.resetTestingModule();
      targetSystemsService = {
        automaticSystems$: of(eligible),
        loading$: of(false),
        loadError$: targetSystemsLoadError$.asObservable(),
        load: jest.fn().mockResolvedValue(undefined),
      } as unknown as jest.Mocked<TargetSystemsService>;
      rows$.next([row]);
      await createComponent({ renderTemplate: true });

      (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLButtonElement>('button[id^="access-connectors-tab_button_menu-"]')!
        .click();
      fixture.detectChanges();

      return document.querySelector<HTMLButtonElement>(
        '.bit-menu-panel [id^="access-connectors-tab_button_assign-"]',
      )!;
    }

    afterEach(() => {
      rows$.next([]);
    });

    it("renders the assign item without aria-disabled when a target can be assigned", async () => {
      const item = await openRowMenu(assignRow(true));

      expect(item.getAttribute("aria-disabled")).toBeNull();
    });

    it("keeps the assign item visible and aria-disabled when the connector is disabled", async () => {
      const item = await openRowMenu(assignRow(false));

      expect(item).not.toBeNull();
      expect(item.getAttribute("aria-disabled")).toBe("true");
      expect(item.hasAttribute("disabled")).toBe(false);
    });

    it("disables the assign item when the org has no eligible target system", async () => {
      const item = await openRowMenu(assignRow(true), []);

      expect(item.getAttribute("aria-disabled")).toBe("true");
      expect(item.hasAttribute("disabled")).toBe(false);
    });

    it("disables the assign item when every eligible target is already assigned", async () => {
      const item = await openRowMenu(assignRow(true, [eligibleSystem.id]));

      expect(item.getAttribute("aria-disabled")).toBe("true");
    });

    it("names the two empty cases apart, since they are different sentences to an admin", async () => {
      function blockedKey(): string | null {
        return (
          fixture.componentInstance as unknown as {
            rows: () => { assignTargetsBlockedKey: string | null }[];
          }
        ).rows()[0].assignTargetsBlockedKey;
      }

      await openRowMenu(assignRow(true), []);
      expect(blockedKey()).toBe("pamAccessConnectorAssignNoTargetSystems");

      await openRowMenu(assignRow(true, [eligibleSystem.id]));
      expect(blockedKey()).toBe("pamAccessConnectorAssignNoOptions");
    });

    it("leaves the assign item live while the target-system list is still being read", async () => {
      TestBed.resetTestingModule();
      targetSystemsService = {
        automaticSystems$: of([] as TargetSystem[]),
        loading$: of(true),
        loadError$: targetSystemsLoadError$.asObservable(),
        load: jest.fn().mockResolvedValue(undefined),
      } as unknown as jest.Mocked<TargetSystemsService>;
      rows$.next([assignRow(true)]);
      await createComponent({ renderTemplate: true });

      (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLButtonElement>('button[id^="access-connectors-tab_button_menu-"]')!
        .click();
      fixture.detectChanges();

      expect(
        document
          .querySelector<HTMLButtonElement>(
            '.bit-menu-panel [id^="access-connectors-tab_button_assign-"]',
          )!
          .getAttribute("aria-disabled"),
      ).toBeNull();
    });

    it("does not open the assign dialog when the item is disabled", async () => {
      (await openRowMenu(assignRow(false))).click();
      await fixture.whenStable();

      expect(dialogService.open).not.toHaveBeenCalled();
    });

    it("does not open the assign dialog when every eligible target is already assigned", async () => {
      (await openRowMenu(assignRow(true, [eligibleSystem.id]))).click();
      await fixture.whenStable();

      expect(dialogService.open).not.toHaveBeenCalled();
    });

    it("keeps the row menu open when the disabled assign item is clicked", async () => {
      (await openRowMenu(assignRow(false))).click();
      fixture.detectChanges();

      expect(document.querySelector(".bit-menu-panel")).not.toBeNull();
    });

    it("closes the row menu when the live assign item is clicked", async () => {
      const item = await openRowMenu(assignRow(true));
      (dialogService.open as jest.Mock).mockReturnValue({ closed: of(undefined) });

      item.click();
      fixture.detectChanges();

      expect(document.querySelector(".bit-menu-panel")).toBeNull();
    });

    it("describes the disabled assign item with the tooltip explaining why", async () => {
      const item = await openRowMenu(assignRow(false));

      expect(item.getAttribute("aria-describedby")).toMatch(/^bit-tooltip-\d+$/);
    });

    it("leaves the live assign item undescribed", async () => {
      const item = await openRowMenu(assignRow(true));

      expect(item.getAttribute("aria-describedby")).toBeNull();
    });
  });

  describe("name column", () => {
    beforeEach(async () => {
      TestBed.resetTestingModule();
      rows$.next([makeAccessConnectorRow({ name: "dc01 connector" })]);

      await createComponent({ renderTemplate: true });
    });

    afterEach(() => {
      rows$.next([]);
    });

    function nameCellButton(): HTMLButtonElement {
      return (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
        'tbody tr td:first-child button[id^="access-connectors-tab_button_detail-"]',
      )!;
    }

    it("renders the name as a primary link", () => {
      const button = nameCellButton();

      expect(button.textContent).toContain("dc01 connector");
      expect(button.classList).toContain("tw-text-fg-brand");
    });

    it("keeps the name keyboard focusable", () => {
      const button = nameCellButton();

      expect(button.tagName).toBe("BUTTON");
      expect(button.getAttribute("tabindex")).not.toBe("-1");
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
      expect(el.textContent).not.toContain("pamAccessConnectorEmptyStateTitle");
    });

    it("renders the load-error state while the load is still in flight", () => {
      loadError$.next(new Error("boom"));
      loading$.next(true);
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector("pam-rotation-load-error")).not.toBeNull();
      expect(el.querySelector('[data-testid="access-connectors-loading"]')).toBeNull();

      loading$.next(false);
    });

    it("retries both loads from the error state", async () => {
      loadError$.next(new Error("boom"));
      fixture.detectChanges();
      (accessConnectorsService.load as jest.Mock).mockClear();
      (targetSystemsService.load as jest.Mock).mockClear();

      (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLButtonElement>("#rotation-load-error_button_retry")!
        .click();
      await fixture.whenStable();

      expect(accessConnectorsService.load).toHaveBeenCalledWith(ORGANIZATION_ID);
      expect(targetSystemsService.load).toHaveBeenCalledWith(ORGANIZATION_ID);
    });
  });

  describe("loading skeleton", () => {
    /** Runs the placeholder's clock on. */
    function advance(ms: number): void {
      fixture.detectChanges();
      jest.advanceTimersByTime(ms);
      fixture.detectChanges();
    }

    /** Runs out the delay the placeholder is held back by, and renders what it leaves. */
    function showSkeleton(): void {
      advance(1000);
    }

    beforeEach(async () => {
      TestBed.resetTestingModule();
      loadError$.next(null);
      rows$.next([]);
      loading$.next(true);

      jest.useFakeTimers({ doNotFake: ["nextTick", "queueMicrotask", "setImmediate"] });
      await createComponent({ renderTemplate: true });
    });

    afterEach(() => {
      jest.useRealTimers();
      loading$.next(false);
      rows$.next([]);
    });

    it("stands a skeleton table in for the list, carrying the real columns", () => {
      showSkeleton();
      const el = fixture.nativeElement as HTMLElement;
      const loading = el.querySelector('[data-testid="access-connectors-loading"]');

      expect(el.querySelector("bit-spinner")).toBeNull();
      expect(loading).not.toBeNull();
      expect(loading!.querySelectorAll("bit-skeleton-text").length).toBeGreaterThan(0);
      expect(loading!.textContent).toContain("pamAccessConnectorConnection");
      expect(loading!.textContent).toContain("pamAccessConnectorAssignments");
    });

    it("keeps the placeholder itself out of the accessibility tree", () => {
      const loading = (fixture.nativeElement as HTMLElement).querySelector(
        '[data-testid="access-connectors-loading"]',
      );

      expect(loading!.getAttribute("aria-hidden")).toBe("true");
    });

    it("stands a placeholder in for the toolbar rather than offering row-derived filters", () => {
      showSkeleton();
      const el = fixture.nativeElement as HTMLElement;

      expect(el.querySelector("bit-search")).toBeNull();
      expect(el.querySelector("bit-filter-menu")).toBeNull();
      expect(
        el.querySelectorAll(
          '[data-testid="access-connectors-loading"] > div:first-child bit-skeleton',
        ).length,
      ).toBeGreaterThan(0);
    });

    it("announces the load from a live region while the skeleton stands in", () => {
      const status = (fixture.nativeElement as HTMLElement).querySelector(
        '[data-testid="rotation-loading-status"]',
      );

      expect(status!.getAttribute("role")).toBe("status");
      expect(status!.getAttribute("aria-live")).toBe("polite");
      expect(status!.textContent).toContain("loading");
    });

    it("replaces the skeleton with the real rows, and announces the arrival", () => {
      showSkeleton();
      rows$.next([makeAccessConnectorRow({ name: "dc01 connector" })]);
      loading$.next(false);
      advance(1000);

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('[data-testid="access-connectors-loading"]')).toBeNull();
      expect(el.querySelector("bit-skeleton")).toBeNull();
      expect(
        el.querySelector(
          'tbody tr td:first-child button[id^="access-connectors-tab_button_detail-"]',
        )!.textContent,
      ).toContain("dc01 connector");
      expect(el.querySelector('[data-testid="rotation-loading-status"]')!.textContent).toContain(
        "pamAccessConnectorsLoaded",
      );
    });

    it("renders the tab's own furniture, not a blank area, before the delay is up", () => {
      advance(999);

      const el = fixture.nativeElement as HTMLElement;
      const loading = el.querySelector('[data-testid="access-connectors-loading"]');
      expect(loading).not.toBeNull();
      expect(el.querySelector("bit-skeleton")).toBeNull();
      expect(loading!.textContent).toContain("pamAccessConnectorConnection");
    });

    it("never draws the placeholder for a list that arrives inside the delay", () => {
      advance(500);
      rows$.next([makeAccessConnectorRow({ name: "dc01 connector" })]);
      loading$.next(false);
      advance(1000);

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector("bit-skeleton")).toBeNull();
      expect(el.querySelector('[data-testid="access-connectors-loading"]')).toBeNull();
    });

    it("holds the placeholder its minimum time once it is up, so it cannot blink", () => {
      showSkeleton();
      expect((fixture.nativeElement as HTMLElement).querySelector("bit-skeleton")).not.toBeNull();

      rows$.next([makeAccessConnectorRow({ name: "dc01 connector" })]);
      loading$.next(false);
      advance(300);

      expect((fixture.nativeElement as HTMLElement).querySelector("bit-skeleton")).not.toBeNull();

      advance(700);

      expect((fixture.nativeElement as HTMLElement).querySelector("bit-skeleton")).toBeNull();
    });

    it("announces the load at once, not on the placeholder's clock", () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('[data-testid="rotation-loading-status"]')!.textContent).toContain(
        "loading",
      );
      expect(el.querySelector("bit-skeleton")).toBeNull();
    });
  });
});

describe("AccessConnectorsTabComponent toolbar filters", () => {
  /** The component's protected surface, as these tests read it. */
  type FiltersComp = {
    dataSource: { filteredData?: AccessConnectorRow[] };
    searchControl: { setValue: (value: string) => void };
    statusOptions: () => { value: string; label: string }[];
    connectionOptions: () => { value: boolean; label: string }[];
  };

  let fixture: ComponentFixture<AccessConnectorsTabComponent>;
  let component: FiltersComp;

  function makeRow(overrides: {
    id: AccessConnectorId;
    name: string;
    enabled: boolean;
    isConnected: boolean;
  }): AccessConnectorRow {
    const { id, name, enabled, isConnected } = overrides;
    return {
      id,
      name,
      statusLabelKey: enabled
        ? "pamAccessConnectorStatusActive"
        : "pamAccessConnectorStatusInactive",
      isConnected,
      assignmentNames: [],
      enabled,
      canAssign: enabled,
      accessConnector: accessConnector({
        id,
        name,
        status: enabled ? AccessConnectorStatus.Enabled : AccessConnectorStatus.Disabled,
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

  /** Renders the real template. */
  function setup(rows: AccessConnectorRow[]) {
    TestBed.configureTestingModule({
      imports: [AccessConnectorsTabComponent],
      providers: [
        provideRouter([]),
        {
          provide: AccessConnectorsService,
          useValue: {
            loading$: new BehaviorSubject<boolean>(false),
            loadError$: new BehaviorSubject<unknown | null>(null),
            rows$: new BehaviorSubject<AccessConnectorRow[]>(rows),
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
            automaticSystems$: of([] as TargetSystem[]),
            loading$: of(false),
            loadError$: new BehaviorSubject<unknown | null>(null),
            load: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: ConfigService, useValue: vfo1ConfigService(false) },
        {
          provide: ActivatedRoute,
          useValue: { params: of({ organizationId: ORGANIZATION_ID }) },
        },
      ],
    });

    fixture = TestBed.createComponent(AccessConnectorsTabComponent);
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
      { value: "pamAccessConnectorStatusActive", label: "pamAccessConnectorStatusActive" },
      { value: "pamAccessConnectorStatusInactive", label: "pamAccessConnectorStatusInactive" },
    ]);
  });

  it("derives the connection options from the rows' liveness flag", () => {
    setup([enabledConnected, enabledOffline, disabledOffline]);
    expect(component.connectionOptions()).toEqual([
      { value: true, label: "pamAccessConnectorConnected" },
      { value: false, label: "pamAccessConnectorDisconnected" },
    ]);
  });

  it("leaves the whole toolbar out when no connectors are registered", () => {
    setup([]);
    expect(fixture.debugElement.query(By.css("bit-search"))).toBeNull();
    expect(fixture.debugElement.query(By.css("bit-filter-menu"))).toBeNull();
    expect(fixture.nativeElement.textContent).toContain("pamAccessConnectorEmptyStateTitle");
  });

  it("narrows rows to the selected status", () => {
    setup([enabledConnected, enabledOffline, disabledOffline]);
    chip("status").toggle("pamAccessConnectorStatusInactive");
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

describe("AccessConnectorsTabComponent assigned targets column", () => {
  let fixture: ComponentFixture<AccessConnectorsTabComponent>;
  let overlayContainer: OverlayContainer;

  function makeRow(id: string, assignmentNames: string[]): AccessConnectorRow {
    return {
      id: connectorId(id),
      name: id,
      statusLabelKey: "pamAccessConnectorStatusActive",
      isConnected: true,
      assignmentNames,
      enabled: true,
      canAssign: true,
      accessConnector: accessConnector({ id: connectorId(id), name: id }),
    };
  }

  /** Renders the real template. */
  function setup(rows: AccessConnectorRow[]) {
    TestBed.configureTestingModule({
      imports: [AccessConnectorsTabComponent],
      providers: [
        provideRouter([]),
        {
          provide: AccessConnectorsService,
          useValue: {
            loading$: new BehaviorSubject<boolean>(false),
            loadError$: new BehaviorSubject<unknown | null>(null),
            rows$: new BehaviorSubject<AccessConnectorRow[]>(rows),
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
            automaticSystems$: of([] as TargetSystem[]),
            loading$: of(false),
            loadError$: new BehaviorSubject<unknown | null>(null),
            load: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        {
          // Echoes the count back.
          provide: I18nService,
          useValue: {
            t: (key: string, p1?: string | number) => (p1 == null ? key : `${key}:${p1}`),
          },
        },
        { provide: ConfigService, useValue: vfo1ConfigService(false) },
        {
          provide: ActivatedRoute,
          useValue: { params: of({ organizationId: ORGANIZATION_ID }) },
        },
      ],
    });

    fixture = TestBed.createComponent(AccessConnectorsTabComponent);
    overlayContainer = TestBed.inject(OverlayContainer);
    fixture.detectChanges();
  }

  function countButtons(): HTMLButtonElement[] {
    return fixture.debugElement
      .queryAll(By.css('button[id^="access-connectors-tab_button_assignments-"]'))
      .map((de) => de.nativeElement as HTMLButtonElement);
  }

  afterEach(() => {
    overlayContainer?.ngOnDestroy();
  });

  it("collapses many assignments into a single count button", () => {
    setup([makeRow("c-1", ["Prod Entra", "Reporting SQL", "Billing MSSQL", "Legacy LDAP"])]);

    const buttons = countButtons();
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toContain("pamAccessConnectorAssignmentCount:4");
  });

  it("renders the count as a badge carrying the target system icon", () => {
    setup([makeRow("c-1", ["Prod Entra", "Reporting SQL"])]);

    const button = countButtons()[0];
    expect(button.hasAttribute("bit-chip-action")).toBe(true);
    expect(button.querySelector("bit-icon.bwi-desktop")).not.toBeNull();
  });

  it("uses the singular count message for a single assignment", () => {
    setup([makeRow("c-1", ["Prod Entra"])]);

    expect(countButtons()[0].textContent).toContain("pamAccessConnectorAssignmentCountSingular:1");
  });

  it("renders no count button when nothing is assigned", () => {
    setup([makeRow("c-1", [])]);

    expect(countButtons()).toHaveLength(0);
    expect(fixture.nativeElement.querySelector("button[bit-chip-action]")).toBeNull();
    expect(fixture.nativeElement.textContent).toContain("pamAccessConnectorAssignmentsNone");
  });

  it("reveals every assigned target name when the count is activated", () => {
    const names = ["Prod Entra", "Reporting SQL", "Billing MSSQL", "Legacy LDAP"];
    setup([makeRow("c-1", names)]);

    expect(overlayContainer.getContainerElement().textContent).not.toContain("Prod Entra");

    countButtons()[0].click();
    fixture.detectChanges();

    const revealed = overlayContainer.getContainerElement().textContent ?? "";
    for (const name of names) {
      expect(revealed).toContain(name);
    }
  });

  it("marks the count button as a collapsed disclosure for assistive technology", () => {
    setup([makeRow("c-1", ["Prod Entra", "Reporting SQL"])]);

    const button = countButtons()[0];
    expect(button.getAttribute("aria-expanded")).toBe("false");

    button.click();
    fixture.detectChanges();

    expect(button.getAttribute("aria-expanded")).toBe("true");
  });
});

describe("AccessConnectorsTabComponent with the VFO1 flag", () => {
  let fixture: ComponentFixture<AccessConnectorsTabComponent>;
  let rows$: BehaviorSubject<AccessConnectorRow[]>;
  let loading$: BehaviorSubject<boolean>;
  let accessConnectorsService: { setEnabled: jest.Mock; delete: jest.Mock };
  let dialogService: { openSimpleDialog: jest.Mock; open: jest.Mock };
  let overlayContainer: OverlayContainer;

  const eligibleSystem = { id: sysId("ts-1"), name: "Prod DB" } as unknown as TargetSystem;

  function makeRow(
    id: string,
    name: string,
    {
      enabled = true,
      isConnected = true,
      assignmentNames = [] as string[],
      assignedTargetSystemIds = [] as TargetSystemId[],
    } = {},
  ): AccessConnectorRow {
    return {
      id: connectorId(id),
      name,
      statusLabelKey: enabled
        ? "pamAccessConnectorStatusActive"
        : "pamAccessConnectorStatusInactive",
      isConnected,
      assignmentNames,
      enabled,
      canAssign: enabled,
      accessConnector: accessConnector({
        id: connectorId(id),
        name,
        status: enabled ? AccessConnectorStatus.Enabled : AccessConnectorStatus.Disabled,
        isConnected,
        assignedTargetSystemIds,
      }),
    };
  }

  const ROWS = [
    makeRow("c-1", "Prod on-prem", { assignmentNames: ["Prod DB"] }),
    makeRow("c-2", "EU region", {
      isConnected: false,
      assignmentNames: ["Prod DB", "Reporting SQL"],
      assignedTargetSystemIds: [sysId("ts-1"), sysId("ts-2")],
    }),
    makeRow("c-3", "Staging", { enabled: false, isConnected: false }),
  ];

  function render(vfo1: boolean, rows: AccessConnectorRow[] = ROWS, loading = false): HTMLElement {
    TestBed.resetTestingModule();
    rows$ = new BehaviorSubject<AccessConnectorRow[]>(rows);
    loading$ = new BehaviorSubject<boolean>(loading);
    accessConnectorsService = {
      setEnabled: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    dialogService = {
      openSimpleDialog: jest.fn().mockResolvedValue(false),
      open: jest.fn().mockReturnValue({ closed: of(undefined) }),
    };

    TestBed.configureTestingModule({
      imports: [AccessConnectorsTabComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        {
          provide: AccessConnectorsService,
          useValue: {
            loading$,
            loadError$: new BehaviorSubject<unknown | null>(null),
            rows$,
            load: jest.fn().mockResolvedValue(undefined),
            registerCompleted: jest.fn().mockResolvedValue(undefined),
            assign: jest.fn().mockResolvedValue(undefined),
            unassign: jest.fn().mockResolvedValue(undefined),
            ...accessConnectorsService,
          },
        },
        {
          provide: TargetSystemsService,
          useValue: {
            automaticSystems$: of([eligibleSystem]),
            loading$: of(false),
            loadError$: new BehaviorSubject<unknown | null>(null),
            load: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: mock<ToastService>() },
        {
          provide: I18nService,
          useValue: {
            t: (key: string, p1?: string | number) => (p1 == null ? key : `${key}:${p1}`),
          },
        },
        { provide: ConfigService, useValue: vfo1ConfigService(vfo1) },
        {
          provide: ActivatedRoute,
          useValue: { params: of({ organizationId: ORGANIZATION_ID }) },
        },
      ],
    });

    fixture = TestBed.createComponent(AccessConnectorsTabComponent);
    overlayContainer = TestBed.inject(OverlayContainer);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => {
    overlayContainer?.ngOnDestroy();
  });

  function text(el: Element): string {
    return (el.textContent ?? "").replace(/\s+/g, " ").trim();
  }

  function isV2(el: HTMLElement): boolean {
    return el.querySelector("bit-table-v2") != null;
  }

  function headers(el: HTMLElement): HTMLElement[] {
    return Array.from(
      isV2(el)
        ? el.querySelectorAll<HTMLElement>('bit-table-v2 [role="columnheader"]')
        : el.querySelectorAll<HTMLElement>("bit-table thead th"),
    );
  }

  function bodyRows(el: HTMLElement): Element[] {
    return Array.from(
      isV2(el)
        ? el.querySelectorAll("bit-table-v2 bit-row")
        : el.querySelectorAll("bit-table tbody tr"),
    );
  }

  function cellTexts(el: HTMLElement): string[][] {
    const cellSelector = isV2(el) ? '[role="cell"]' : "td";
    return bodyRows(el).map((row) => Array.from(row.querySelectorAll(cellSelector)).map(text));
  }

  function rowNames(el: HTMLElement): string[] {
    return Array.from(
      el.querySelectorAll('button[id^="access-connectors-tab_button_detail-"]'),
    ).map(text);
  }

  function sortableHeadings(el: HTMLElement): string[] {
    return isV2(el)
      ? headers(el)
          .filter((header) => header.querySelector("button") != null)
          .map(text)
      : Array.from(el.querySelectorAll("bit-table thead th[bitsortable]")).map(text);
  }

  function clickSort(el: HTMLElement, label: string): void {
    const header = headers(el).find((h) => text(h) === label)!;
    header.querySelector("button")!.click();
    fixture.detectChanges();
  }

  function ariaSort(el: HTMLElement, label: string): string | null {
    return headers(el)
      .find((h) => text(h) === label)!
      .getAttribute("aria-sort");
  }

  function openMenu(el: HTMLElement, rowIndex: number): HTMLElement {
    el.querySelectorAll<HTMLButtonElement>('button[id^="access-connectors-tab_button_menu-"]')[
      rowIndex
    ].click();
    fixture.detectChanges();
    const panels = document.querySelectorAll<HTMLElement>(".bit-menu-panel");
    return panels[panels.length - 1];
  }

  function menuItems(el: HTMLElement, rowIndex: number): string[] {
    const items = Array.from(openMenu(el, rowIndex).querySelectorAll("[bitmenuitem]")).map(text);
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    overlayContainer.getContainerElement().innerHTML = "";
    return items;
  }

  function chip(key: string): FilterMenuComponent {
    return fixture.debugElement.query(By.css(`bit-filter-menu[key="${key}"]`)).componentInstance;
  }

  it("renders only the v1 table with the flag off", () => {
    const el = render(false);

    expect(el.querySelector("bit-table")).not.toBeNull();
    expect(el.querySelector("bit-table-v2")).toBeNull();
  });

  it("renders only the v2 table with the flag on", () => {
    const el = render(true);

    expect(el.querySelector("bit-table-v2")).not.toBeNull();
    expect(el.querySelector("bit-table")).toBeNull();
  });

  it("renders the same column headings, in the same order, as the v1 table", () => {
    const v1 = headers(render(false)).map(text);
    const v2 = headers(render(true)).map(text);

    expect(v2.slice(0, 4)).toEqual([
      "name",
      "status",
      "pamAccessConnectorConnection",
      "pamAccessConnectorAssignments",
    ]);
    expect(v2.slice(0, 4)).toEqual(v1.slice(0, 4));
    expect(v2).toHaveLength(v1.length);
  });

  it("gives the actions column a screen-reader-only heading", () => {
    const actionsHeader = headers(render(true))[4];
    const label = actionsHeader.querySelector(".tw-sr-only");

    expect(text(actionsHeader)).toBe("options");
    expect(label).not.toBeNull();
    expect(text(label as HTMLElement)).toBe("options");
  });

  it("renders the same rows and cells as the v1 table", () => {
    const v1 = cellTexts(render(false));
    const v2 = cellTexts(render(true));

    expect(v2).toHaveLength(ROWS.length);
    expect(v2).toEqual(v1);
  });

  it("offers the same row actions, in the same order, as the v1 table", () => {
    const v1El = render(false);
    const v1 = ROWS.map((_, i) => menuItems(v1El, i));
    const v2El = render(true);
    const v2 = ROWS.map((_, i) => menuItems(v2El, i));

    expect(v2[1]).toEqual([
      "pamAccessConnectorViewDetails",
      "pamAccessConnectorAssignTargets",
      "pamAccessConnectorUnassign:Prod DB",
      "pamAccessConnectorUnassign:Reporting SQL",
      "pamAccessConnectorDeactivate",
      "pamAccessConnectorDeleteAccessConnector",
    ]);
    expect(v2).toEqual(v1);
  });

  it("gates the assign action the same way, keeping it aria-disabled for a disabled connector", () => {
    const el = render(true);
    const item = openMenu(el, 2).querySelector<HTMLButtonElement>(
      '[id^="access-connectors-tab_button_assign-"]',
    )!;

    expect(item.id).toBe(`access-connectors-tab_button_assign-locked-${connectorId("c-3")}`);
    expect(item.getAttribute("aria-disabled")).toBe("true");
    expect(item.getAttribute("aria-describedby")).toMatch(/^bit-tooltip-\d+$/);
  });

  it("routes a row action through the shared component method", async () => {
    const el = render(true);
    openMenu(el, 0)
      .querySelector<HTMLButtonElement>('[id^="access-connectors-tab_button_assign-"]')!
      .click();
    await fixture.whenStable();

    expect(dialogService.open).toHaveBeenCalledTimes(1);
  });

  it("navigates to the detail page from the name link", () => {
    const el = render(true);
    const navigateSpy = jest.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);

    el.querySelector<HTMLButtonElement>(
      'button[id^="access-connectors-tab_button_detail-"]',
    )!.click();

    expect(navigateSpy).toHaveBeenCalledWith(
      ["..", "access-connectors", connectorId("c-1")],
      expect.objectContaining({ relativeTo: expect.anything() }),
    );
  });

  it("sorts only by name, unsorted until asked, as the v1 table does", () => {
    const shuffled = [ROWS[2], ROWS[0], ROWS[1]];
    const v1El = render(false, shuffled);
    const v1 = [rowNames(v1El), ariaSort(v1El, "name")];
    expect(sortableHeadings(v1El)).toEqual(["name"]);
    clickSort(v1El, "name");
    v1.push(rowNames(v1El), ariaSort(v1El, "name"));
    clickSort(v1El, "name");
    v1.push(rowNames(v1El), ariaSort(v1El, "name"));

    const v2El = render(true, shuffled);
    const v2 = [rowNames(v2El), ariaSort(v2El, "name")];
    expect(sortableHeadings(v2El)).toEqual(["name"]);
    clickSort(v2El, "name");
    v2.push(rowNames(v2El), ariaSort(v2El, "name"));
    clickSort(v2El, "name");
    v2.push(rowNames(v2El), ariaSort(v2El, "name"));

    expect(v2[0]).toEqual(["Staging", "Prod on-prem", "EU region"]);
    expect(v2[2]).toEqual(["EU region", "Prod on-prem", "Staging"]);
    expect(v2[4]).toEqual(["Staging", "Prod on-prem", "EU region"]);
    expect(v2[3]).toBe("ascending");
    expect(v2[5]).toBe("descending");
    expect(v2).toEqual(v1);
  });

  it("filters by search text and both chips with the same predicate as the v1 table", () => {
    const component = (): { searchControl: { setValue: (value: string) => void } } =>
      fixture.componentInstance as unknown as {
        searchControl: { setValue: (value: string) => void };
      };

    const v1El = render(false);
    component().searchControl.setValue("r");
    chip("connection").toggle(false);
    chip("status").toggle("pamAccessConnectorStatusActive");
    fixture.detectChanges();
    const v1 = rowNames(v1El);

    const v2El = render(true);
    component().searchControl.setValue("r");
    chip("connection").toggle(false);
    chip("status").toggle("pamAccessConnectorStatusActive");
    fixture.detectChanges();

    expect(rowNames(v2El)).toEqual(["EU region"]);
    expect(rowNames(v2El)).toEqual(v1);
  });

  it("shows the same no-results message when the filters empty the table", () => {
    const el = render(true, [ROWS[0]]);
    chip("connection").toggle(false);
    fixture.detectChanges();

    expect(bodyRows(el)).toHaveLength(0);
    expect(text(el.querySelector("bit-table-v2 [slot=empty]")!)).toBe(
      "pamAccessConnectorNoResults",
    );
  });

  it("keeps the no-connectors empty state outside the table", () => {
    const el = render(true, []);

    expect(el.querySelector("bit-table-v2")).toBeNull();
    expect(el.textContent).toContain("pamAccessConnectorEmptyStateTitle");
  });

  it("follows a live connection change from the rows signal", () => {
    const el = render(true, [ROWS[0]]);
    expect(cellTexts(el)[0][2]).toBe("pamAccessConnectorConnected");

    rows$.next([{ ...ROWS[0], isConnected: false }]);
    fixture.detectChanges();

    expect(cellTexts(el)[0][2]).toBe("pamAccessConnectorDisconnected");
  });

  it("gives the row menu trigger and the count disclosure the same accessible names", () => {
    const v1El = render(false);
    const v1Trigger = v1El.querySelector('button[id^="access-connectors-tab_button_menu-"]')!;
    const v1Label = v1Trigger.getAttribute("aria-label");
    const v2El = render(true);
    const v2Trigger = v2El.querySelector('button[id^="access-connectors-tab_button_menu-"]')!;
    const count = v2El.querySelector<HTMLButtonElement>(
      'button[id^="access-connectors-tab_button_assignments-"]',
    )!;

    expect(v2Trigger.getAttribute("aria-label")).toBe("options");
    expect(v2Trigger.getAttribute("aria-label")).toBe(v1Label);
    expect(count.getAttribute("aria-expanded")).toBe("false");
    count.click();
    fixture.detectChanges();
    expect(count.getAttribute("aria-expanded")).toBe("true");
  });

  describe("toolbar", () => {
    function toolbar(el: HTMLElement): HTMLElement {
      return el.querySelector("bit-table-v2 bit-table-toolbar")!;
    }

    function chipKeys(root: ParentNode): (string | null)[] {
      return Array.from(root.querySelectorAll("bit-filter-menu")).map((menu) =>
        menu.getAttribute("key"),
      );
    }

    it("puts the search and every filter chip inside the table's toolbar", () => {
      const el = render(true);

      expect(toolbar(el)).not.toBeNull();
      expect(toolbar(el).querySelector("bit-search")).not.toBeNull();
      expect(chipKeys(toolbar(el))).toEqual(["status", "connection"]);
      expect(el.querySelectorAll("bit-search")).toHaveLength(1);
      expect(el.querySelectorAll("bit-filter-menu")).toHaveLength(2);
    });

    it("leaves the controls outside the table when the flag is off", () => {
      const el = render(false);

      expect(el.querySelector("bit-table-toolbar")).toBeNull();
      expect(el.querySelector("bit-table")!.querySelector("bit-search")).toBeNull();
      expect(el.querySelectorAll("bit-search")).toHaveLength(1);
      expect(chipKeys(el)).toEqual(["status", "connection"]);
    });

    it("keeps each chip's label and unset state", () => {
      const offLabels = Array.from(render(false).querySelectorAll("bit-filter-menu")).map(text);
      const onLabels = Array.from(toolbar(render(true)).querySelectorAll("bit-filter-menu")).map(
        text,
      );

      expect(offLabels[0]).toContain("status");
      expect(offLabels[1]).toContain("pamAccessConnectorConnection");
      expect(offLabels.every((label) => label.includes("all"))).toBe(true);
      expect(onLabels).toEqual(offLabels);
    });

    it("keeps the search placeholder and input type it had off the flag", () => {
      const offInput = render(false).querySelector("bit-search input")!;
      const offPlaceholder = offInput.getAttribute("placeholder");
      const offType = offInput.getAttribute("type");

      const onInput = toolbar(render(true)).querySelector("bit-search input")!;

      expect(onInput.getAttribute("placeholder")).toBe("pamAccessConnectorSearch");
      expect(onInput.getAttribute("placeholder")).toBe(offPlaceholder);
      expect(onInput.getAttribute("type")).toBe(offType);
      expect(onInput.hasAttribute("disabled")).toBe(false);
    });

    it("caps the search by making it a flex item of the toolbar, not a block child", () => {
      const search = toolbar(render(true)).querySelector("bit-search")!;

      expect(search.className).toContain("tw-flex-1");
    });

    it("keeps every toolbar control keyboard reachable", () => {
      const el = render(true);
      const focusable = Array.from(
        toolbar(el).querySelectorAll<HTMLElement>("input, button"),
      ).filter((control) => control.getAttribute("tabindex") !== "-1");

      expect(focusable.length).toBeGreaterThanOrEqual(3);
      expect(focusable.every((control) => !control.hasAttribute("disabled"))).toBe(true);
    });

    it.each<[string, { search?: string; status?: string; connection?: boolean }]>([
      ["the status chip", { status: "pamAccessConnectorStatusInactive" }],
      ["the connection chip, on its false side", { connection: false }],
      ["search on a connector name", { search: "prod" }],
      [
        "every control at once",
        { search: "r", status: "pamAccessConnectorStatusActive", connection: false },
      ],
    ])("narrows the toolbar's rows the same way the flag-off path does: %s", (_, filters) => {
      const names = (vfo1: boolean): string[] => {
        const el = render(vfo1);
        if (filters.search !== undefined) {
          (
            fixture.componentInstance as unknown as {
              searchControl: { setValue: (value: string) => void };
            }
          ).searchControl.setValue(filters.search);
        }
        if (filters.status !== undefined) {
          chip("status").toggle(filters.status);
        }
        if (filters.connection !== undefined) {
          chip("connection").toggle(filters.connection);
        }
        fixture.detectChanges();
        return rowNames(el);
      };

      const off = names(false);
      expect(off.length).toBeGreaterThan(0);
      expect(names(true)).toEqual(off);
    });

    it("keeps the toolbar in place when the filters empty the table", () => {
      const el = render(true, [ROWS[0]]);
      chip("connection").toggle(false);
      fixture.detectChanges();

      expect(bodyRows(el)).toHaveLength(0);
      expect(toolbar(el).querySelector("bit-search")).not.toBeNull();
      expect(chipKeys(toolbar(el))).toEqual(["status", "connection"]);
    });

    it("keeps the row actions reachable from a row the toolbar narrowed to", () => {
      const el = render(true);
      chip("status").toggle("pamAccessConnectorStatusInactive");
      fixture.detectChanges();

      expect(rowNames(el)).toEqual(["Staging"]);
      expect(menuItems(el, 0)).toContain("pamAccessConnectorActivate");
    });
  });

  describe("loading", () => {
    beforeEach(() => {
      jest.useFakeTimers({ doNotFake: ["nextTick", "queueMicrotask", "setImmediate"] });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    function advance(ms: number): void {
      fixture.detectChanges();
      jest.advanceTimersByTime(ms);
      fixture.detectChanges();
    }

    function placeholder(): HTMLElement {
      return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
        '[data-testid="access-connectors-loading"]',
      )!;
    }

    it("stands a hidden v2 skeleton in for the list, carrying the real columns", () => {
      render(true, [], true);
      advance(1000);

      expect(placeholder().getAttribute("aria-hidden")).toBe("true");
      expect(placeholder().querySelector("bit-table-v2")).not.toBeNull();
      expect(placeholder().querySelector("bit-table")).toBeNull();
      expect(headers(placeholder()).map(text)).toEqual([
        "name",
        "status",
        "pamAccessConnectorConnection",
        "pamAccessConnectorAssignments",
        "",
      ]);
      expect(placeholder().querySelectorAll("bit-row")).toHaveLength(5);
      expect(placeholder().querySelectorAll("bit-skeleton-text").length).toBeGreaterThan(0);
    });

    it("holds the toolbar inside the table while rows load, and hands off to the real one", () => {
      const el = render(true, [], true);
      advance(1000);

      const loadingToolbar = placeholder().querySelector<HTMLElement>(
        "bit-table-v2 bit-table-toolbar",
      );
      expect(placeholder().firstElementChild!.tagName).toBe("BIT-TABLE-V2");
      expect(loadingToolbar).not.toBeNull();
      expect(loadingToolbar!.hasAttribute("inert")).toBe(true);
      expect(loadingToolbar!.querySelector("bit-search")).not.toBeNull();
      expect(
        Array.from(loadingToolbar!.querySelectorAll("bit-filter-menu")).map((menu) =>
          menu.getAttribute("key"),
        ),
      ).toEqual(["status", "connection"]);
      expect(loadingToolbar!.querySelectorAll("bit-filter-option")).toHaveLength(0);
      expect(loadingToolbar!.textContent).not.toContain("itemCount");
      expect(placeholder().querySelectorAll("bit-row").length).toBeGreaterThan(0);

      rows$.next(ROWS);
      loading$.next(false);
      advance(1000);

      expect(placeholder()).toBeNull();
      expect(el.querySelector("bit-table-v2 bit-table-toolbar")).not.toBeNull();
    });

    it("draws the headers alone, with no skeleton or empty state, before the delay is up", () => {
      render(true, [], true);
      advance(999);

      expect(headers(placeholder()).map(text)).toContain("pamAccessConnectorConnection");
      expect(placeholder().querySelector("bit-skeleton")).toBeNull();
      expect(placeholder().querySelector("bit-skeleton-text")).toBeNull();
      expect(placeholder().querySelector("bit-status-lockup")).toBeNull();
    });

    it("draws no held rows in the placeholder while a reload is in flight", () => {
      render(true, [ROWS[0]], true);
      advance(1000);

      expect(
        placeholder().querySelector('[id^="access-connectors-tab_button_detail-"]'),
      ).toBeNull();
    });

    it("replaces the skeleton with the real rows once the load lands", () => {
      render(true, [], true);
      advance(1000);
      rows$.next(ROWS);
      loading$.next(false);
      advance(1000);

      expect(placeholder()).toBeNull();
      expect(rowNames(fixture.nativeElement as HTMLElement)).toEqual(ROWS.map((r) => r.name));
    });
  });
});
