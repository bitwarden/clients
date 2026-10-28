import { OverlayContainer } from "@angular/cdk/overlay";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { ActivatedRoute, Router, provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { DialogService, FilterMenuComponent, ToastService } from "@bitwarden/components";

import type {
  AccessConnector,
  AccessConnectorId,
  TargetSystemId,
  TargetSystemView,
} from "../rotation";
import { AccessConnectorStatus } from "../rotation";
import { TargetSystemsService } from "../target-systems/target-systems.service";
import { deferred } from "../testing/deferred";
import { ORGANIZATION_ID, accessConnector, connectorId, sysId } from "../testing/rotation-builders";

import { AccessConnectorsTabComponent } from "./access-connectors-tab.component";
import { AccessConnectorsService, AccessConnectorRow } from "./access-connectors.service";

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
      statusLabelKey: "active",
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
      automaticSystems$: of([] as TargetSystemView[]),
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

  it("matches rows on the toolbar's search term", () => {
    const component = fixture.componentInstance as unknown as {
      rowMatchesFilter: (row: AccessConnectorRow, values: { search?: string }) => boolean;
    };

    const matchRow = makeAccessConnectorRow({ name: "production-access-connector" });
    const noMatchRow = makeAccessConnectorRow({ id: connectorId("d2"), name: "staging" });

    expect(component.rowMatchesFilter(matchRow, { search: "prod" })).toBe(true);
    expect(component.rowMatchesFilter(noMatchRow, { search: "prod" })).toBe(false);
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

  /** Every mutation answers a refusal with one error toast and claims nothing else. */
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
    const activeSystem = { id: sysId("ts-1"), name: "Prod DB" } as unknown as TargetSystemView;

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

    async function openWith(systems: TargetSystemView[], row: AccessConnectorRow): Promise<void> {
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

    function dialogData(): { options: TargetSystemView[]; noActiveAutomaticSystems: boolean } {
      return (dialogService.open as jest.Mock).mock.calls[0][1].data;
    }

    async function componentWith(
      targetSystemsLoading$: BehaviorSubject<boolean>,
      systems: TargetSystemView[] = [],
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
    const eligibleSystem = { id: sysId("ts-1"), name: "Prod DB" } as unknown as TargetSystemView;

    function assignRow(canAssign: boolean, assignedIds: TargetSystemId[] = []): AccessConnectorRow {
      return makeAccessConnectorRow({
        canAssign,
        enabled: canAssign,
        accessConnector: { assignedTargetSystemIds: assignedIds } as unknown as AccessConnector,
      });
    }

    async function openRowMenu(
      row: AccessConnectorRow,
      eligible: TargetSystemView[] = [eligibleSystem],
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
        automaticSystems$: of([] as TargetSystemView[]),
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
        'bit-row button[id^="access-connectors-tab_button_detail-"]',
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
});

describe("AccessConnectorsTabComponent toolbar filters", () => {
  type FiltersComp = {
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
      statusLabelKey: enabled ? "active" : "inactive",
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
            automaticSystems$: of([] as TargetSystemView[]),
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

    fixture = TestBed.createComponent(AccessConnectorsTabComponent);
    component = fixture.componentInstance as unknown as FiltersComp;
    fixture.detectChanges();
  }

  function chip(key: string): FilterMenuComponent {
    return fixture.debugElement.query(By.css(`bit-filter-menu[key="${key}"]`)).componentInstance;
  }

  function visibleIds(): string[] {
    const prefix = "access-connectors-tab_button_detail-";
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll(`bit-row button[id^="${prefix}"]`),
    )
      .map((button) => button.id.slice(prefix.length))
      .sort();
  }

  it("derives the status options from the loaded rows, sorted by label", () => {
    setup([enabledConnected, enabledOffline, disabledOffline]);
    expect(component.statusOptions()).toEqual([
      { value: "active", label: "active" },
      { value: "inactive", label: "inactive" },
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
    chip("status").toggle("inactive");
    fixture.detectChanges();
    expect(visibleIds()).toEqual([uuidAsString(connectorId("c-3"))]);
  });

  it("narrows rows to the offline side of the connection chip, where the value is false", () => {
    setup([enabledConnected, enabledOffline, disabledOffline]);
    chip("connection").toggle(false);
    fixture.detectChanges();
    expect(visibleIds()).toEqual(
      [uuidAsString(connectorId("c-2")), uuidAsString(connectorId("c-3"))].sort(),
    );
  });

  it("ANDs the chips with each other and with the search text", () => {
    setup([enabledConnected, enabledOffline, disabledOffline]);
    component.searchControl.setValue("prod");
    chip("connection").toggle(false);
    fixture.detectChanges();
    expect(visibleIds()).toEqual([uuidAsString(connectorId("c-2"))]);
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
      statusLabelKey: "active",
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
            automaticSystems$: of([] as TargetSystemView[]),
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

describe("AccessConnectorsTabComponent table", () => {
  let fixture: ComponentFixture<AccessConnectorsTabComponent>;
  let rows$: BehaviorSubject<AccessConnectorRow[]>;
  let loading$: BehaviorSubject<boolean>;
  let accessConnectorsService: { setEnabled: jest.Mock; delete: jest.Mock };
  let dialogService: { openSimpleDialog: jest.Mock; open: jest.Mock };
  let overlayContainer: OverlayContainer;

  const eligibleSystem = { id: sysId("ts-1"), name: "Prod DB" } as unknown as TargetSystemView;

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
      statusLabelKey: enabled ? "active" : "inactive",
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

  function render(rows: AccessConnectorRow[] = ROWS, loading = false): HTMLElement {
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

  function headers(el: HTMLElement): HTMLElement[] {
    return Array.from(el.querySelectorAll<HTMLElement>('bit-table-v2 [role="columnheader"]'));
  }

  function bodyRows(el: HTMLElement): Element[] {
    return Array.from(el.querySelectorAll("bit-table-v2 bit-row"));
  }

  function cellTexts(el: HTMLElement): string[][] {
    return bodyRows(el).map((row) => Array.from(row.querySelectorAll('[role="cell"]')).map(text));
  }

  function rowNames(el: HTMLElement): string[] {
    return Array.from(
      el.querySelectorAll('button[id^="access-connectors-tab_button_detail-"]'),
    ).map(text);
  }

  function sortableHeadings(el: HTMLElement): string[] {
    return headers(el)
      .filter((header) => header.querySelector("button") != null)
      .map(text);
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

  function endSlot(el: HTMLElement): Element {
    const toolbar = el.querySelector("bit-table-v2 bit-table-toolbar")!;
    return toolbar.querySelector("bit-search")!.parentElement!.parentElement!.lastElementChild!;
  }

  describe("create action placement", () => {
    const BUTTON_ID = "#rotation-shell_button_new-access-connector";

    it("leaves the register action to the rotation shell's Add menu, not the toolbar", () => {
      const el = render();

      expect(el.querySelector("bit-table-toolbar")).not.toBeNull();
      expect(el.querySelector(BUTTON_ID)).toBeNull();
      expect(endSlot(el).children).toHaveLength(0);
    });

    it("leaves the register action to the empty state when there are no connectors", () => {
      const el = render([]);

      expect(el.querySelector("bit-table-toolbar")).toBeNull();
      expect(el.querySelector(BUTTON_ID)).toBeNull();
      expect(el.querySelector("#access-connectors-tab_button_register-empty")).not.toBeNull();
    });
  });

  it("renders the column headings in order", () => {
    expect(headers(render()).map(text)).toEqual([
      "name",
      "status",
      "pamAccessConnectorConnection",
      "pamAccessConnectorAssignments",
      "options",
    ]);
  });

  it("gives the actions column a screen-reader-only heading", () => {
    const actionsHeader = headers(render())[4];
    const label = actionsHeader.querySelector(".tw-sr-only");

    expect(text(actionsHeader)).toBe("options");
    expect(label).not.toBeNull();
    expect(text(label as HTMLElement)).toBe("options");
  });

  it("renders a row of cells per connector", () => {
    expect(cellTexts(render())).toEqual([
      [
        "Prod on-prem",
        "active",
        "pamAccessConnectorConnected",
        "pamAccessConnectorAssignmentCountSingular:1",
        "",
      ],
      [
        "EU region",
        "active",
        "pamAccessConnectorDisconnected",
        "pamAccessConnectorAssignmentCount:2",
        "",
      ],
      [
        "Staging",
        "inactive",
        "pamAccessConnectorDisconnected",
        "pamAccessConnectorAssignmentsNone",
        "",
      ],
    ]);
  });

  it("offers the row actions in order", () => {
    const el = render();

    expect(menuItems(el, 1)).toEqual([
      "pamAccessConnectorViewDetails",
      "pamAccessConnectorAssignTargets",
      "pamAccessConnectorUnassign:Prod DB",
      "pamAccessConnectorUnassign:Reporting SQL",
      "pamAccessConnectorDeactivate",
      "pamAccessConnectorDeleteAccessConnector",
    ]);
    expect(menuItems(el, 2)).toEqual([
      "pamAccessConnectorViewDetails",
      "pamAccessConnectorAssignTargets",
      "pamAccessConnectorActivate",
      "pamAccessConnectorDeleteAccessConnector",
    ]);
  });

  it("keeps the assign action aria-disabled for a disabled connector", () => {
    const el = render();
    const item = openMenu(el, 2).querySelector<HTMLButtonElement>(
      '[id^="access-connectors-tab_button_assign-"]',
    )!;

    expect(item.id).toBe(`access-connectors-tab_button_assign-locked-${connectorId("c-3")}`);
    expect(item.getAttribute("aria-disabled")).toBe("true");
    expect(item.getAttribute("aria-describedby")).toMatch(/^bit-tooltip-\d+$/);
  });

  it("opens the assign dialog from the row menu", async () => {
    const el = render();
    openMenu(el, 0)
      .querySelector<HTMLButtonElement>('[id^="access-connectors-tab_button_assign-"]')!
      .click();
    await fixture.whenStable();

    expect(dialogService.open).toHaveBeenCalledTimes(1);
  });

  it("navigates to the detail page from the name link", () => {
    const el = render();
    const navigateSpy = jest.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);

    el.querySelector<HTMLButtonElement>(
      'button[id^="access-connectors-tab_button_detail-"]',
    )!.click();

    expect(navigateSpy).toHaveBeenCalledWith(
      ["..", "access-connectors", connectorId("c-1")],
      expect.objectContaining({ relativeTo: expect.anything() }),
    );
  });

  it("sorts only by name, unsorted until asked", () => {
    const el = render([ROWS[2], ROWS[0], ROWS[1]]);

    expect(sortableHeadings(el)).toEqual(["name"]);
    expect(rowNames(el)).toEqual(["Staging", "Prod on-prem", "EU region"]);

    clickSort(el, "name");
    expect(rowNames(el)).toEqual(["EU region", "Prod on-prem", "Staging"]);
    expect(ariaSort(el, "name")).toBe("ascending");

    clickSort(el, "name");
    expect(rowNames(el)).toEqual(["Staging", "Prod on-prem", "EU region"]);
    expect(ariaSort(el, "name")).toBe("descending");
  });

  it("filters by search text and both chips together", () => {
    const el = render();
    (
      fixture.componentInstance as unknown as {
        searchControl: { setValue: (value: string) => void };
      }
    ).searchControl.setValue("r");
    chip("connection").toggle(false);
    chip("status").toggle("active");
    fixture.detectChanges();

    expect(rowNames(el)).toEqual(["EU region"]);
  });

  it("shows the no-results message when the filters empty the table", () => {
    const el = render([ROWS[0]]);
    chip("connection").toggle(false);
    fixture.detectChanges();

    expect(bodyRows(el)).toHaveLength(0);
    expect(text(el.querySelector("bit-table-v2 [slot=empty]")!)).toBe(
      "pamAccessConnectorNoResults",
    );
  });

  it("keeps the no-connectors empty state outside the table", () => {
    const el = render([]);

    expect(el.querySelector("bit-table-v2")).toBeNull();
    expect(el.textContent).toContain("pamAccessConnectorEmptyStateTitle");
  });

  it("follows a live connection change from the rows signal", () => {
    const el = render([ROWS[0]]);
    expect(cellTexts(el)[0][2]).toBe("pamAccessConnectorConnected");

    rows$.next([{ ...ROWS[0], isConnected: false }]);
    fixture.detectChanges();

    expect(cellTexts(el)[0][2]).toBe("pamAccessConnectorDisconnected");
  });

  it("names the row menu trigger and marks the count as a disclosure", () => {
    const el = render();
    const trigger = el.querySelector('button[id^="access-connectors-tab_button_menu-"]')!;
    const count = el.querySelector<HTMLButtonElement>(
      'button[id^="access-connectors-tab_button_assignments-"]',
    )!;

    expect(trigger.getAttribute("aria-label")).toBe("options");
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
      const el = render();

      expect(toolbar(el)).not.toBeNull();
      expect(toolbar(el).querySelector("bit-search")).not.toBeNull();
      expect(chipKeys(toolbar(el))).toEqual(["status", "connection"]);
      expect(el.querySelectorAll("bit-search")).toHaveLength(1);
      expect(el.querySelectorAll("bit-filter-menu")).toHaveLength(2);
    });

    it("labels each chip and shows its unset state", () => {
      const labels = Array.from(toolbar(render()).querySelectorAll("bit-filter-menu")).map(text);

      expect(labels[0]).toContain("status");
      expect(labels[1]).toContain("pamAccessConnectorConnection");
      expect(labels.every((label) => label.includes("all"))).toBe(true);
    });

    it("gives the search its placeholder and leaves it enabled", () => {
      const input = toolbar(render()).querySelector("bit-search input")!;

      expect(input.getAttribute("placeholder")).toBe("pamAccessConnectorSearch");
      expect(input.hasAttribute("disabled")).toBe(false);
    });

    it("caps the search by making it a flex item of the toolbar, not a block child", () => {
      const search = toolbar(render()).querySelector("bit-search")!;

      expect(search.className).toContain("tw-flex-1");
    });

    it("keeps every toolbar control keyboard reachable", () => {
      const el = render();
      const focusable = Array.from(
        toolbar(el).querySelectorAll<HTMLElement>("input, button"),
      ).filter((control) => control.getAttribute("tabindex") !== "-1");

      expect(focusable.length).toBeGreaterThanOrEqual(3);
      expect(focusable.every((control) => !control.hasAttribute("disabled"))).toBe(true);
    });

    it("keeps the toolbar in place when the filters empty the table", () => {
      const el = render([ROWS[0]]);
      chip("connection").toggle(false);
      fixture.detectChanges();

      expect(bodyRows(el)).toHaveLength(0);
      expect(toolbar(el).querySelector("bit-search")).not.toBeNull();
      expect(chipKeys(toolbar(el))).toEqual(["status", "connection"]);
    });

    it("keeps the row actions reachable from a row the toolbar narrowed to", () => {
      const el = render();
      chip("status").toggle("inactive");
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

    it("stands a hidden skeleton table in for the list, carrying the real columns", () => {
      render([], true);
      advance(1000);

      expect(placeholder().getAttribute("aria-hidden")).toBe("true");
      expect(placeholder().querySelector("bit-table-v2")).not.toBeNull();
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
      const el = render([], true);
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
      expect(placeholder().querySelectorAll("bit-row").length).toBeGreaterThan(0);

      rows$.next(ROWS);
      loading$.next(false);
      advance(1000);

      expect(placeholder()).toBeNull();
      expect(el.querySelector("bit-table-v2 bit-table-toolbar")).not.toBeNull();
    });

    it("draws the headers alone, with no skeleton or empty state, before the delay is up", () => {
      render([], true);
      advance(999);

      expect(headers(placeholder()).map(text)).toContain("pamAccessConnectorConnection");
      expect(placeholder().querySelector("bit-skeleton")).toBeNull();
      expect(placeholder().querySelector("bit-skeleton-text")).toBeNull();
      expect(placeholder().querySelector("bit-status-lockup")).toBeNull();
    });

    it("draws no held rows in the placeholder while a reload is in flight", () => {
      render([ROWS[0]], true);
      advance(1000);

      expect(
        placeholder().querySelector('[id^="access-connectors-tab_button_detail-"]'),
      ).toBeNull();
    });

    it("replaces the skeleton with the real rows once the load lands", () => {
      render([], true);
      advance(1000);
      rows$.next(ROWS);
      loading$.next(false);
      advance(1000);

      expect(placeholder()).toBeNull();
      expect(rowNames(fixture.nativeElement as HTMLElement)).toEqual(ROWS.map((r) => r.name));
    });

    it("shows no spinner while the skeleton stands in", () => {
      render([], true);
      advance(1000);

      expect((fixture.nativeElement as HTMLElement).querySelector("bit-spinner")).toBeNull();
    });

    it("announces the load from a live region while the skeleton stands in", () => {
      render([], true);
      const status = (fixture.nativeElement as HTMLElement).querySelector(
        '[data-testid="rotation-loading-status"]',
      );

      expect(status!.getAttribute("role")).toBe("status");
      expect(status!.getAttribute("aria-live")).toBe("polite");
      expect(status!.textContent).toContain("loading");
    });

    it("announces the load at once, not on the placeholder's clock", () => {
      const el = render([], true);

      expect(el.querySelector('[data-testid="rotation-loading-status"]')!.textContent).toContain(
        "loading",
      );
      expect(el.querySelector("bit-skeleton")).toBeNull();
    });

    it("announces the arrival once the rows land", () => {
      const el = render([], true);
      advance(1000);
      rows$.next(ROWS);
      loading$.next(false);
      advance(1000);

      expect(el.querySelector("bit-skeleton")).toBeNull();
      expect(el.querySelector('[data-testid="rotation-loading-status"]')!.textContent).toContain(
        "pamAccessConnectorsLoaded",
      );
    });

    it("never draws the placeholder for a list that arrives inside the delay", () => {
      const el = render([], true);
      advance(500);
      rows$.next(ROWS);
      loading$.next(false);
      advance(1000);

      expect(el.querySelector("bit-skeleton")).toBeNull();
      expect(placeholder()).toBeNull();
    });

    it("holds the placeholder its minimum time once it is up, so it cannot blink", () => {
      const el = render([], true);
      advance(1000);
      expect(el.querySelector("bit-skeleton")).not.toBeNull();

      rows$.next(ROWS);
      loading$.next(false);
      advance(300);

      expect(el.querySelector("bit-skeleton")).not.toBeNull();

      advance(700);

      expect(el.querySelector("bit-skeleton")).toBeNull();
    });
  });
});
