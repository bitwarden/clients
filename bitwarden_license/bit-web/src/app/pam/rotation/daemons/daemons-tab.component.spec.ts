import { OverlayContainer } from "@angular/cdk/overlay";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { ActivatedRoute, Router, provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, FilterMenuComponent, ToastService } from "@bitwarden/components";

import type { AccessConnector, AccessConnectorId, TargetSystemId, TargetSystem } from "../rotation";
import { AccessConnectorStatus } from "../rotation";
import { TargetSystemsService } from "../target-systems/target-systems.service";
import { deferred } from "../testing/deferred";
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
  const loadError$ = new BehaviorSubject<unknown | null>(null);
  const targetSystemsLoadError$ = new BehaviorSubject<unknown | null>(null);

  function makeDaemonRow(overrides: Partial<DaemonRow> = {}): DaemonRow {
    const id = overrides.id ?? connectorId("daemon-1");
    const name = overrides.name ?? "Test Daemon";
    return {
      id,
      name,
      statusLabelKey: "pamAccessConnectorStatusActive",
      isConnected: true,
      assignmentNames: [],
      enabled: true,
      canAssign: true,
      ...overrides,
      daemon: accessConnector({ id, name, isConnected: true, ...(overrides.daemon ?? {}) }),
    };
  }

  async function createComponent({ renderTemplate = false } = {}) {
    if (!renderTemplate) {
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
    expect(component.dataSource.data).toEqual([
      { ...row, assignTargetsBlockedKey: "pamAccessConnectorAssignNoTargetSystems" },
    ]);
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

  it("does not disable when confirmation is canceled", async () => {
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

  it("does not delete when confirmation is canceled", async () => {
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
    const row = makeDaemonRow();

    const component = fixture.componentInstance as unknown as {
      unassign: (row: DaemonRow, targetId: TargetSystemId, name: string) => Promise<void>;
    };
    await component.unassign(row, sysId("ts-1"), "Prod");

    expect(daemonsService.unassign).toHaveBeenCalledWith(row.daemon, sysId("ts-1"));
  });

  it("does not unassign when confirmation is canceled", async () => {
    (dialogService.openSimpleDialog as jest.Mock).mockResolvedValue(false);
    const row = makeDaemonRow();

    const component = fixture.componentInstance as unknown as {
      unassign: (row: DaemonRow, targetId: TargetSystemId, name: string) => Promise<void>;
    };
    await component.unassign(row, sysId("ts-1"), "Prod");

    expect(daemonsService.unassign).not.toHaveBeenCalled();
    expect(toastService.showToast).not.toHaveBeenCalled();
  });

  /**
   * Every mutation on this tab answers a refusal the same way: one error toast, nothing else
   * claimed.
   */
  describe("a refused mutation", () => {
    type Actions = {
      disable: (row: DaemonRow) => Promise<void>;
      enable: (row: DaemonRow) => Promise<void>;
      confirmDelete: (row: DaemonRow) => Promise<void>;
      unassign: (row: DaemonRow, targetId: TargetSystemId, name: string) => Promise<void>;
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
      (daemonsService.setEnabled as jest.Mock).mockRejectedValue(new Error("boom"));

      await actions().disable(makeDaemonRow());

      expectedErrorToast();
    });

    it("reports a refused activation", async () => {
      (daemonsService.setEnabled as jest.Mock).mockRejectedValue(new Error("boom"));

      await actions().enable(makeDaemonRow());

      expectedErrorToast();
    });

    it("reports a refused delete", async () => {
      (daemonsService.delete as jest.Mock).mockRejectedValue(new Error("boom"));

      await actions().confirmDelete(makeDaemonRow());

      expectedErrorToast();
    });

    it("reports a refused unassign", async () => {
      (daemonsService.unassign as jest.Mock).mockRejectedValue(new Error("boom"));

      await actions().unassign(makeDaemonRow(), sysId("ts-1"), "Prod");

      expectedErrorToast();
    });
  });

  describe("in-flight row guard", () => {
    type Guarded = {
      disable: (row: DaemonRow) => Promise<void>;
      confirmDelete: (row: DaemonRow) => Promise<void>;
      unassign: (row: DaemonRow, targetId: TargetSystemId, name: string) => Promise<void>;
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
      (daemonsService.setEnabled as jest.Mock).mockReturnValue(pending.promise);
      const row = makeDaemonRow();
      const component = guarded();

      const first = component.disable(row);
      const second = component.disable(row);
      pending.settle();
      await Promise.all([first, second]);

      expect(daemonsService.setEnabled).toHaveBeenCalledTimes(1);
    });

    it("does not dispatch a second delete while the first is unsettled", async () => {
      const pending = deferred();
      (daemonsService.delete as jest.Mock).mockReturnValue(pending.promise);
      const row = makeDaemonRow();
      const component = guarded();

      const first = component.confirmDelete(row);
      const second = component.confirmDelete(row);
      pending.settle();
      await Promise.all([first, second]);

      expect(daemonsService.delete).toHaveBeenCalledTimes(1);
    });

    it("re-enables the row once the request settles", async () => {
      const pending = deferred();
      (daemonsService.setEnabled as jest.Mock).mockReturnValue(pending.promise);
      const row = makeDaemonRow();
      const component = guarded();

      const first = component.disable(row);
      expect(component.isRowBusy(row.id)).toBe(true);

      pending.settle();
      await first;
      expect(component.isRowBusy(row.id)).toBe(false);

      await component.disable(row);
      expect(daemonsService.setEnabled).toHaveBeenCalledTimes(2);
    });

    it("marks the row busy under the id the row menu binds, on every action", async () => {
      const pending = deferred();
      (daemonsService.unassign as jest.Mock).mockReturnValue(pending.promise);
      const row = makeDaemonRow({ id: connectorId("row-key") });
      const component = guarded();

      const first = component.unassign(row, sysId("ts-1"), "Prod");
      expect(component.isRowBusy(row.id)).toBe(true);

      pending.settle();
      await first;
      expect(component.isRowBusy(row.id)).toBe(false);
    });

    it("allows a second action on a different row while one is in flight", async () => {
      const pending = deferred();
      (daemonsService.setEnabled as jest.Mock).mockReturnValue(pending.promise);
      const rowA = makeDaemonRow({ id: connectorId("1") });
      const rowB = makeDaemonRow({ id: connectorId("2") });
      const component = guarded();

      const first = component.disable(rowA);
      const second = component.disable(rowB);
      pending.settle();
      await Promise.all([first, second]);

      expect(daemonsService.setEnabled).toHaveBeenCalledTimes(2);
    });
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
        automaticSystems$: of(systems),
        loading$: of(false),
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

    it("assigns the picked target and reports it", async () => {
      TestBed.resetTestingModule();
      targetSystemsService = {
        automaticSystems$: of([activeSystem]),
        loading$: of(false),
        loadError$: targetSystemsLoadError$.asObservable(),
        load: jest.fn().mockResolvedValue(undefined),
      } as unknown as jest.Mocked<TargetSystemsService>;
      await createComponent();
      const row = daemonWithAssignments();
      (dialogService.open as jest.Mock).mockReturnValue({ closed: of(String(activeSystem.id)) });

      await (
        fixture.componentInstance as unknown as {
          openAssignDialog: (row: DaemonRow) => Promise<void>;
        }
      ).openAssignDialog(row);

      expect(daemonsService.assign).toHaveBeenCalledWith(row.daemon, activeSystem.id);
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
      (daemonsService.assign as jest.Mock).mockRejectedValue(new Error("boom"));

      await (
        fixture.componentInstance as unknown as {
          openAssignDialog: (row: DaemonRow) => Promise<void>;
        }
      ).openAssignDialog(daemonWithAssignments());

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
    });

    it("does not flag when the only active system is already assigned to this daemon", async () => {
      await openWith([activeSystem], daemonWithAssignments(activeSystem.id));

      expect(dialogData().options).toEqual([]);
      expect(dialogData().noActiveAutomaticSystems).toBe(false);
    });
  });

  describe("assign availability", () => {
    const eligibleSystem = { id: sysId("ts-1"), name: "Prod DB" } as unknown as TargetSystem;

    function assignRow(canAssign: boolean, assignedIds: TargetSystemId[] = []): DaemonRow {
      return makeDaemonRow({
        canAssign,
        enabled: canAssign,
        daemon: { assignedTargetSystemIds: assignedIds } as unknown as AccessConnector,
      });
    }

    async function openRowMenu(
      row: DaemonRow,
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
        .querySelector<HTMLButtonElement>('button[id^="daemons-tab_button_menu-"]')!
        .click();
      fixture.detectChanges();

      return document.querySelector<HTMLButtonElement>(
        '.bit-menu-panel [id^="daemons-tab_button_assign-"]',
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
        .querySelector<HTMLButtonElement>('button[id^="daemons-tab_button_menu-"]')!
        .click();
      fixture.detectChanges();

      expect(
        document
          .querySelector<HTMLButtonElement>('.bit-menu-panel [id^="daemons-tab_button_assign-"]')!
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
      rows$.next([makeDaemonRow({ name: "dc01 connector" })]);

      await createComponent({ renderTemplate: true });
    });

    afterEach(() => {
      rows$.next([]);
    });

    function nameCellButton(): HTMLButtonElement {
      return (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
        'tbody tr td:first-child button[id^="daemons-tab_button_detail-"]',
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
      expect(el.querySelector('[data-testid="daemons-loading"]')).toBeNull();

      loading$.next(false);
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
      const loading = el.querySelector('[data-testid="daemons-loading"]');

      expect(el.querySelector("bit-spinner")).toBeNull();
      expect(loading).not.toBeNull();
      expect(loading!.querySelectorAll("bit-skeleton-text").length).toBeGreaterThan(0);
      expect(loading!.textContent).toContain("pamAccessConnectorConnection");
      expect(loading!.textContent).toContain("pamAccessConnectorAssignments");
    });

    it("keeps the placeholder itself out of the accessibility tree", () => {
      const loading = (fixture.nativeElement as HTMLElement).querySelector(
        '[data-testid="daemons-loading"]',
      );

      expect(loading!.getAttribute("aria-hidden")).toBe("true");
    });

    it("stands a placeholder in for the toolbar rather than offering row-derived filters", () => {
      showSkeleton();
      const el = fixture.nativeElement as HTMLElement;

      expect(el.querySelector("bit-search")).toBeNull();
      expect(el.querySelector("bit-filter-menu")).toBeNull();
      expect(
        el.querySelectorAll('[data-testid="daemons-loading"] > div:first-child bit-skeleton')
          .length,
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
      rows$.next([makeDaemonRow({ name: "dc01 connector" })]);
      loading$.next(false);
      advance(1000);

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('[data-testid="daemons-loading"]')).toBeNull();
      expect(el.querySelector("bit-skeleton")).toBeNull();
      expect(
        el.querySelector('tbody tr td:first-child button[id^="daemons-tab_button_detail-"]')!
          .textContent,
      ).toContain("dc01 connector");
      expect(el.querySelector('[data-testid="rotation-loading-status"]')!.textContent).toContain(
        "pamAccessConnectorsLoaded",
      );
    });

    it("renders the tab's own furniture, not a blank area, before the delay is up", () => {
      advance(999);

      const el = fixture.nativeElement as HTMLElement;
      const loading = el.querySelector('[data-testid="daemons-loading"]');
      expect(loading).not.toBeNull();
      expect(el.querySelector("bit-skeleton")).toBeNull();
      expect(loading!.textContent).toContain("pamAccessConnectorConnection");
    });

    it("never draws the placeholder for a list that arrives inside the delay", () => {
      advance(500);
      rows$.next([makeDaemonRow({ name: "dc01 connector" })]);
      loading$.next(false);
      advance(1000);

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector("bit-skeleton")).toBeNull();
      expect(el.querySelector('[data-testid="daemons-loading"]')).toBeNull();
    });

    it("holds the placeholder its minimum time once it is up, so it cannot blink", () => {
      showSkeleton();
      expect((fixture.nativeElement as HTMLElement).querySelector("bit-skeleton")).not.toBeNull();

      rows$.next([makeDaemonRow({ name: "dc01 connector" })]);
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
        ? "pamAccessConnectorStatusActive"
        : "pamAccessConnectorStatusInactive",
      isConnected,
      assignmentNames: [],
      enabled,
      canAssign: enabled,
      daemon: accessConnector({
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
  function setup(rows: DaemonRow[]) {
    TestBed.configureTestingModule({
      imports: [DaemonsTabComponent],
      providers: [
        provideRouter([]),
        {
          provide: DaemonsService,
          useValue: {
            loading$: new BehaviorSubject<boolean>(false),
            loadError$: new BehaviorSubject<unknown | null>(null),
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
            automaticSystems$: of([] as TargetSystem[]),
            loading$: of(false),
            loadError$: new BehaviorSubject<unknown | null>(null),
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

describe("DaemonsTabComponent assigned targets column", () => {
  let fixture: ComponentFixture<DaemonsTabComponent>;
  let overlayContainer: OverlayContainer;

  function makeRow(id: string, assignmentNames: string[]): DaemonRow {
    return {
      id: connectorId(id),
      name: id,
      statusLabelKey: "pamAccessConnectorStatusActive",
      isConnected: true,
      assignmentNames,
      enabled: true,
      canAssign: true,
      daemon: accessConnector({ id: connectorId(id), name: id }),
    };
  }

  /** Renders the real template. */
  function setup(rows: DaemonRow[]) {
    TestBed.configureTestingModule({
      imports: [DaemonsTabComponent],
      providers: [
        provideRouter([]),
        {
          provide: DaemonsService,
          useValue: {
            loading$: new BehaviorSubject<boolean>(false),
            loadError$: new BehaviorSubject<unknown | null>(null),
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
        {
          provide: ActivatedRoute,
          useValue: { params: of({ organizationId: ORGANIZATION_ID }) },
        },
      ],
    });

    fixture = TestBed.createComponent(DaemonsTabComponent);
    overlayContainer = TestBed.inject(OverlayContainer);
    fixture.detectChanges();
  }

  function countButtons(): HTMLButtonElement[] {
    return fixture.debugElement
      .queryAll(By.css('button[id^="daemons-tab_button_assignments-"]'))
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
