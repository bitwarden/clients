import { OverlayContainer } from "@angular/cdk/overlay";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { ActivatedRoute, Router, provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { formatTimestamp } from "@bitwarden/bit-pam";
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

import { accessConnectorDisplayStatus, accessConnectorStatusBadge } from "./access-connector-label";
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
      lastSeenAtMs: null,
      ...overrides,
      accessConnector: accessConnector({
        id,
        name,
        status:
          (overrides.enabled ?? true)
            ? AccessConnectorStatus.Enabled
            : AccessConnectorStatus.Disabled,
        isConnected: overrides.isConnected ?? true,
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

  it("asks the warning deactivate question, without the connector's name", async () => {
    (dialogService.openSimpleDialog as jest.Mock).mockResolvedValue(false);
    const component = fixture.componentInstance as unknown as {
      disable: (row: AccessConnectorRow) => Promise<void>;
    };

    await component.disable(makeAccessConnectorRow());

    expect(dialogService.openSimpleDialog).toHaveBeenCalledWith({
      title: { key: "pamAccessConnectorDeactivateDialogTitle" },
      content: { key: "pamAccessConnectorDeactivateDialogContent" },
      acceptButtonText: { key: "pamAccessConnectorDeactivate" },
      cancelButtonText: { key: "cancel" },
      type: "warning",
    });
  });

  it("asks the danger delete question, accepted with Delete access connector", async () => {
    (dialogService.openSimpleDialog as jest.Mock).mockResolvedValue(false);
    const component = fixture.componentInstance as unknown as {
      confirmDelete: (row: AccessConnectorRow) => Promise<void>;
    };

    await component.confirmDelete(makeAccessConnectorRow());

    expect(dialogService.openSimpleDialog).toHaveBeenCalledWith({
      title: { key: "pamAccessConnectorDeleteDialogTitle" },
      content: { key: "pamAccessConnectorDeleteDialogContent" },
      acceptButtonText: { key: "pamAccessConnectorDeleteAccessConnector" },
      cancelButtonText: { key: "cancel" },
      type: "danger",
    });
  });

  it("confirms each mutation with its success toast", async () => {
    (dialogService.openSimpleDialog as jest.Mock).mockResolvedValue(true);
    const component = fixture.componentInstance as unknown as {
      disable: (row: AccessConnectorRow) => Promise<void>;
      enable: (row: AccessConnectorRow) => Promise<void>;
      confirmDelete: (row: AccessConnectorRow) => Promise<void>;
    };

    await component.disable(makeAccessConnectorRow());
    await component.enable(makeAccessConnectorRow({ enabled: false }));
    await component.confirmDelete(makeAccessConnectorRow());

    expect((toastService.showToast as jest.Mock).mock.calls.map(([toast]) => toast)).toEqual([
      { variant: "success", message: "pamAccessConnectorDeactivated" },
      { variant: "success", message: "pamAccessConnectorActivated" },
      { variant: "success", message: "pamAccessConnectorDeleted" },
    ]);
  });

  /** Every mutation answers a refusal with one error toast and claims nothing else. */
  describe("a refused mutation", () => {
    type Actions = {
      disable: (row: AccessConnectorRow) => Promise<void>;
      enable: (row: AccessConnectorRow) => Promise<void>;
      confirmDelete: (row: AccessConnectorRow) => Promise<void>;
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

    it("shows the server's reason when the SDK refuses the delete", async () => {
      (accessConnectorsService.delete as jest.Mock).mockRejectedValue(
        Object.assign(
          new Error(
            'error in response: status code 400 Bad Request: {"object":"error",' +
              '"message":"This access connector still has assigned target systems."}',
          ),
          { name: "RotationError", variant: "Api" },
        ),
      );

      await actions().confirmDelete(makeAccessConnectorRow());

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "This access connector still has assigned target systems.",
      });
    });

    it("falls back to delete's own failure copy for an error with no server reason", async () => {
      (accessConnectorsService.delete as jest.Mock).mockRejectedValue(new Error("boom"));

      await actions().confirmDelete(makeAccessConnectorRow());

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "pamAccessConnectorDeleteFailed",
      });
    });

    it("falls back to deactivate's own failure copy for an error with no server reason", async () => {
      (accessConnectorsService.setEnabled as jest.Mock).mockRejectedValue(new Error("boom"));

      await actions().disable(makeAccessConnectorRow());

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "pamAccessConnectorDeactivateFailed",
      });
    });

    it("falls back to the generic message for a refused activation with no server reason", async () => {
      (accessConnectorsService.setEnabled as jest.Mock).mockRejectedValue(new Error("boom"));

      await actions().enable(makeAccessConnectorRow({ enabled: false }));

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "unexpectedError",
      });
    });
  });

  describe("in-flight row guard", () => {
    type Guarded = {
      disable: (row: AccessConnectorRow) => Promise<void>;
      confirmDelete: (row: AccessConnectorRow) => Promise<void>;
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
      (accessConnectorsService.delete as jest.Mock).mockReturnValue(pending.promise);
      const row = makeAccessConnectorRow({ id: connectorId("row-key") });
      const component = guarded();

      const first = component.confirmDelete(row);
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

    /** The reason line the item's `aria-describedby` points at, under its label. */
    function reasonLine(item: HTMLButtonElement): string | undefined {
      const id = item.getAttribute("aria-describedby");
      return id == null ? undefined : item.querySelector(`[id="${id}"]`)?.textContent?.trim();
    }

    /** The reason key the row menu's assign item states, as the component resolved it. */
    function blockedKey(): string | null {
      return (
        fixture.componentInstance as unknown as {
          rows: () => { assignTargetsBlockedKey: string | null }[];
        }
      ).rows()[0].assignTargetsBlockedKey;
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
      await openRowMenu(assignRow(true), []);
      expect(blockedKey()).toBe("pamAccessConnectorAssignNoTargetSystems");

      await openRowMenu(assignRow(true, [eligibleSystem.id]));
      expect(blockedKey()).toBe("pamAccessConnectorAssignNoOptions");
    });

    it("states a failed target-system read on the item, as the target-systems tab does", async () => {
      targetSystemsLoadError$.next(new Error("boom"));
      const item = await openRowMenu(assignRow(true), []);

      expect(item.getAttribute("aria-disabled")).toBe("true");
      expect(item.hasAttribute("disabled")).toBe(false);
      expect(reasonLine(item)).toBe("pamAccessConnectorTargetSystemsLoadError");
      expect(blockedKey()).toBe("pamAccessConnectorTargetSystemsLoadError");
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

    it("states why under the disabled assign item's label, and describes the item with it", async () => {
      const item = await openRowMenu(assignRow(false));

      expect(item.textContent).toContain("pamAccessConnectorAssignTargetSystems");
      expect(reasonLine(item)).toBe("pamAccessConnectorAssignTargetSystemsDisabled");
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

    it("renders the name as a heading-coloured link to the detail page", () => {
      const button = nameCellButton();

      expect(button.textContent).toContain("dc01 connector");
      expect(button.classList).toContain("tw-text-fg-heading");
    });

    it("keeps the name keyboard focusable", () => {
      const button = nameCellButton();

      expect(button.tagName).toBe("BUTTON");
      expect(button.getAttribute("tabindex")).not.toBe("-1");
    });
  });

  describe("last seen column", () => {
    async function renderRows(rows: AccessConnectorRow[]) {
      TestBed.resetTestingModule();
      rows$.next(rows);
      await createComponent({ renderTemplate: true });
    }

    afterEach(() => {
      rows$.next([]);
    });

    function lastSeenCellText(): string | undefined {
      return (fixture.nativeElement as HTMLElement)
        .querySelector('[data-testid="last-seen"]')
        ?.textContent?.trim();
    }

    function rowWithHeartbeat(elapsedMs: number | null): AccessConnectorRow {
      const heartbeat = elapsedMs == null ? null : new Date(Date.now() - elapsedMs);
      return makeAccessConnectorRow({
        lastSeenAtMs: heartbeat?.getTime() ?? null,
        accessConnector: { lastHeartbeatAt: heartbeat?.toISOString() ?? null } as AccessConnector,
      });
    }

    it("shows a relative time for a recent heartbeat", async () => {
      await renderRows([rowWithHeartbeat(5 * 60_000)]);

      expect(lastSeenCellText()).toContain("pamRotationRelativeMinutesAgo");
    });

    it("shows hours for a heartbeat between one and 24 hours old", async () => {
      await renderRows([rowWithHeartbeat(3 * 60 * 60_000)]);

      expect(lastSeenCellText()).toContain("pamRotationRelativeHoursAgo");
    });

    it.each([
      ["under a minute", 20_000, "justNow"],
      ["a day", 24 * 60 * 60_000, "pamRotationRelativeYesterday"],
      ["several days", 5 * 24 * 60 * 60_000, "pamRotationRelativeDaysAgo"],
      ["several weeks", 14 * 24 * 60 * 60_000, "pamRotationRelativeWeeksAgo"],
      ["several months", 95 * 24 * 60 * 60_000, "pamRotationRelativeMonthsAgo"],
    ])("shows the relative wording for a heartbeat %s old", async (_label, elapsedMs, key) => {
      await renderRows([rowWithHeartbeat(elapsedMs)]);

      expect(lastSeenCellText()).toBe(key);
    });

    it("falls back to the full date when a heartbeat is a year or more old", async () => {
      const elapsedMs = 400 * 24 * 60 * 60_000;
      const row = rowWithHeartbeat(elapsedMs);
      await renderRows([row]);

      // Format the row's own heartbeat, not `Date.now() - elapsedMs`, which drifts a second
      // when the render straddles a clock tick.
      const expected = formatTimestamp("en-US", row.lastSeenAtMs as number);
      expect(lastSeenCellText()).toBe(expected);
    });

    it("shows never when the connector has not checked in", async () => {
      await renderRows([rowWithHeartbeat(null)]);

      expect(lastSeenCellText()).toBe("never");
    });
  });

  describe("sort comparators", () => {
    type Comparator = (
      a: AccessConnectorRow,
      b: AccessConnectorRow,
      direction?: "asc" | "desc",
    ) => number;
    type Sorters = Record<"sortByStatus" | "sortByLastSeen" | "sortByAssignments", Comparator>;

    function sorters(): Sorters {
      return fixture.componentInstance as unknown as Sorters;
    }

    /** A row as the table holds it, with the status badge the component derives. */
    function tabRow(overrides: Partial<AccessConnectorRow>): AccessConnectorRow {
      const row = makeAccessConnectorRow(overrides);
      return {
        ...row,
        statusBadge: accessConnectorStatusBadge(accessConnectorDisplayStatus(row.accessConnector)),
      } as AccessConnectorRow;
    }

    function sortedNames(rows: AccessConnectorRow[], direction: "asc" | "desc" = "asc") {
      const dirMod = direction === "asc" ? 1 : -1;
      return [...rows]
        .sort((a, b) => sorters().sortByStatus(a, b, direction) * dirMod)
        .map((r) => r.name);
    }

    it("sorts by urgency: Disconnected, then Inactive, then Connected", () => {
      const rows = [
        tabRow({ name: "connected" }),
        tabRow({ name: "inactive", enabled: false, isConnected: true }),
        tabRow({ name: "disconnected", isConnected: false }),
      ];

      expect(sortedNames(rows)).toEqual(["disconnected", "inactive", "connected"]);
    });

    it("puts the connector with the most target systems first within a status, then names A to Z", () => {
      const rows = [
        tabRow({ name: "AWS production VPC", assignmentNames: [] }),
        tabRow({ name: "Azure production", assignmentNames: ["a"] }),
        tabRow({ name: "East datacenter", assignmentNames: ["a", "b", "c", "d", "e"] }),
        tabRow({ name: "Alpha", assignmentNames: ["a"] }),
      ];

      expect(sortedNames(rows)).toEqual([
        "East datacenter",
        "Alpha",
        "Azure production",
        "AWS production VPC",
      ]);
    });

    it("keeps the target-system and name tie-breaks when the status sort is reversed", () => {
      const rows = [
        tabRow({ name: "b", assignmentNames: [] }),
        tabRow({ name: "a", assignmentNames: [] }),
        tabRow({ name: "c", assignmentNames: ["x"] }),
        tabRow({ name: "z", isConnected: false }),
      ];

      expect(sortedNames(rows, "desc")).toEqual(["c", "a", "b", "z"]);
    });

    it("sorts by last seen with never-seen connectors first", () => {
      const never = makeAccessConnectorRow({ name: "a", lastSeenAtMs: null });
      const old = makeAccessConnectorRow({ name: "b", lastSeenAtMs: 1_000 });
      const recent = makeAccessConnectorRow({ name: "c", lastSeenAtMs: 2_000 });

      expect(sorters().sortByLastSeen(never, old)).toBeLessThan(0);
      expect(sorters().sortByLastSeen(old, recent)).toBeLessThan(0);
      expect(sorters().sortByLastSeen(recent, old)).toBeGreaterThan(0);
    });

    it("sorts by the number of assigned targets", () => {
      const none = makeAccessConnectorRow({ name: "b", assignmentNames: [] });
      const two = makeAccessConnectorRow({ name: "a", assignmentNames: ["x", "y"] });

      expect(sorters().sortByAssignments(none, two)).toBeLessThan(0);
    });

    it("breaks ties by name and keeps them A to Z when descending", () => {
      const a = makeAccessConnectorRow({ name: "alpha", lastSeenAtMs: null });
      const b = makeAccessConnectorRow({ name: "bravo", lastSeenAtMs: null });

      expect(sorters().sortByLastSeen(a, b, "asc")).toBeLessThan(0);
      expect(sorters().sortByLastSeen(a, b, "desc")).toBeGreaterThan(0);
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
      expect(el.textContent).not.toContain("pamAccessConnectorsEmptyTitle");
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
    searchControl: { setValue: (value: string) => void; value: string };
    statusBadges: {
      status: string;
      labelKey: string;
      iconTile: { icon: string; variant: string };
    }[];
    targetSystemOptions: () => { value: string; label: string }[];
  };

  let fixture: ComponentFixture<AccessConnectorsTabComponent>;
  let component: FiltersComp;

  const prodEntra = { id: sysId("ts-1"), name: "Prod Entra" } as unknown as TargetSystemView;
  const reportingSql = { id: sysId("ts-2"), name: "Reporting SQL" } as unknown as TargetSystemView;
  const unserved = { id: sysId("ts-3"), name: "Entra ID staging" } as unknown as TargetSystemView;

  function makeRow(overrides: {
    id: AccessConnectorId;
    name: string;
    enabled: boolean;
    isConnected: boolean;
    assigned?: TargetSystemView[];
  }): AccessConnectorRow {
    const { id, name, enabled, isConnected, assigned = [] } = overrides;
    return {
      id,
      name,
      statusLabelKey: enabled ? "active" : "inactive",
      isConnected,
      lastSeenAtMs: null,
      assignmentNames: assigned.map((s) => s.name),
      enabled,
      canAssign: enabled,
      accessConnector: accessConnector({
        id,
        name,
        status: enabled ? AccessConnectorStatus.Enabled : AccessConnectorStatus.Disabled,
        isConnected,
        assignedTargetSystemIds: assigned.map((s) => s.id),
      }),
    };
  }

  const enabledConnected = makeRow({
    id: connectorId("c-1"),
    name: "Prod on-prem",
    enabled: true,
    isConnected: true,
    assigned: [prodEntra],
  });
  const enabledOffline = makeRow({
    id: connectorId("c-2"),
    name: "Prod backup",
    enabled: true,
    isConnected: false,
    assigned: [prodEntra, reportingSql],
  });
  const disabledOffline = makeRow({
    id: connectorId("c-3"),
    name: "Staging",
    enabled: false,
    isConnected: false,
  });

  /** Renders the real template. */
  function setup(rows: AccessConnectorRow[], systems: TargetSystemView[] = [prodEntra, unserved]) {
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
            setEnabled: jest.fn().mockResolvedValue(undefined),
            delete: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: TargetSystemsService,
          useValue: {
            automaticSystems$: of(systems),
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

  it("offers every status in urgency order, iconed like its badge", () => {
    setup([enabledConnected]);
    expect(
      component.statusBadges.map(({ status, labelKey, iconTile }) => ({
        status,
        labelKey,
        iconTile,
      })),
    ).toEqual([
      {
        status: "disconnected",
        labelKey: "pamAccessConnectorDisconnected",
        iconTile: { icon: "bwi-warning", variant: "warning" },
      },
      {
        status: "inactive",
        labelKey: "inactive",
        iconTile: { icon: "bwi-minus-circle", variant: "gray" },
      },
      {
        status: "connected",
        labelKey: "pamAccessConnectorConnected",
        iconTile: { icon: "bwi-check-circle", variant: "success" },
      },
    ]);
  });

  it("offers every automatic target system and every assigned one, sorted by name", () => {
    setup([enabledConnected, enabledOffline, disabledOffline]);
    expect(component.targetSystemOptions()).toEqual([
      { value: String(unserved.id), label: "Entra ID staging" },
      { value: String(prodEntra.id), label: "Prod Entra" },
      { value: String(reportingSql.id), label: "Reporting SQL" },
    ]);
  });

  it("keeps the toolbar and shows the register empty state in the table when there are no connectors", () => {
    setup([]);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector("bit-table-v2 bit-table-toolbar bit-search")).not.toBeNull();
    expect(el.querySelectorAll("bit-table-v2 bit-filter-menu")).toHaveLength(2);
    expect(el.textContent).toContain("pamAccessConnectorsEmptyTitle");
    expect(el.textContent).toContain("pamAccessConnectorsEmptyDescription");
    const register = el.querySelector<HTMLButtonElement>(
      "#access-connectors-tab_button_register-empty",
    )!;
    expect(register.textContent).toContain("pamAccessConnectorRegister");
    expect(register.getAttribute("buttonType")).toBe("primary");
  });

  it("narrows rows to the selected status, Inactive winning over Disconnected", () => {
    setup([enabledConnected, enabledOffline, disabledOffline]);
    chip("status").toggle("disconnected");
    fixture.detectChanges();
    expect(visibleIds()).toEqual([uuidAsString(connectorId("c-2"))]);

    chip("status").toggle("inactive");
    fixture.detectChanges();
    expect(visibleIds()).toEqual(
      [uuidAsString(connectorId("c-2")), uuidAsString(connectorId("c-3"))].sort(),
    );
  });

  it("narrows rows to connectors serving a selected target system", () => {
    setup([enabledConnected, enabledOffline, disabledOffline]);
    chip("targetSystem").toggle(String(reportingSql.id));
    fixture.detectChanges();
    expect(visibleIds()).toEqual([uuidAsString(connectorId("c-2"))]);
  });

  it("ANDs the chips with each other and with the search text", () => {
    setup([enabledConnected, enabledOffline, disabledOffline]);
    component.searchControl.setValue("prod");
    chip("targetSystem").toggle(String(prodEntra.id));
    chip("status").toggle("connected");
    fixture.detectChanges();
    expect(visibleIds()).toEqual([uuidAsString(connectorId("c-1"))]);
  });

  it("offers Clear all when the filters match nothing, and it resets them", () => {
    setup([enabledConnected]);
    component.searchControl.setValue("nothing matches");
    chip("status").toggle("inactive");
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain("noItemsMatchSelectedFilters");
    expect(el.textContent).not.toContain("pamAccessConnectorsEmptyTitle");

    el.querySelector<HTMLButtonElement>("#access-connectors-tab_button_clear-all")!.click();
    fixture.detectChanges();

    expect(component.searchControl.value).toBe("");
    expect(visibleIds()).toEqual([uuidAsString(connectorId("c-1"))]);
  });
});

describe("AccessConnectorsTabComponent target systems column", () => {
  let fixture: ComponentFixture<AccessConnectorsTabComponent>;

  function makeRow(id: string, assignmentNames: string[]): AccessConnectorRow {
    return {
      id: connectorId(id),
      name: id,
      statusLabelKey: "active",
      isConnected: true,
      lastSeenAtMs: null,
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
    fixture.detectChanges();
  }

  function cellText(): string | undefined {
    return (fixture.nativeElement as HTMLElement)
      .querySelector('[data-testid="target-system-count"]')
      ?.textContent?.trim();
  }

  it("counts many assignments as plain text", () => {
    setup([makeRow("c-1", ["Prod Entra", "Reporting SQL", "Billing MSSQL", "Legacy LDAP"])]);

    expect(cellText()).toBe("pamAccessConnectorTargetSystemCount:4");
    expect(fixture.nativeElement.querySelector("button[bit-chip-action]")).toBeNull();
  });

  it("uses the singular count message for a single assignment", () => {
    setup([makeRow("c-1", ["Prod Entra"])]);

    expect(cellText()).toBe("pamAccessConnectorTargetSystemCountSingular:1");
  });

  it("reads None when nothing is assigned", () => {
    setup([makeRow("c-1", [])]);

    expect(cellText()).toBe("pamAccessConnectorAssignmentsNone");
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
      lastSeenAtMs: null,
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

  /** The table opens sorted by status urgency: Disconnected, Inactive, Connected. */
  const SORTED_NAMES = ["EU region", "Staging", "Prod on-prem"];

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

      expect(endSlot(el).children).toHaveLength(0);
      expect(el.querySelector(BUTTON_ID)).toBeNull();
      expect(el.querySelector("#access-connectors-tab_button_register-empty")).not.toBeNull();
    });
  });

  it("renders the column headings in order", () => {
    expect(headers(render()).map(text)).toEqual([
      "name",
      "status",
      "pamAccessConnectorTargetSystems",
      "pamAccessConnectorLastSeen",
      "options",
    ]);
  });

  it("gives the actions column a visible Options heading", () => {
    const actionsHeader = headers(render())[4];

    expect(text(actionsHeader)).toBe("options");
    expect(actionsHeader.querySelector(".tw-sr-only")).toBeNull();
  });

  it("renders a row of cells per connector, with one status badge each", () => {
    expect(cellTexts(render())).toEqual([
      [
        "EU region",
        "pamAccessConnectorDisconnected",
        "pamAccessConnectorTargetSystemCount:2",
        "never",
        "",
      ],
      ["Staging", "inactive", "pamAccessConnectorAssignmentsNone", "never", ""],
      [
        "Prod on-prem",
        "pamAccessConnectorConnected",
        "pamAccessConnectorTargetSystemCountSingular:1",
        "never",
        "",
      ],
    ]);
  });

  it("badges each status with its recipe and icon", () => {
    const el = render();
    const badges = bodyRows(el).map((row) =>
      row.querySelector<HTMLElement>('[id^="access-connectors-tab_status_"]')!,
    );

    expect(badges.map((b) => b.className)).toEqual([
      expect.stringContaining("tw-bg-bg-warning-soft"),
      expect.stringContaining("tw-bg-bg-secondary"),
      expect.stringContaining("tw-bg-bg-success-soft"),
    ]);
    expect(badges.map((b) => b.querySelector("bit-icon")?.className ?? "")).toEqual([
      expect.stringContaining("bwi-warning"),
      expect.stringContaining("bwi-minus-circle"),
      expect.stringContaining("bwi-check-circle"),
    ]);
  });

  it("offers the row actions in order, with no divider", () => {
    const el = render();

    expect(menuItems(el, 0)).toEqual([
      "pamAccessConnectorEdit",
      "pamAccessConnectorAssignTargetSystemspamAccessConnectorAssignNoOptions",
      "pamAccessConnectorDeactivate",
      "pamAccessConnectorDeleteAccessConnector",
    ]);
    expect(menuItems(el, 1)).toEqual([
      "pamAccessConnectorEdit",
      "pamAccessConnectorAssignTargetSystemspamAccessConnectorAssignTargetSystemsDisabled",
      "pamAccessConnectorActivate",
      "pamAccessConnectorDeleteAccessConnector",
    ]);
    expect(openMenu(el, 2).querySelector("bit-menu-divider")).toBeNull();
  });

  it("marks Delete access connector as the destructive item", () => {
    const item = openMenu(render(), 0).querySelector<HTMLElement>(
      '[id^="access-connectors-tab_button_delete-"]',
    )!;

    expect(item.getAttribute("variant")).toBe("danger");
  });

  it("opens the detail page from Edit access connector", () => {
    const el = render();
    const navigateSpy = jest.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);

    openMenu(el, 0)
      .querySelector<HTMLButtonElement>('[id^="access-connectors-tab_button_edit-"]')!
      .click();

    expect(navigateSpy).toHaveBeenCalledWith(
      ["..", "access-connectors", connectorId("c-2")],
      expect.objectContaining({ relativeTo: expect.anything() }),
    );
  });

  it("keeps the assign action aria-disabled for a disabled connector", () => {
    const el = render();
    const item = openMenu(el, 1).querySelector<HTMLButtonElement>(
      '[id^="access-connectors-tab_button_assign-"]',
    )!;

    expect(item.id).toBe(`access-connectors-tab_button_assign-locked-${connectorId("c-3")}`);
    expect(item.getAttribute("aria-disabled")).toBe("true");
    expect(item.getAttribute("aria-describedby")).toBe(
      `access-connectors-tab_reason_assign-${connectorId("c-3")}`,
    );
  });

  it("opens the assign dialog from the row menu", async () => {
    const el = render();
    openMenu(el, 2)
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
      ["..", "access-connectors", connectorId("c-2")],
      expect.objectContaining({ relativeTo: expect.anything() }),
    );
  });

  it("opens sorted by status urgency, and sorts by every data column", () => {
    const el = render([ROWS[2], ROWS[0], ROWS[1]]);

    expect(sortableHeadings(el)).toEqual([
      "name",
      "status",
      "pamAccessConnectorTargetSystems",
      "pamAccessConnectorLastSeen",
    ]);
    expect(rowNames(el)).toEqual(SORTED_NAMES);
    expect(ariaSort(el, "status")).toBe("ascending");

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
    chip("targetSystem").toggle(String(sysId("ts-2")));
    chip("status").toggle("disconnected");
    fixture.detectChanges();

    expect(rowNames(el)).toEqual(["EU region"]);
  });

  it("shows the no-results message when the filters empty the table", () => {
    const el = render([ROWS[0]]);
    chip("status").toggle("inactive");
    fixture.detectChanges();

    expect(bodyRows(el)).toHaveLength(0);
    expect(text(el.querySelector("bit-table-v2 [slot=empty]")!)).toBe(
      "noItemsMatchSelectedFilters clearAll",
    );
  });

  it("shows the no-connectors empty state inside the table", () => {
    const el = render([]);

    expect(el.querySelector("bit-table-v2")).not.toBeNull();
    expect(text(el.querySelector("bit-table-v2 [slot=empty]")!)).toContain(
      "pamAccessConnectorsEmptyTitle",
    );
  });

  it("follows a live connection change from the rows signal", () => {
    const el = render([ROWS[0]]);
    expect(cellTexts(el)[0][1]).toBe("pamAccessConnectorConnected");

    rows$.next([
      {
        ...ROWS[0],
        isConnected: false,
        accessConnector: { ...ROWS[0].accessConnector, isConnected: false } as AccessConnector,
      },
    ]);
    fixture.detectChanges();

    expect(cellTexts(el)[0][1]).toBe("pamAccessConnectorDisconnected");
  });

  it("names the row menu trigger", () => {
    const el = render();
    const trigger = el.querySelector('button[id^="access-connectors-tab_button_menu-"]')!;

    expect(trigger.getAttribute("aria-label")).toBe("options");
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
      expect(chipKeys(toolbar(el))).toEqual(["status", "targetSystem"]);
      expect(el.querySelectorAll("bit-search")).toHaveLength(1);
      expect(el.querySelectorAll("bit-filter-menu")).toHaveLength(2);
    });

    it("labels each chip", () => {
      const labels = Array.from(toolbar(render()).querySelectorAll("bit-filter-menu")).map(text);

      expect(labels[0]).toContain("status");
      expect(labels[1]).toContain("pamRotationConfigColumnTargetSystem");
    });

    it("gives the search its placeholder and leaves it enabled", () => {
      const input = toolbar(render()).querySelector("bit-search input")!;

      expect(input.getAttribute("placeholder")).toBe("search");
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
      chip("status").toggle("inactive");
      fixture.detectChanges();

      expect(bodyRows(el)).toHaveLength(0);
      expect(toolbar(el).querySelector("bit-search")).not.toBeNull();
      expect(chipKeys(toolbar(el))).toEqual(["status", "targetSystem"]);
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
    function skeletonRows(el: HTMLElement): Element[] {
      return bodyRows(el).filter((row) => row.querySelector("bit-skeleton-text") != null);
    }

    it("draws skeleton rows under the real table's columns while the list loads", () => {
      const el = render([], true);

      expect(headers(el).map(text)).toEqual([
        "name",
        "status",
        "pamAccessConnectorTargetSystems",
        "pamAccessConnectorLastSeen",
        "options",
      ]);
      expect(bodyRows(el)).toHaveLength(3);
      expect(skeletonRows(el)).toHaveLength(3);
      expect(el.querySelector("bit-status-lockup")).toBeNull();
      expect(el.textContent).not.toContain("pamAccessConnectorsEmptyTitle");
    });

    it("keeps the real toolbar in the table while rows load", () => {
      const el = render([], true);

      const loadingToolbar = el.querySelector<HTMLElement>("bit-table-v2 bit-table-toolbar");
      expect(loadingToolbar).not.toBeNull();
      expect(loadingToolbar!.querySelector("bit-search")).not.toBeNull();
      expect(el.querySelectorAll("bit-table-v2")).toHaveLength(1);
    });

    it("keeps the skeleton out of the accessibility tree", () => {
      const el = render([], true);

      const skeletons = Array.from(el.querySelectorAll("bit-table-v2 bit-skeleton > div"));
      expect(skeletons.length).toBeGreaterThan(0);
      expect(skeletons.every((s) => s.getAttribute("aria-hidden") === "true")).toBe(true);
    });

    it("draws no held rows while a reload is in flight", () => {
      const el = render([ROWS[0]], true);

      expect(rowNames(el)).toEqual([]);
      expect(skeletonRows(el)).toHaveLength(3);
    });

    it("swaps loaded rows for skeleton rows on reload, keeping the toolbar's filters", () => {
      const el = render();
      expect(rowNames(el)).toEqual(SORTED_NAMES);

      loading$.next(true);
      fixture.detectChanges();

      expect(rowNames(el)).toEqual([]);
      expect(skeletonRows(el)).toHaveLength(3);
      expect(
        Array.from(el.querySelectorAll("bit-table-v2 bit-table-toolbar bit-filter-menu")).map(
          (menu) => menu.getAttribute("key"),
        ),
      ).toEqual(["status", "targetSystem"]);

      loading$.next(false);
      fixture.detectChanges();

      expect(skeletonRows(el)).toHaveLength(0);
      expect(rowNames(el)).toEqual(SORTED_NAMES);
    });

    it("replaces the skeleton with the real rows once the load lands", () => {
      const el = render([], true);
      rows$.next(ROWS);
      loading$.next(false);
      fixture.detectChanges();

      expect(el.querySelector("bit-skeleton")).toBeNull();
      expect(rowNames(el)).toEqual(SORTED_NAMES);
    });

    it("shows the empty state once a load lands with no connectors", () => {
      const el = render([], true);
      loading$.next(false);
      fixture.detectChanges();

      expect(el.querySelector("bit-skeleton")).toBeNull();
      expect(el.querySelector("bit-table-v2")).not.toBeNull();
      expect(el.textContent).toContain("pamAccessConnectorsEmptyTitle");
    });

    it("shows no spinner while the skeleton stands in", () => {
      render([], true);

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

    it("announces the arrival once the rows land", () => {
      const el = render([], true);
      rows$.next(ROWS);
      loading$.next(false);
      fixture.detectChanges();

      expect(el.querySelector("bit-skeleton")).toBeNull();
      expect(el.querySelector('[data-testid="rotation-loading-status"]')!.textContent).toContain(
        "pamAccessConnectorsLoaded",
      );
    });
  });
});
