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
import {
  AccessConnectorStatus,
  type AccessConnector,
  type TargetSystem,
  type TargetSystemId,
} from "../rotation";
import { TargetSystemKind, TargetSystemMethod, TargetSystemStatus } from "../rotation";
import { deferred } from "../testing/deferred";
import {
  accessConnector,
  connectorId,
  ORGANIZATION_ID,
  sysId,
  targetSystem,
} from "../testing/rotation-builders";

import { TargetSystemRow, TargetSystemsTabComponent } from "./target-systems-tab.component";
import { TargetSystemsService } from "./target-systems.service";

/** Echoes the key as its translation so form-field components don't crash. */
const i18nFake: Pick<I18nService, "t" | "translate"> = {
  t: (id: string) => id,
  translate: (id: string) => id,
};

function makeSystem(overrides: Partial<TargetSystem> = {}): TargetSystem {
  return targetSystem({ id: sysId("sys-1"), passwordPolicy: null, ...overrides });
}

describe("TargetSystemsTabComponent", () => {
  let fixture: ComponentFixture<TargetSystemsTabComponent>;
  let component: TargetSystemsTabComponent;
  let targetSystemsService: {
    loading$: BehaviorSubject<boolean>;
    loadError$: BehaviorSubject<unknown | null>;
    systems$: BehaviorSubject<TargetSystem[]>;
    systemById$: BehaviorSubject<Map<string, TargetSystem>>;
    activeAutomaticSystems$: BehaviorSubject<TargetSystem[]>;
    load: jest.Mock;
    setEnabled: jest.Mock;
    delete: jest.Mock;
  };
  let daemonsService: {
    daemons$: BehaviorSubject<AccessConnector[]>;
    loading$: BehaviorSubject<boolean>;
    loadError$: BehaviorSubject<unknown | null>;
    load: jest.Mock;
    forgetTargetSystem: jest.Mock;
    assign: jest.Mock;
  };
  let router: Router;
  let dialogService: ReturnType<typeof mock<DialogService>>;
  let toastService: ReturnType<typeof mock<ToastService>>;

  async function createComponent({ renderTemplate = false } = {}) {
    if (!renderTemplate) {
      TestBed.overrideComponent(TargetSystemsTabComponent, { set: { template: "", imports: [] } });
    }

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
  }

  beforeEach(async () => {
    targetSystemsService = {
      loading$: new BehaviorSubject<boolean>(false),
      loadError$: new BehaviorSubject<unknown | null>(null),
      systems$: new BehaviorSubject<TargetSystem[]>([]),
      systemById$: new BehaviorSubject(new Map()),
      activeAutomaticSystems$: new BehaviorSubject<TargetSystem[]>([]),
      load: jest.fn().mockResolvedValue(undefined),
      setEnabled: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    daemonsService = {
      daemons$: new BehaviorSubject<AccessConnector[]>([]),
      loading$: new BehaviorSubject<boolean>(false),
      loadError$: new BehaviorSubject<unknown | null>(null),
      load: jest.fn().mockResolvedValue(undefined),
      forgetTargetSystem: jest.fn(),
      assign: jest.fn().mockResolvedValue(undefined),
    };
    dialogService = mock<DialogService>();
    dialogService.openSimpleDialog.mockResolvedValue(false);
    toastService = mock<ToastService>();

    await createComponent();
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

    it("does not call setEnabled when confirmation is canceled", fakeAsync(() => {
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

    it("confirms with a danger dialog naming the target system and the reversible alternative", fakeAsync(() => {
      const sys = makeSystem({ id: sysId("sys-1"), name: "Prod Entra" });
      dialogService.openSimpleDialog.mockResolvedValue(true);

      void (component as unknown as DeleteComp).confirmDelete(sys);
      flushMicrotasks();

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "danger",
          content: {
            key: "pamTargetSystemDeleteContentDeactivateInstead",
            placeholders: ["Prod Entra"],
          },
        }),
      );
    }));

    it("names the connector assignments the delete takes with it", fakeAsync(() => {
      const sys = makeSystem({ id: sysId("sys-1"), name: "Prod Entra" });
      daemonsService.daemons$.next([
        accessConnector({ id: connectorId("c-1"), assignedTargetSystemIds: [sys.id] }),
      ]);
      fixture.detectChanges();
      dialogService.openSimpleDialog.mockResolvedValue(true);

      void (component as unknown as DeleteComp).confirmDelete(sys);
      flushMicrotasks();

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          content: {
            key: "pamTargetSystemDeleteAssignedConnectorsContent",
            placeholders: ["Prod Entra"],
          },
        }),
      );
    }));

    it("keeps the plain copy when the connector read cannot say either way", fakeAsync(() => {
      const sys = makeSystem({ id: sysId("sys-1"), name: "Prod Entra" });
      daemonsService.loadError$.next(new Error("boom"));
      fixture.detectChanges();
      dialogService.openSimpleDialog.mockResolvedValue(true);

      void (component as unknown as DeleteComp).confirmDelete(sys);
      flushMicrotasks();

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          content: {
            key: "pamTargetSystemDeleteContentDeactivateInstead",
            placeholders: ["Prod Entra"],
          },
        }),
      );
    }));

    it("does not delete when confirmation is canceled", fakeAsync(() => {
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

  describe("in-flight row guard", () => {
    type Guarded = {
      disable: (s: TargetSystem) => Promise<void>;
      enable: (s: TargetSystem) => Promise<void>;
      confirmDelete: (s: TargetSystem) => Promise<void>;
      openAssignConnectorDialog: (s: TargetSystem) => Promise<void>;
      isRowBusy: (rowId: TargetSystemId) => boolean;
    };

    function guarded(): Guarded {
      return component as unknown as Guarded;
    }

    beforeEach(() => {
      dialogService.openSimpleDialog.mockResolvedValue(true);
    });

    it("does not dispatch a second setEnabled while the first is unsettled", async () => {
      const pending = deferred();
      targetSystemsService.setEnabled.mockReturnValue(pending.promise);
      const sys = makeSystem({ status: TargetSystemStatus.Active });
      const comp = guarded();

      const first = comp.disable(sys);
      const second = comp.disable(sys);
      pending.settle();
      await Promise.all([first, second]);

      expect(targetSystemsService.setEnabled).toHaveBeenCalledTimes(1);
    });

    it("does not dispatch a second delete while the first is unsettled", async () => {
      const pending = deferred();
      targetSystemsService.delete.mockReturnValue(pending.promise);
      const sys = makeSystem();
      const comp = guarded();

      const first = comp.confirmDelete(sys);
      const second = comp.confirmDelete(sys);
      pending.settle();
      await Promise.all([first, second]);

      expect(targetSystemsService.delete).toHaveBeenCalledTimes(1);
    });

    it("re-enables the row once the request settles", async () => {
      const pending = deferred();
      targetSystemsService.setEnabled.mockReturnValue(pending.promise);
      const sys = makeSystem({ status: TargetSystemStatus.Disabled });
      const comp = guarded();

      const first = comp.enable(sys);
      expect(comp.isRowBusy(sys.id)).toBe(true);

      pending.settle();
      await first;
      expect(comp.isRowBusy(sys.id)).toBe(false);

      await comp.enable(sys);
      expect(targetSystemsService.setEnabled).toHaveBeenCalledTimes(2);
    });

    it("holds the row busy while an assignment is in flight", async () => {
      const pending = deferred();
      const connector = accessConnector({
        id: connectorId("c-1"),
        status: AccessConnectorStatus.Enabled,
      });
      daemonsService.daemons$.next([connector]);
      daemonsService.assign.mockReturnValue(pending.promise);
      dialogService.open.mockReturnValue({ closed: of(connectorId("c-1")) } as any);
      const sys = makeSystem();
      const comp = guarded();

      const first = comp.openAssignConnectorDialog(sys);
      expect(comp.isRowBusy(sys.id)).toBe(true);

      pending.settle();
      await first;
      expect(comp.isRowBusy(sys.id)).toBe(false);
    });

    it("does not dispatch a second assignment while the first is unsettled", async () => {
      const pending = deferred();
      const connector = accessConnector({
        id: connectorId("c-1"),
        status: AccessConnectorStatus.Enabled,
      });
      daemonsService.daemons$.next([connector]);
      daemonsService.assign.mockReturnValue(pending.promise);
      dialogService.open.mockReturnValue({ closed: of(connectorId("c-1")) } as any);
      const sys = makeSystem();
      const comp = guarded();

      const first = comp.openAssignConnectorDialog(sys);
      const second = comp.openAssignConnectorDialog(sys);
      pending.settle();
      await Promise.all([first, second]);

      expect(daemonsService.assign).toHaveBeenCalledTimes(1);
    });

    it("allows a second action on a different row while one is in flight", async () => {
      const pending = deferred();
      targetSystemsService.setEnabled.mockReturnValue(pending.promise);
      const comp = guarded();

      const first = comp.disable(makeSystem({ id: sysId("sys-1") }));
      const second = comp.disable(makeSystem({ id: sysId("sys-2") }));
      pending.settle();
      await Promise.all([first, second]);

      expect(targetSystemsService.setEnabled).toHaveBeenCalledTimes(2);
    });
  });

  describe("load error state", () => {
    beforeEach(async () => {
      TestBed.resetTestingModule();

      await createComponent({ renderTemplate: true });
    });

    it("renders the load-error state instead of the empty state", () => {
      targetSystemsService.loadError$.next(new Error("boom"));
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector("pam-rotation-load-error")).not.toBeNull();
      expect(el.textContent).toContain("pamRotationListLoadErrorTitle");
      expect(el.textContent).not.toContain("pamNoTargetSystemsYetTitle");
      expect(el.textContent).not.toContain("pamTargetSystemsStartFromTemplate");
    });

    it("renders the load-error state while the load is still in flight", () => {
      targetSystemsService.loadError$.next(new Error("boom"));
      targetSystemsService.loading$.next(true);
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector("pam-rotation-load-error")).not.toBeNull();
      expect(el.querySelector('[data-testid="target-systems-loading"]')).toBeNull();

      targetSystemsService.loading$.next(false);
    });

    it("retries the load from the error state", async () => {
      targetSystemsService.loadError$.next(new Error("boom"));
      fixture.detectChanges();
      targetSystemsService.load.mockClear();

      (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLButtonElement>("#rotation-load-error_button_retry")!
        .click();
      await fixture.whenStable();

      expect(targetSystemsService.load).toHaveBeenCalledWith(ORGANIZATION_ID);
    });

    it("hands focus back to Try again when the retry fails too", async () => {
      targetSystemsService.loadError$.next(new Error("boom"));
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      el.querySelector<HTMLButtonElement>("#rotation-load-error_button_retry")!.click();
      targetSystemsService.loadError$.next(null);
      fixture.detectChanges();
      targetSystemsService.loadError$.next(new Error("boom again"));
      await fixture.whenStable();
      fixture.detectChanges();

      expect(document.activeElement).toBe(el.querySelector("#rotation-load-error_button_retry"));
    });
  });

  describe("name column", () => {
    async function nameCellButton(): Promise<HTMLButtonElement> {
      TestBed.resetTestingModule();
      targetSystemsService.systems$.next([makeSystem({ name: "dc01 service accounts" })]);
      await createComponent({ renderTemplate: true });

      return (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
        "tbody tr td:first-child button",
      )!;
    }

    it("renders the name as a primary link", async () => {
      const button = await nameCellButton();

      expect(button.textContent).toContain("dc01 service accounts");
      expect(button.classList).toContain("tw-text-fg-brand");
    });

    it("keeps the name keyboard focusable", async () => {
      const button = await nameCellButton();

      expect(button.tagName).toBe("BUTTON");
      expect(button.getAttribute("tabindex")).not.toBe("-1");
    });
  });

  describe("session termination column", () => {
    async function terminationCell(supportsSessionTermination: boolean): Promise<HTMLElement> {
      TestBed.resetTestingModule();
      targetSystemsService.systems$.next([makeSystem({ supportsSessionTermination })]);
      await createComponent({ renderTemplate: true });

      return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
        "tbody tr td:nth-child(5)",
      )!;
    }

    it("badges a system that supports termination", async () => {
      const cell = await terminationCell(true);

      expect(cell.textContent).toContain("pamTargetSystemSessionTerminationYes");
    });

    it("names the negative state rather than leaving the cell empty", async () => {
      const cell = await terminationCell(false);

      expect(cell.textContent).toContain("pamTargetSystemSessionTerminationNo");
    });
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

  describe("assign connectors availability", () => {
    const target = makeSystem({
      id: sysId("sys-1"),
      status: TargetSystemStatus.Active,
      method: TargetSystemMethod.Automatic,
    });

    async function openRowMenu(connectors: AccessConnector[]): Promise<HTMLButtonElement> {
      TestBed.resetTestingModule();
      targetSystemsService.systems$.next([target]);
      daemonsService.daemons$.next(connectors);
      await createComponent({ renderTemplate: true });

      (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLButtonElement>('td button[bitIconButton="bwi-ellipsis-h"]')!
        .click();
      fixture.detectChanges();

      return document.querySelector<HTMLButtonElement>(
        '.bit-menu-panel [id^="target-systems-tab_button_assign-connectors"]',
      )!;
    }

    function blockedKey(): string | null {
      return (component as unknown as { dataSource: { data: TargetSystemRow[] } }).dataSource
        .data[0].assignConnectorsBlockedKey;
    }

    const available = accessConnector({
      id: connectorId("c-available"),
      status: AccessConnectorStatus.Enabled,
    });

    afterEach(() => {
      targetSystemsService.systems$.next([]);
      daemonsService.daemons$.next([]);
      daemonsService.loading$.next(false);
    });

    it("renders the assign item without aria-disabled when a connector can be assigned", async () => {
      const item = await openRowMenu([available]);

      expect(item.getAttribute("aria-disabled")).toBeNull();
      expect(blockedKey()).toBeNull();
    });

    it("disables the assign item when every active connector is already on this target", async () => {
      const item = await openRowMenu([
        accessConnector({
          id: connectorId("c-assigned"),
          status: AccessConnectorStatus.Enabled,
          assignedTargetSystemIds: [target.id],
        }),
      ]);

      expect(item.getAttribute("aria-disabled")).toBe("true");
      expect(item.hasAttribute("disabled")).toBe(false);
      expect(blockedKey()).toBe("pamTargetSystemAssignConnectorNoOptions");
    });

    it("names the no-connector case apart, since it is a different sentence to an admin", async () => {
      const item = await openRowMenu([
        accessConnector({ id: connectorId("c-off"), status: AccessConnectorStatus.Disabled }),
      ]);

      expect(item.getAttribute("aria-disabled")).toBe("true");
      expect(blockedKey()).toBe("pamTargetSystemAssignConnectorNone");
    });

    it("describes the disabled assign item with the tooltip explaining why", async () => {
      const item = await openRowMenu([]);

      expect(item.getAttribute("aria-describedby")).toMatch(/^bit-tooltip-\d+$/);
    });

    it("leaves the live assign item undescribed", async () => {
      const item = await openRowMenu([available]);

      expect(item.getAttribute("aria-describedby")).toBeNull();
    });

    it("opens no dialog when the disabled assign item is clicked", async () => {
      (await openRowMenu([])).click();
      await fixture.whenStable();

      expect(dialogService.open).not.toHaveBeenCalled();
      expect(document.querySelector(".bit-menu-panel")).not.toBeNull();
    });

    it("states the failure on the assign item when the connector read failed", async () => {
      TestBed.resetTestingModule();
      targetSystemsService.systems$.next([target]);
      daemonsService.daemons$.next([]);
      daemonsService.loading$.next(false);
      daemonsService.loadError$.next(new Error("boom"));
      await createComponent({ renderTemplate: true });

      (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLButtonElement>('td button[bitIconButton="bwi-ellipsis-h"]')!
        .click();
      fixture.detectChanges();

      const item = document.querySelector<HTMLButtonElement>(
        '.bit-menu-panel [id^="target-systems-tab_button_assign-connectors"]',
      )!;
      expect(item.getAttribute("aria-disabled")).toBe("true");
      expect(blockedKey()).toBe("pamTargetSystemConnectorAssignmentsLoadError");

      item.click();
      await fixture.whenStable();
      expect(dialogService.open).not.toHaveBeenCalled();
    });

    it("leaves the assign item live while the connector list is still being read", async () => {
      TestBed.resetTestingModule();
      targetSystemsService.systems$.next([target]);
      daemonsService.daemons$.next([]);
      daemonsService.loading$.next(true);
      await createComponent({ renderTemplate: true });

      (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLButtonElement>('td button[bitIconButton="bwi-ellipsis-h"]')!
        .click();
      fixture.detectChanges();

      expect(
        document
          .querySelector<HTMLButtonElement>(
            '.bit-menu-panel [id^="target-systems-tab_button_assign-connectors"]',
          )!
          .getAttribute("aria-disabled"),
      ).toBeNull();
    });
  });

  describe("canAddManagedCredential row flag", () => {
    it("is true for any active target, whatever its method", () => {
      targetSystemsService.systems$.next([
        makeSystem({
          id: sysId("sys-active-automatic"),
          status: TargetSystemStatus.Active,
          method: TargetSystemMethod.Automatic,
        }),
        makeSystem({
          id: sysId("sys-active-manual"),
          status: TargetSystemStatus.Active,
          method: TargetSystemMethod.Manual,
        }),
        makeSystem({
          id: sysId("sys-disabled-automatic"),
          status: TargetSystemStatus.Disabled,
          method: TargetSystemMethod.Automatic,
        }),
      ]);
      fixture.detectChanges();

      const rows = (component as unknown as { dataSource: { data: TargetSystemRow[] } }).dataSource
        .data;

      expect(
        rows.find((r) => r.id === sysId("sys-active-automatic"))?.canAddManagedCredential,
      ).toBe(true);
      expect(rows.find((r) => r.id === sysId("sys-active-manual"))?.canAddManagedCredential).toBe(
        true,
      );
      expect(
        rows.find((r) => r.id === sysId("sys-disabled-automatic"))?.canAddManagedCredential,
      ).toBe(false);
    });

    it("is absent from an empty list rather than defaulting to true", () => {
      targetSystemsService.systems$.next([]);
      fixture.detectChanges();

      const rows = (component as unknown as { dataSource: { data: TargetSystemRow[] } }).dataSource
        .data;

      expect(rows).toHaveLength(0);
    });
  });

  describe("openCreateManagedCredential", () => {
    it("navigates to the credential create page with this target preselected", async () => {
      const sys = makeSystem({ id: sysId("sys-add-cred") });
      const navigateSpy = jest.spyOn(router, "navigate").mockResolvedValue(true);

      await (
        component as unknown as {
          openCreateManagedCredential: (s: TargetSystem) => Promise<boolean>;
        }
      ).openCreateManagedCredential(sys);

      expect(navigateSpy).toHaveBeenCalledWith(
        ["..", "managed-credentials", "new"],
        expect.objectContaining({
          relativeTo: expect.anything(),
          queryParams: { targetSystemId: sysId("sys-add-cred") },
        }),
      );
    });
  });

  describe("openAssignConnectorDialog", () => {
    type AssignComp = { openAssignConnectorDialog: (s: TargetSystem) => Promise<void> };

    it("assigns the selected connector and shows a success toast", fakeAsync(() => {
      const sys = makeSystem({ id: sysId("sys-1") });
      const connector = accessConnector({
        id: connectorId("c-1"),
        status: AccessConnectorStatus.Enabled,
      });
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
        status: AccessConnectorStatus.Enabled,
        assignedTargetSystemIds: [sys.id],
      });
      const disabled = accessConnector({
        id: connectorId("c-disabled"),
        status: AccessConnectorStatus.Disabled,
      });
      const available = accessConnector({
        id: connectorId("c-available"),
        status: AccessConnectorStatus.Enabled,
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

    it("tells the dialog the org has no active connector at all", fakeAsync(() => {
      const sys = makeSystem({ id: sysId("sys-1") });
      daemonsService.daemons$.next([
        accessConnector({ id: connectorId("c-disabled"), status: AccessConnectorStatus.Disabled }),
      ]);
      dialogService.open.mockReturnValue({ closed: of(undefined) } as any);

      void (component as unknown as AssignComp).openAssignConnectorDialog(sys);
      flushMicrotasks();

      expect(dialogService.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({ options: [], noneEligible: true }),
        }),
      );
    }));

    it("tells the dialog the active connectors are all already on this target", fakeAsync(() => {
      const sys = makeSystem({ id: sysId("sys-1") });
      daemonsService.daemons$.next([
        accessConnector({
          id: connectorId("c-assigned"),
          status: AccessConnectorStatus.Enabled,
          assignedTargetSystemIds: [sys.id],
        }),
      ]);
      dialogService.open.mockReturnValue({ closed: of(undefined) } as any);

      void (component as unknown as AssignComp).openAssignConnectorDialog(sys);
      flushMicrotasks();

      // Empty options, but not empty for the same reason as above.
      expect(dialogService.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({ options: [], noneEligible: false }),
        }),
      );
    }));

    it("does not claim the org is empty when there is an option to offer", fakeAsync(() => {
      const sys = makeSystem({ id: sysId("sys-1") });
      daemonsService.daemons$.next([
        accessConnector({ id: connectorId("c-1"), status: AccessConnectorStatus.Enabled }),
      ]);
      dialogService.open.mockReturnValue({ closed: of(undefined) } as any);

      void (component as unknown as AssignComp).openAssignConnectorDialog(sys);
      flushMicrotasks();

      expect(dialogService.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ data: expect.objectContaining({ noneEligible: false }) }),
      );
    }));

    it("agrees with the row menu's own blocked reason", fakeAsync(() => {
      const sys = makeSystem({
        id: sysId("sys-1"),
        status: TargetSystemStatus.Active,
        method: TargetSystemMethod.Automatic,
      });
      targetSystemsService.systems$.next([sys]);
      daemonsService.daemons$.next([
        accessConnector({ id: connectorId("c-disabled"), status: AccessConnectorStatus.Disabled }),
      ]);
      dialogService.open.mockReturnValue({ closed: of(undefined) } as any);
      fixture.detectChanges();

      void (component as unknown as AssignComp).openAssignConnectorDialog(sys);
      flushMicrotasks();

      const blockedKey = (
        component as unknown as { dataSource: { data: TargetSystemRow[] } }
      ).dataSource.data.find((row) => row.id === sys.id)?.assignConnectorsBlockedKey;
      const passed = dialogService.open.mock.calls[0][1] as unknown as {
        data: { noneEligible: boolean };
      };

      expect(blockedKey).toBe("pamTargetSystemAssignConnectorNone");
      expect(passed.data.noneEligible).toBe(true);
    }));

    it("holds the dialog until the connector read lands, then offers what it read", async () => {
      const sys = makeSystem({ id: sysId("sys-1") });
      daemonsService.loading$.next(true);
      dialogService.open.mockReturnValue({ closed: of(undefined) } as any);

      const call = (component as unknown as AssignComp).openAssignConnectorDialog(sys);
      await Promise.resolve();

      // An empty list here is not evidence of anything, and the dialog would have read it as
      // every connector already being assigned.
      expect(dialogService.open).not.toHaveBeenCalled();

      const connector = accessConnector({
        id: connectorId("c-late"),
        status: AccessConnectorStatus.Enabled,
      });
      daemonsService.daemons$.next([connector]);
      daemonsService.loading$.next(false);
      await call;

      expect(dialogService.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({ options: [connector] }),
        }),
      );
    });

    it("states the failure instead of opening when the read lands as an error", async () => {
      const sys = makeSystem({ id: sysId("sys-1") });
      daemonsService.loading$.next(true);

      const call = (component as unknown as AssignComp).openAssignConnectorDialog(sys);
      await Promise.resolve();

      daemonsService.loadError$.next(new Error("boom"));
      daemonsService.loading$.next(false);
      await call;

      expect(dialogService.open).not.toHaveBeenCalled();
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "error",
          message: "pamTargetSystemConnectorAssignmentsLoadError",
        }),
      );
    });

    it("opens nothing when the tab is left while the connector read is in flight", async () => {
      const sys = makeSystem({ id: sysId("sys-1") });
      daemonsService.loading$.next(true);
      dialogService.open.mockReturnValue({ closed: of(undefined) } as any);

      const call = (component as unknown as AssignComp).openAssignConnectorDialog(sys);
      await Promise.resolve();

      fixture.destroy();
      daemonsService.daemons$.next([
        accessConnector({ id: connectorId("c-late"), status: AccessConnectorStatus.Enabled }),
      ]);
      daemonsService.loading$.next(false);
      await call;

      expect(dialogService.open).not.toHaveBeenCalled();
      expect(toastService.showToast).not.toHaveBeenCalled();
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
      targetSystemsService.systems$.next([]);
      targetSystemsService.loading$.next(true);

      jest.useFakeTimers({ doNotFake: ["nextTick", "queueMicrotask", "setImmediate"] });
      await createComponent({ renderTemplate: true });
    });

    afterEach(() => {
      jest.useRealTimers();
      targetSystemsService.loading$.next(false);
    });

    it("stands a skeleton table in for the list, carrying the real columns", () => {
      showSkeleton();
      const el = fixture.nativeElement as HTMLElement;
      const loading = el.querySelector('[data-testid="target-systems-loading"]');

      expect(el.querySelector("bit-spinner")).toBeNull();
      expect(loading).not.toBeNull();
      expect(loading!.querySelectorAll("bit-skeleton-text").length).toBeGreaterThan(0);
      expect(loading!.textContent).toContain("pamTargetSystemMethodColumn");
      expect(loading!.textContent).toContain("pamTargetSystemSessionTerminationColumn");
    });

    it("keeps the placeholder itself out of the accessibility tree", () => {
      const loading = (fixture.nativeElement as HTMLElement).querySelector(
        '[data-testid="target-systems-loading"]',
      );

      expect(loading!.getAttribute("aria-hidden")).toBe("true");
    });

    it("stands a placeholder in for the toolbar rather than offering row-derived filters", () => {
      showSkeleton();
      const el = fixture.nativeElement as HTMLElement;

      expect(el.querySelector("bit-search")).toBeNull();
      expect(el.querySelector("bit-filter-menu")).toBeNull();
      expect(
        el.querySelectorAll('[data-testid="target-systems-loading"] > div:first-child bit-skeleton')
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

    it("replaces the skeleton with the real rows, and announces the arrival", async () => {
      showSkeleton();
      targetSystemsService.systems$.next([makeSystem()]);
      targetSystemsService.loading$.next(false);
      advance(1000);
      await fixture.whenStable();
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('[data-testid="target-systems-loading"]')).toBeNull();
      expect(el.querySelector("bit-skeleton")).toBeNull();
      expect(el.querySelector("tbody tr td:first-child button")!.textContent).toContain(
        "Prod Entra",
      );
      expect(el.querySelector('[data-testid="rotation-loading-status"]')!.textContent).toContain(
        "pamTargetSystemsLoaded",
      );
    });

    it("renders the tab's own furniture, not a blank area, before the delay is up", () => {
      advance(999);

      const el = fixture.nativeElement as HTMLElement;
      const loading = el.querySelector('[data-testid="target-systems-loading"]');
      expect(loading).not.toBeNull();
      expect(el.querySelector("bit-skeleton")).toBeNull();
      expect(loading!.textContent).toContain("pamTargetSystemMethodColumn");
    });

    it("never draws the placeholder for a list that arrives inside the delay", async () => {
      advance(500);
      targetSystemsService.systems$.next([makeSystem()]);
      targetSystemsService.loading$.next(false);
      advance(1000);
      await fixture.whenStable();
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector("bit-skeleton")).toBeNull();
      expect(el.querySelector('[data-testid="target-systems-loading"]')).toBeNull();
      expect(el.querySelector("tbody tr td:first-child button")!.textContent).toContain(
        "Prod Entra",
      );
    });

    it("holds the placeholder its minimum time once it is up, so it cannot blink", async () => {
      showSkeleton();
      expect((fixture.nativeElement as HTMLElement).querySelector("bit-skeleton")).not.toBeNull();

      targetSystemsService.systems$.next([makeSystem()]);
      targetSystemsService.loading$.next(false);
      advance(300);

      expect((fixture.nativeElement as HTMLElement).querySelector("bit-skeleton")).not.toBeNull();

      advance(700);
      await fixture.whenStable();
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).querySelector("bit-skeleton")).toBeNull();
    });

    it("announces the load at once, not on the placeholder's clock", () => {
      const status = (fixture.nativeElement as HTMLElement).querySelector(
        '[data-testid="rotation-loading-status"]',
      );

      expect(status!.textContent).toContain("loading");
      expect((fixture.nativeElement as HTMLElement).querySelector("bit-skeleton")).toBeNull();
    });
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

  /** Renders the real template. */
  function setup(systems: TargetSystem[]) {
    TestBed.configureTestingModule({
      imports: [TargetSystemsTabComponent, ReactiveFormsModule, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        {
          provide: TargetSystemsService,
          useValue: {
            loading$: new BehaviorSubject<boolean>(false),
            loadError$: new BehaviorSubject<unknown | null>(null),
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
            loading$: new BehaviorSubject<boolean>(false),
            loadError$: new BehaviorSubject<unknown | null>(null),
            load: jest.fn().mockResolvedValue(undefined),
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
      { value: "pamTargetSystemMethodAutomatic", label: "pamTargetSystemMethodAutomatic" },
      { value: "pamTargetSystemMethodManual", label: "pamTargetSystemMethodManual" },
    ]);
  });

  it("derives the status options from the loaded rows, sorted by label", () => {
    setup([entraActive, mssqlDisabled, manualActive]);
    expect(component.statusOptions()).toEqual([
      { value: "pamTargetSystemStatusActive", label: "pamTargetSystemStatusActive" },
      { value: "pamTargetSystemStatusInactive", label: "pamTargetSystemStatusInactive" },
    ]);
  });

  it("leaves a manual target out of the kind options, since it has no kind", () => {
    setup([entraActive, mssqlDisabled, manualActive]);
    expect(component.kindOptions()).toEqual([
      { value: TargetSystemKind.Entra, label: "pamTargetSystemKindEntra" },
      { value: TargetSystemKind.Mssql, label: "pamTargetSystemKindMssql" },
    ]);
  });

  it("leaves a kind it cannot name out of the kind options", () => {
    setup([
      entraActive,
      makeSystem({
        id: sysId("4"),
        name: "Newer server thing",
        method: TargetSystemMethod.Automatic,
        kind: TargetSystemKind.Unknown,
        status: TargetSystemStatus.Active,
      }),
    ]);

    expect(component.kindOptions()).toEqual([
      { value: TargetSystemKind.Entra, label: "pamTargetSystemKindEntra" },
    ]);
  });

  it("leaves a method it cannot name out of the method options", () => {
    setup([
      entraActive,
      makeSystem({
        id: sysId("5"),
        name: "Newer server rotation",
        method: TargetSystemMethod.Unknown,
        kind: TargetSystemKind.Entra,
        status: TargetSystemStatus.Active,
      }),
    ]);

    expect(component.methodOptions()).toEqual([
      { value: "pamTargetSystemMethodAutomatic", label: "pamTargetSystemMethodAutomatic" },
    ]);
  });

  it("offers one Inactive status option for a status it cannot name and a disabled one", () => {
    setup([
      mssqlDisabled,
      makeSystem({
        id: sysId("6"),
        name: "Newer server status",
        method: TargetSystemMethod.Automatic,
        kind: TargetSystemKind.Entra,
        status: TargetSystemStatus.Unknown,
      }),
    ]);

    expect(component.statusOptions()).toEqual([
      { value: "pamTargetSystemStatusInactive", label: "pamTargetSystemStatusInactive" },
    ]);
  });

  it("does not render the kind chip when no loaded target carries a kind", () => {
    setup([manualActive]);
    expect(fixture.debugElement.query(By.css('bit-filter-menu[key="kind"]'))).toBeNull();
  });

  it("narrows rows to the selected method", () => {
    setup([entraActive, mssqlDisabled, manualActive]);
    chip("method").toggle("pamTargetSystemMethodManual");
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
    chip("status").toggle("pamTargetSystemStatusInactive");
    fixture.detectChanges();
    expect(visibleIds()).toEqual([sysId("2") as string]);
  });

  it("ANDs the chips with each other and with the search text", () => {
    setup([entraActive, mssqlDisabled, manualActive]);
    component.searchControl.setValue("prod");
    chip("status").toggle("pamTargetSystemStatusActive");
    fixture.detectChanges();
    expect(visibleIds()).toEqual([sysId("1") as string]);
  });

  it("shows the no-results row when the chips alone empty the table", () => {
    setup([entraActive]);
    chip("status").toggle("pamTargetSystemStatusInactive");
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("pamTargetSystemNoResults");
  });
});
