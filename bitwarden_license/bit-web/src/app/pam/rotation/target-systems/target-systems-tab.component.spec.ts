import { ComponentFixture, TestBed, fakeAsync, tick, flushMicrotasks } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { ActivatedRoute, Router, provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { DialogService, FilterMenuComponent, ToastService } from "@bitwarden/components";

import { AccessConnectorsService } from "../access-connectors/access-connectors.service";
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

function vfo1ConfigService(enabled: boolean): ReturnType<typeof mock<ConfigService>> {
  const configService = mock<ConfigService>();
  configService.getFeatureFlag$.mockReturnValue(of(enabled));
  return configService;
}

describe("TargetSystemsTabComponent", () => {
  let fixture: ComponentFixture<TargetSystemsTabComponent>;
  let component: TargetSystemsTabComponent;
  let targetSystemsService: {
    loading$: BehaviorSubject<boolean>;
    loadError$: BehaviorSubject<unknown | null>;
    systems$: BehaviorSubject<TargetSystem[]>;
    systemById$: BehaviorSubject<Map<string, TargetSystem>>;
    automaticSystems$: BehaviorSubject<TargetSystem[]>;
    load: jest.Mock;
    setEnabled: jest.Mock;
    delete: jest.Mock;
  };
  let accessConnectorsService: {
    accessConnectors$: BehaviorSubject<AccessConnector[]>;
    loading$: BehaviorSubject<boolean>;
    loadError$: BehaviorSubject<unknown | null>;
    load: jest.Mock;
    forgetTargetSystem: jest.Mock;
    assign: jest.Mock;
  };
  let router: Router;
  let dialogService: ReturnType<typeof mock<DialogService>>;
  let toastService: ReturnType<typeof mock<ToastService>>;
  let platformUtilsService: ReturnType<typeof mock<PlatformUtilsService>>;

  async function createComponent({ renderTemplate = false } = {}) {
    if (!renderTemplate) {
      TestBed.overrideComponent(TargetSystemsTabComponent, { set: { template: "", imports: [] } });
    }

    await TestBed.configureTestingModule({
      imports: [TargetSystemsTabComponent, ReactiveFormsModule, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: TargetSystemsService, useValue: targetSystemsService },
        { provide: AccessConnectorsService, useValue: accessConnectorsService },
        { provide: I18nService, useValue: i18nFake },
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: toastService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: ConfigService, useValue: vfo1ConfigService(false) },
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
      automaticSystems$: new BehaviorSubject<TargetSystem[]>([]),
      load: jest.fn().mockResolvedValue(undefined),
      setEnabled: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    accessConnectorsService = {
      accessConnectors$: new BehaviorSubject<AccessConnector[]>([]),
      loading$: new BehaviorSubject<boolean>(false),
      loadError$: new BehaviorSubject<unknown | null>(null),
      load: jest.fn().mockResolvedValue(undefined),
      forgetTargetSystem: jest.fn(),
      assign: jest.fn().mockResolvedValue(undefined),
    };
    dialogService = mock<DialogService>();
    dialogService.openSimpleDialog.mockResolvedValue(false);
    toastService = mock<ToastService>();
    platformUtilsService = mock<PlatformUtilsService>();

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
      const sys = makeSystem({
        id: sysId("sys-1"),
        name: "Prod Entra",
        status: TargetSystemStatus.Active,
      });
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

    it("does not offer deactivation as the alternative for a disabled target system", fakeAsync(() => {
      const sys = makeSystem({
        id: sysId("sys-1"),
        name: "Prod Entra",
        status: TargetSystemStatus.Disabled,
      });
      dialogService.openSimpleDialog.mockResolvedValue(true);

      void (component as unknown as DeleteComp).confirmDelete(sys);
      flushMicrotasks();

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "danger",
          content: {
            key: "pamTargetSystemDeleteContent",
            placeholders: ["Prod Entra"],
          },
        }),
      );
    }));

    it("does not offer deactivation as the alternative for a target system of unknown status", fakeAsync(() => {
      const sys = makeSystem({
        id: sysId("sys-1"),
        name: "Prod Entra",
        status: TargetSystemStatus.Unknown,
      });
      dialogService.openSimpleDialog.mockResolvedValue(true);

      void (component as unknown as DeleteComp).confirmDelete(sys);
      flushMicrotasks();

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          content: {
            key: "pamTargetSystemDeleteContent",
            placeholders: ["Prod Entra"],
          },
        }),
      );
    }));

    it("still names the connector assignments for an inactive target system", fakeAsync(() => {
      const sys = makeSystem({
        id: sysId("sys-1"),
        name: "Prod Entra",
        status: TargetSystemStatus.Disabled,
      });
      accessConnectorsService.accessConnectors$.next([
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

    it("names the connector assignments the delete takes with it", fakeAsync(() => {
      const sys = makeSystem({ id: sysId("sys-1"), name: "Prod Entra" });
      accessConnectorsService.accessConnectors$.next([
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

    it("keeps the deactivate-instead copy when the connector read cannot say either way", fakeAsync(() => {
      const sys = makeSystem({
        id: sysId("sys-1"),
        name: "Prod Entra",
        status: TargetSystemStatus.Active,
      });
      accessConnectorsService.loadError$.next(new Error("boom"));
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
      expect(accessConnectorsService.forgetTargetSystem).not.toHaveBeenCalled();
    }));

    it("prunes the deleted target from accessConnector assignments", fakeAsync(() => {
      const sys = makeSystem({ id: sysId("sys-1") });
      dialogService.openSimpleDialog.mockResolvedValue(true);

      void (component as unknown as DeleteComp).confirmDelete(sys);
      flushMicrotasks();

      expect(accessConnectorsService.forgetTargetSystem).toHaveBeenCalledWith(sysId("sys-1"));
    }));

    it("surfaces an error toast and leaves accessConnector assignments alone when the server refuses", fakeAsync(() => {
      const sys = makeSystem({ id: sysId("sys-1") });
      dialogService.openSimpleDialog.mockResolvedValue(true);
      targetSystemsService.delete.mockRejectedValue(new Error("target system in use"));

      void (component as unknown as DeleteComp).confirmDelete(sys);
      flushMicrotasks();

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
      expect(accessConnectorsService.forgetTargetSystem).not.toHaveBeenCalled();
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
      accessConnectorsService.accessConnectors$.next([connector]);
      accessConnectorsService.assign.mockReturnValue(pending.promise);
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
      accessConnectorsService.accessConnectors$.next([connector]);
      accessConnectorsService.assign.mockReturnValue(pending.promise);
      dialogService.open.mockReturnValue({ closed: of(connectorId("c-1")) } as any);
      const sys = makeSystem();
      const comp = guarded();

      const first = comp.openAssignConnectorDialog(sys);
      const second = comp.openAssignConnectorDialog(sys);
      pending.settle();
      await Promise.all([first, second]);

      expect(accessConnectorsService.assign).toHaveBeenCalledTimes(1);
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
    it("is true for any automatic-method target, active or not", () => {
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
        true,
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
      accessConnectorsService.accessConnectors$.next(connectors);
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
      accessConnectorsService.accessConnectors$.next([]);
      accessConnectorsService.loading$.next(false);
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
      accessConnectorsService.accessConnectors$.next([]);
      accessConnectorsService.loading$.next(false);
      accessConnectorsService.loadError$.next(new Error("boom"));
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
      accessConnectorsService.accessConnectors$.next([]);
      accessConnectorsService.loading$.next(true);
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

  describe("copy system id", () => {
    it("hands the clipboard the whole id, which is what a connector's config keys on", async () => {
      TestBed.resetTestingModule();
      const system = makeSystem({ id: sysId("sys-copy") });
      targetSystemsService.systems$.next([system]);
      await createComponent({ renderTemplate: true });

      (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLButtonElement>('td button[bitIconButton="bwi-ellipsis-h"]')!
        .click();
      fixture.detectChanges();

      document
        .querySelector<HTMLButtonElement>(
          '.bit-menu-panel [id^="target-systems-tab_button_copy-id"]',
        )!
        .click();

      expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith(uuidAsString(system.id));
    });

    it("offers the item for every target, whatever its method or status", () => {
      targetSystemsService.systems$.next([
        makeSystem({ id: sysId("sys-a"), method: TargetSystemMethod.Manual }),
        makeSystem({ id: sysId("sys-b"), status: TargetSystemStatus.Disabled }),
      ]);
      fixture.detectChanges();

      const rows = (component as unknown as { dataSource: { data: TargetSystemRow[] } }).dataSource
        .data;
      expect(rows.map((r) => r.idText)).toEqual([
        uuidAsString(sysId("sys-a")),
        uuidAsString(sysId("sys-b")),
      ]);
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
      accessConnectorsService.accessConnectors$.next([connector]);
      dialogService.open.mockReturnValue({ closed: of(connectorId("c-1")) } as any);

      void (component as unknown as AssignComp).openAssignConnectorDialog(sys);
      flushMicrotasks();

      expect(accessConnectorsService.assign).toHaveBeenCalledWith(connector, sys.id);
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    }));

    it("does not assign when the dialog is dismissed", fakeAsync(() => {
      const sys = makeSystem({ id: sysId("sys-1") });
      dialogService.open.mockReturnValue({ closed: of(undefined) } as any);

      void (component as unknown as AssignComp).openAssignConnectorDialog(sys);
      flushMicrotasks();

      expect(accessConnectorsService.assign).not.toHaveBeenCalled();
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
      accessConnectorsService.accessConnectors$.next([alreadyAssigned, disabled, available]);
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
      accessConnectorsService.accessConnectors$.next([
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
      accessConnectorsService.accessConnectors$.next([
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
      accessConnectorsService.accessConnectors$.next([
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
      accessConnectorsService.accessConnectors$.next([
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
      accessConnectorsService.loading$.next(true);
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
      accessConnectorsService.accessConnectors$.next([connector]);
      accessConnectorsService.loading$.next(false);
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
      accessConnectorsService.loading$.next(true);

      const call = (component as unknown as AssignComp).openAssignConnectorDialog(sys);
      await Promise.resolve();

      accessConnectorsService.loadError$.next(new Error("boom"));
      accessConnectorsService.loading$.next(false);
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
      accessConnectorsService.loading$.next(true);
      dialogService.open.mockReturnValue({ closed: of(undefined) } as any);

      const call = (component as unknown as AssignComp).openAssignConnectorDialog(sys);
      await Promise.resolve();

      fixture.destroy();
      accessConnectorsService.accessConnectors$.next([
        accessConnector({ id: connectorId("c-late"), status: AccessConnectorStatus.Enabled }),
      ]);
      accessConnectorsService.loading$.next(false);
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
  const scriptDisabled = makeSystem({
    id: sysId("2"),
    name: "Prod SQL reporting",
    method: TargetSystemMethod.Automatic,
    kind: TargetSystemKind.CustomScript,
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
            automaticSystems$: new BehaviorSubject<TargetSystem[]>([]),
            load: jest.fn().mockResolvedValue(undefined),
            setEnabled: jest.fn().mockResolvedValue(undefined),
            delete: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AccessConnectorsService,
          useValue: {
            accessConnectors$: new BehaviorSubject<AccessConnector[]>([]),
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
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: ConfigService, useValue: vfo1ConfigService(false) },
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
    setup([entraActive, scriptDisabled, manualActive]);
    expect(component.methodOptions()).toEqual([
      { value: "pamTargetSystemMethodAutomatic", label: "pamTargetSystemMethodAutomatic" },
      { value: "pamTargetSystemMethodManual", label: "pamTargetSystemMethodManual" },
    ]);
  });

  it("derives the status options from the loaded rows, sorted by label", () => {
    setup([entraActive, scriptDisabled, manualActive]);
    expect(component.statusOptions()).toEqual([
      { value: "pamTargetSystemStatusActive", label: "pamTargetSystemStatusActive" },
      { value: "pamTargetSystemStatusInactive", label: "pamTargetSystemStatusInactive" },
    ]);
  });

  it("leaves a manual target out of the kind options, since it has no kind", () => {
    setup([entraActive, scriptDisabled, manualActive]);
    expect(component.kindOptions()).toEqual([
      { value: TargetSystemKind.CustomScript, label: "pamTargetSystemTypeCustomScript" },
      { value: TargetSystemKind.Entra, label: "pamTargetSystemTypeEntra" },
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
      { value: TargetSystemKind.Entra, label: "pamTargetSystemTypeEntra" },
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
      scriptDisabled,
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
    setup([entraActive, scriptDisabled, manualActive]);
    chip("method").toggle("pamTargetSystemMethodManual");
    fixture.detectChanges();
    expect(visibleIds()).toEqual([sysId("3") as string]);
  });

  it("narrows rows to the selected kind", () => {
    setup([entraActive, scriptDisabled, manualActive]);
    chip("kind").toggle(TargetSystemKind.CustomScript);
    fixture.detectChanges();
    expect(visibleIds()).toEqual([sysId("2") as string]);
  });

  it("narrows rows to the selected status", () => {
    setup([entraActive, scriptDisabled, manualActive]);
    chip("status").toggle("pamTargetSystemStatusInactive");
    fixture.detectChanges();
    expect(visibleIds()).toEqual([sysId("2") as string]);
  });

  it("ANDs the chips with each other and with the search text", () => {
    setup([entraActive, scriptDisabled, manualActive]);
    component.searchControl.setValue("prod");
    chip("status").toggle("pamTargetSystemStatusActive");
    fixture.detectChanges();
    expect(visibleIds()).toEqual([sysId("1") as string]);
  });

  it("shows the no-results row when the chips alone empty the table", () => {
    setup([entraActive]);
    chip("status").toggle("pamTargetSystemStatusInactive");
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("pamTargetSystemNoFilterResults");
  });
});

describe("TargetSystemsTabComponent with the VFO1 flag", () => {
  let fixture: ComponentFixture<TargetSystemsTabComponent>;
  let loading$: BehaviorSubject<boolean>;
  let dialogService: ReturnType<typeof mock<DialogService>>;
  let router: Router;

  const entraActive = makeSystem({
    id: sysId("1"),
    name: "Prod Entra",
    method: TargetSystemMethod.Automatic,
    kind: TargetSystemKind.Entra,
    status: TargetSystemStatus.Active,
  });
  const scriptDisabled = makeSystem({
    id: sysId("2"),
    name: "Billing script",
    method: TargetSystemMethod.Automatic,
    kind: TargetSystemKind.CustomScript,
    status: TargetSystemStatus.Disabled,
    supportsSessionTermination: false,
  });
  const manualActive = makeSystem({
    id: sysId("3"),
    name: "Mainframe payroll",
    method: TargetSystemMethod.Manual,
    kind: undefined,
    status: TargetSystemStatus.Active,
  });
  const SYSTEMS = [entraActive, scriptDisabled, manualActive];

  async function render(vfo1: boolean, systems: TargetSystem[] = SYSTEMS): Promise<HTMLElement> {
    TestBed.resetTestingModule();
    loading$ = new BehaviorSubject<boolean>(false);
    dialogService = mock<DialogService>();
    dialogService.openSimpleDialog.mockResolvedValue(false);

    await TestBed.configureTestingModule({
      imports: [TargetSystemsTabComponent, ReactiveFormsModule, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        {
          provide: TargetSystemsService,
          useValue: {
            loading$,
            loadError$: new BehaviorSubject<unknown | null>(null),
            systems$: new BehaviorSubject<TargetSystem[]>(systems),
            systemById$: new BehaviorSubject(new Map()),
            automaticSystems$: new BehaviorSubject<TargetSystem[]>([]),
            load: jest.fn().mockResolvedValue(undefined),
            setEnabled: jest.fn().mockResolvedValue(undefined),
            delete: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AccessConnectorsService,
          useValue: {
            accessConnectors$: new BehaviorSubject<AccessConnector[]>([
              accessConnector({ id: connectorId("c-1"), status: AccessConnectorStatus.Enabled }),
            ]),
            loading$: new BehaviorSubject<boolean>(false),
            loadError$: new BehaviorSubject<unknown | null>(null),
            load: jest.fn().mockResolvedValue(undefined),
            forgetTargetSystem: jest.fn(),
            assign: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: I18nService, useValue: i18nFake },
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: ConfigService, useValue: vfo1ConfigService(vfo1) },
        {
          provide: ActivatedRoute,
          useValue: { params: of({ organizationId: ORGANIZATION_ID }) },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(TargetSystemsTabComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function text(el: Element): string {
    return (el.textContent ?? "").replace(/\s+/g, " ").trim();
  }

  function headings(el: HTMLElement): string[] {
    const cells = el.querySelector("bit-table-v2")
      ? el.querySelectorAll('bit-table-v2 [role="columnheader"]')
      : el.querySelectorAll("bit-table thead th");
    return Array.from(cells).map(text);
  }

  function rowNames(el: HTMLElement): string[] {
    const rows = el.querySelector("bit-table-v2")
      ? el.querySelectorAll("bit-table-v2 bit-row")
      : el.querySelectorAll("bit-table tbody tr");
    return Array.from(rows).map((row) => text(row.querySelector("button[bitLink]")!));
  }

  function menuItems(el: HTMLElement, rowIndex: number): string[] {
    el.querySelectorAll<HTMLButtonElement>('button[bitIconButton="bwi-ellipsis-h"]')[
      rowIndex
    ].click();
    fixture.detectChanges();
    const panels = document.querySelectorAll(".bit-menu-panel");
    return Array.from(panels[panels.length - 1].querySelectorAll("[bitMenuItem]")).map(text);
  }

  function chip(key: string): FilterMenuComponent {
    return fixture.debugElement.query(By.css(`bit-filter-menu[key="${key}"]`)).componentInstance;
  }

  it("renders only the v1 table with the flag off", async () => {
    const el = await render(false);

    expect(el.querySelector("bit-table")).not.toBeNull();
    expect(el.querySelector("bit-table-v2")).toBeNull();
  });

  it("renders only the v2 table with the flag on", async () => {
    const el = await render(true);

    expect(el.querySelector("bit-table-v2")).not.toBeNull();
    expect(el.querySelector("bit-table")).toBeNull();
  });

  it("renders the same column headings, in the same order, as the v1 table", async () => {
    const v1 = headings(await render(false));
    const v2 = headings(await render(true));

    expect(v2).toEqual([
      "name",
      "pamTargetSystemMethodColumn",
      "pamTargetSystemTypeColumn",
      "status",
      "pamTargetSystemSessionTerminationColumn",
      "",
    ]);
    expect(v2).toEqual(v1);
  });

  it("renders the same rows, in the same order, as the v1 table", async () => {
    const v1 = rowNames(await render(false));
    const v2 = rowNames(await render(true));

    expect(v2).toHaveLength(SYSTEMS.length);
    expect(v2).toEqual(v1);
  });

  it("renders the same cell text in every row as the v1 table", async () => {
    const v1El = await render(false);
    const v1 = Array.from(v1El.querySelectorAll("bit-table tbody tr")).map((row) =>
      Array.from(row.querySelectorAll("td")).map(text),
    );
    const v2El = await render(true);
    const v2 = Array.from(v2El.querySelectorAll("bit-table-v2 bit-row")).map((row) =>
      Array.from(row.querySelectorAll('[role="cell"]')).map(text),
    );

    expect(v2).toEqual(v1);
  });

  it("offers the same row actions, in the same order and gating, as the v1 table", async () => {
    const v1El = await render(false);
    const v1 = SYSTEMS.map((_, i) => menuItems(v1El, i));
    const v2El = await render(true);
    const v2 = SYSTEMS.map((_, i) => menuItems(v2El, i));

    expect(v2[0]).toEqual([
      "pamTargetSystemEditTarget",
      "pamTargetSystemCopyId",
      "pamRotationConfigCreateTitle",
      "pamTargetSystemAssignConnectors",
      "pamTargetSystemDeactivate",
      "pamTargetSystemDeleteTarget",
    ]);
    expect(v2[1]).not.toContain("pamRotationConfigCreateTitle");
    expect(v2[1]).toContain("pamTargetSystemActivate");
    expect(v2[2]).not.toContain("pamTargetSystemAssignConnectors");
    expect(v2).toEqual(v1);
  });

  it("routes a row action through the shared component method", async () => {
    const el = await render(true);
    const navigateSpy = jest.spyOn(router, "navigate").mockResolvedValue(true);

    el.querySelector<HTMLButtonElement>("bit-table-v2 bit-row button[bitLink]")!.click();

    expect(navigateSpy).toHaveBeenCalledWith(
      ["..", "target-systems", entraActive.id],
      expect.objectContaining({ relativeTo: expect.anything() }),
    );
  });

  it("confirms a delete from the v2 row menu", async () => {
    const el = await render(true);
    el.querySelector<HTMLButtonElement>('button[bitIconButton="bwi-ellipsis-h"]')!.click();
    fixture.detectChanges();

    const items = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".bit-menu-panel [bitMenuItem]"),
    );
    items.find((item) => text(item) === "pamTargetSystemDeleteTarget")!.click();
    await fixture.whenStable();

    expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
      expect.objectContaining({ title: { key: "pamTargetSystemDeleteTitle" }, type: "danger" }),
    );
  });

  it("names the row menu trigger and keeps the name link a focusable button", async () => {
    const el = await render(true);
    const trigger = el.querySelector<HTMLButtonElement>(
      'bit-table-v2 button[bitIconButton="bwi-ellipsis-h"]',
    )!;
    const link = el.querySelector<HTMLButtonElement>("bit-table-v2 bit-row button[bitLink]")!;

    expect(trigger.getAttribute("aria-label")).toBe("options");
    expect(link.tagName).toBe("BUTTON");
    expect(link.getAttribute("tabindex")).not.toBe("-1");
  });

  it("sorts on the name column only, and starts unsorted", async () => {
    const el = await render(true);
    const sortButtons = el.querySelectorAll('bit-table-v2 [role="columnheader"] button');

    expect(sortButtons).toHaveLength(1);
    expect(text(sortButtons[0])).toBe("name");
    expect(rowNames(el)).toEqual(["Prod Entra", "Billing script", "Mainframe payroll"]);

    (sortButtons[0] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(rowNames(el)).toEqual(["Billing script", "Mainframe payroll", "Prod Entra"]);
    expect(sortButtons[0].parentElement!.getAttribute("aria-sort")).toBe("ascending");

    (sortButtons[0] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(rowNames(el)).toEqual(["Prod Entra", "Mainframe payroll", "Billing script"]);
    expect(sortButtons[0].parentElement!.getAttribute("aria-sort")).toBe("descending");
  });

  it("narrows the v2 rows with the search text and the chips", async () => {
    const el = await render(true);
    const comp = fixture.componentInstance as unknown as {
      searchControl: { setValue: (value: string) => void };
    };

    comp.searchControl.setValue("prod");
    fixture.detectChanges();
    expect(rowNames(el)).toEqual(["Prod Entra"]);

    comp.searchControl.setValue("");
    chip("method").toggle("pamTargetSystemMethodManual");
    fixture.detectChanges();
    expect(rowNames(el)).toEqual(["Mainframe payroll"]);
  });

  it("shows the no-results message when the chips empty the v2 table", async () => {
    const el = await render(true, [entraActive]);

    chip("status").toggle("pamTargetSystemStatusInactive");
    fixture.detectChanges();

    expect(el.querySelectorAll("bit-table-v2 bit-row")).toHaveLength(0);
    expect(text(el.querySelector('bit-table-v2 [slot="empty"]')!)).toBe(
      "pamTargetSystemNoFilterResults",
    );
  });

  it("shows the empty state, not the v2 table, when there are no target systems", async () => {
    const el = await render(true, []);

    expect(el.querySelector("bit-table-v2")).toBeNull();
    expect(el.querySelector("pam-target-systems-empty-state")).not.toBeNull();
  });

  describe("loading skeleton", () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    /**
     * Raises the loading flag on a fake clock. The clock goes in only after `render` has settled:
     * the toolbar's chip measurement schedules a change detection pass on a timer, which
     * `whenStable` waits for and a fake clock would never run.
     */
    function startLoading(): void {
      jest.useFakeTimers({ doNotFake: ["nextTick", "queueMicrotask", "setImmediate"] });
      loading$.next(true);
      fixture.detectChanges();
    }

    async function renderLoading(): Promise<HTMLElement> {
      const el = await render(true, []);
      startLoading();
      return el;
    }

    it("stands a v2 skeleton table in for the list, carrying the real columns", async () => {
      const el = await renderLoading();
      jest.advanceTimersByTime(1000);
      fixture.detectChanges();
      const loading = el.querySelector('[data-testid="target-systems-loading"]')!;

      expect(loading.getAttribute("aria-hidden")).toBe("true");
      expect(loading.querySelector("bit-table-v2")).not.toBeNull();
      expect(loading.querySelector("bit-table")).toBeNull();
      expect(headings(el)).toEqual([
        "name",
        "pamTargetSystemMethodColumn",
        "pamTargetSystemTypeColumn",
        "status",
        "pamTargetSystemSessionTerminationColumn",
        "",
      ]);
      expect(loading.querySelectorAll("bit-row")).toHaveLength(5);
      expect(loading.querySelectorAll("bit-skeleton-text").length).toBeGreaterThan(0);
    });

    it("draws the headings but no skeleton rows before the delay is up", async () => {
      const el = await renderLoading();
      jest.advanceTimersByTime(999);
      fixture.detectChanges();
      const loading = el.querySelector('[data-testid="target-systems-loading"]')!;

      expect(loading.textContent).toContain("pamTargetSystemMethodColumn");
      expect(loading.querySelectorAll("bit-row")).toHaveLength(0);
      expect(el.querySelector("bit-skeleton")).toBeNull();
    });

    it("lays the skeleton out on the same column tracks as the loaded table", async () => {
      const el = await render(true);
      startLoading();
      jest.advanceTimersByTime(1000);
      fixture.detectChanges();
      const skeletonTracks = el.querySelector<HTMLElement>(
        '[data-testid="target-systems-loading"] bit-header-row',
      )!.style.gridTemplateColumns;
      const skeletonRowTracks = el.querySelector<HTMLElement>(
        '[data-testid="target-systems-loading"] bit-row',
      )!.style.gridTemplateColumns;

      loading$.next(false);
      fixture.detectChanges();
      jest.advanceTimersByTime(1000);
      fixture.detectChanges();
      const loadedTracks = el.querySelector<HTMLElement>("bit-table-v2 bit-header-row")!.style
        .gridTemplateColumns;

      expect(el.querySelector('[data-testid="target-systems-loading"]')).toBeNull();
      expect(loadedTracks).toBe("minmax(12rem, 2fr) 1fr 1fr 1fr 1fr 80px");
      expect(skeletonTracks).toBe(loadedTracks);
      expect(skeletonRowTracks).toBe(loadedTracks);
    });
  });
});

describe("TargetSystemsTabComponent — VFO1 toolbar (flag on)", () => {
  let fixture: ComponentFixture<TargetSystemsTabComponent>;
  let systems$: BehaviorSubject<TargetSystem[]>;

  const entraActive = makeSystem({
    id: sysId("1"),
    name: "Prod Entra",
    method: TargetSystemMethod.Automatic,
    kind: TargetSystemKind.Entra,
    status: TargetSystemStatus.Active,
  });
  const scriptDisabled = makeSystem({
    id: sysId("2"),
    name: "Billing script",
    method: TargetSystemMethod.Automatic,
    kind: TargetSystemKind.CustomScript,
    status: TargetSystemStatus.Disabled,
  });
  const manualActive = makeSystem({
    id: sysId("3"),
    name: "Mainframe payroll",
    method: TargetSystemMethod.Manual,
    kind: undefined,
    status: TargetSystemStatus.Active,
  });
  const SYSTEMS = [entraActive, scriptDisabled, manualActive];

  async function render(
    vfo1: boolean,
    systems: TargetSystem[] = SYSTEMS,
  ): Promise<ComponentFixture<TargetSystemsTabComponent>> {
    TestBed.resetTestingModule();
    systems$ = new BehaviorSubject<TargetSystem[]>(systems);
    await TestBed.configureTestingModule({
      imports: [TargetSystemsTabComponent, ReactiveFormsModule, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        {
          provide: TargetSystemsService,
          useValue: {
            loading$: new BehaviorSubject<boolean>(false),
            loadError$: new BehaviorSubject<unknown | null>(null),
            systems$,
            systemById$: new BehaviorSubject(new Map()),
            automaticSystems$: new BehaviorSubject<TargetSystem[]>([]),
            load: jest.fn().mockResolvedValue(undefined),
            setEnabled: jest.fn().mockResolvedValue(undefined),
            delete: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AccessConnectorsService,
          useValue: {
            accessConnectors$: new BehaviorSubject<AccessConnector[]>([]),
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
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: ConfigService, useValue: vfo1ConfigService(vfo1) },
        {
          provide: ActivatedRoute,
          useValue: { params: of({ organizationId: ORGANIZATION_ID }) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TargetSystemsTabComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const el = (f: ComponentFixture<TargetSystemsTabComponent>): HTMLElement =>
    f.nativeElement as HTMLElement;

  const toolbar = (f: ComponentFixture<TargetSystemsTabComponent>): HTMLElement =>
    el(f).querySelector("bit-table-v2 bit-table-toolbar")!;

  const endSlot = (f: ComponentFixture<TargetSystemsTabComponent>): Element =>
    toolbar(f).querySelector("bit-search")!.parentElement!.parentElement!.lastElementChild!;

  const text = (node: Element): string => (node.textContent ?? "").replace(/\s+/g, " ").trim();

  const rowNames = (f: ComponentFixture<TargetSystemsTabComponent>): string[] =>
    Array.from(el(f).querySelectorAll("bit-table-v2 bit-row")).map((row) =>
      text(row.querySelector("button[bitLink]")!),
    );

  const v1Names = (f: ComponentFixture<TargetSystemsTabComponent>): string[] =>
    (
      (f.componentInstance as unknown as { dataSource: { filteredData?: TargetSystemRow[] } })
        .dataSource.filteredData ?? []
    ).map((row) => row.name);

  const chip = (f: ComponentFixture<TargetSystemsTabComponent>, key: string): FilterMenuComponent =>
    f.debugElement.query(By.css(`bit-filter-menu[key="${key}"]`)).componentInstance;

  function setFilters(
    f: ComponentFixture<TargetSystemsTabComponent>,
    filters: { search?: string; method?: string; kind?: string; status?: string },
  ): void {
    if (filters.search !== undefined) {
      (
        f.componentInstance as unknown as { searchControl: { setValue: (v: string) => void } }
      ).searchControl.setValue(filters.search);
    }
    for (const key of ["method", "kind", "status"] as const) {
      const value = filters[key];
      if (value !== undefined) {
        chip(f, key).toggle(value);
      }
    }
    f.detectChanges();
  }

  it("puts the search and every filter chip inside the table's toolbar", async () => {
    const on = await render(true);

    expect(toolbar(on).querySelector("bit-search")).not.toBeNull();
    expect(
      Array.from(toolbar(on).querySelectorAll("bit-filter-menu")).map((c) => c.getAttribute("key")),
    ).toEqual(["method", "kind", "status"]);
    expect(el(on).querySelectorAll("bit-search")).toHaveLength(1);
    expect(el(on).querySelectorAll("bit-filter-menu")).toHaveLength(3);
  });

  it("leaves the controls outside the table when the flag is off", async () => {
    const off = await render(false);

    expect(el(off).querySelector("bit-table-toolbar")).toBeNull();
    expect(el(off).querySelector("bit-table")!.querySelector("bit-search")).toBeNull();
    expect(el(off).querySelectorAll("bit-search")).toHaveLength(1);
    expect(el(off).querySelectorAll("bit-filter-menu")).toHaveLength(3);
  });

  it("keeps each chip's label and unset state", async () => {
    const off = await render(false);
    const offLabels = Array.from(el(off).querySelectorAll("bit-filter-menu")).map(text);

    const on = await render(true);
    const chips = Array.from(toolbar(on).querySelectorAll("bit-filter-menu"));

    expect(chips.map(text)).toEqual(offLabels);
    expect(rowNames(on)).toEqual(["Prod Entra", "Billing script", "Mainframe payroll"]);
  });

  it("keeps the search placeholder and accessible name it had off the flag", async () => {
    const off = await render(false);
    const offInput = el(off).querySelector("bit-search input")!;

    const on = await render(true);
    const onInput = toolbar(on).querySelector("bit-search input")!;

    expect(onInput.getAttribute("placeholder")).toBe("pamTargetSystemSearch");
    expect(onInput.getAttribute("placeholder")).toBe(offInput.getAttribute("placeholder"));
    expect(onInput.getAttribute("type")).toBe(offInput.getAttribute("type"));
    expect(onInput.hasAttribute("disabled")).toBe(false);
  });

  it("drops the kind chip from the toolbar when no loaded target carries a kind", async () => {
    const on = await render(true, [manualActive]);

    expect(toolbar(on).querySelector('bit-filter-menu[key="kind"]')).toBeNull();
    expect(toolbar(on).querySelectorAll("bit-filter-menu")).toHaveLength(2);
  });

  it.each<[string, { search?: string; method?: string; kind?: string; status?: string }]>([
    ["the method chip", { method: "pamTargetSystemMethodManual" }],
    ["the kind chip", { kind: TargetSystemKind.CustomScript }],
    ["the status chip", { status: "pamTargetSystemStatusInactive" }],
    ["search on a target name", { search: "prod" }],
    ["search on a kind label", { search: "customscript" }],
    ["every control at once", { search: "script", status: "pamTargetSystemStatusInactive" }],
  ])("narrows the toolbar's rows the same way the flag-off path does: %s", async (_, filters) => {
    const off = await render(false);
    setFilters(off, filters);
    const expected = v1Names(off);
    // Guards the comparison: two empty lists would agree without either path filtering.
    expect(expected.length).toBeGreaterThan(0);
    expect(expected.length).toBeLessThan(SYSTEMS.length);

    const on = await render(true);
    setFilters(on, filters);

    expect(rowNames(on)).toEqual(expected);
  });

  it("applies the search once, not once per host, when the term matches a subset", async () => {
    const on = await render(true);

    setFilters(on, { search: "prod" });
    expect(rowNames(on)).toEqual(["Prod Entra"]);

    setFilters(on, { search: "" });
    expect(rowNames(on)).toEqual(["Prod Entra", "Billing script", "Mainframe payroll"]);
  });

  it("restores every row when a chip is cleared from the toolbar", async () => {
    const on = await render(true);

    setFilters(on, { status: "pamTargetSystemStatusInactive" });
    expect(rowNames(on)).toEqual(["Billing script"]);

    chip(on, "status").clear();
    on.detectChanges();
    expect(rowNames(on)).toEqual(["Prod Entra", "Billing script", "Mainframe payroll"]);
  });

  it("keeps the toolbar rendered when the filters exclude every row", async () => {
    const on = await render(true);

    setFilters(on, { search: "nothing matches" });

    expect(rowNames(on)).toEqual([]);
    expect(text(el(on).querySelector('bit-table-v2 [slot="empty"]')!)).toBe(
      "pamTargetSystemNoFilterResults",
    );
    expect(toolbar(on).querySelector("bit-search")).not.toBeNull();
    expect(toolbar(on).querySelectorAll("bit-filter-menu")).toHaveLength(3);
  });

  it("puts the create action in the end slot, not in the rotation shell header", async () => {
    const on = await render(true);

    expect(endSlot(on).children).toHaveLength(1);
    const button = endSlot(on).querySelector<HTMLButtonElement>(
      "#rotation-shell_button_new-target-system",
    );
    expect(button).not.toBeNull();
    expect(text(button!)).toBe("pamTargetSystemNew");
    expect(button!.getAttribute("type")).toBe("button");
  });

  it("leaves the create action to the rotation shell header with the flag off", async () => {
    const off = await render(false);

    expect(el(off).querySelector("bit-table-toolbar")).toBeNull();
    expect(el(off).querySelector("#rotation-shell_button_new-target-system")).toBeNull();
  });

  it("navigates to the create page from the end slot button", async () => {
    const on = await render(true);
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, "navigate").mockResolvedValue(true);

    endSlot(on)
      .querySelector<HTMLButtonElement>("#rotation-shell_button_new-target-system")!
      .click();
    await on.whenStable();

    expect(navigateSpy).toHaveBeenCalledWith(
      ["..", "target-systems", "new"],
      expect.objectContaining({ relativeTo: expect.anything() }),
    );
  });

  it("keeps the create action out of the toolbar when a search holds the table over an empty list", async () => {
    const on = await render(true);

    setFilters(on, { search: "prod" });
    systems$.next([]);
    on.detectChanges();

    expect(el(on).querySelector("bit-table-v2")).not.toBeNull();
    expect(toolbar(on)).not.toBeNull();
    expect(endSlot(on).children).toHaveLength(0);
    expect(el(on).querySelector("#rotation-shell_button_new-target-system")).toBeNull();
  });

  it("leaves the create action to the empty state when there are no target systems", async () => {
    const on = await render(true, []);

    expect(el(on).querySelector("bit-table-toolbar")).toBeNull();
    expect(el(on).querySelector("#rotation-shell_button_new-target-system")).toBeNull();
    expect(el(on).querySelector("pam-target-systems-empty-state")).not.toBeNull();
  });

  it("keeps every toolbar control keyboard reachable", async () => {
    const on = await render(true);
    const controls = [
      toolbar(on).querySelector("bit-search input")!,
      ...Array.from(toolbar(on).querySelectorAll("bit-filter-menu button")),
    ];

    expect(controls).toHaveLength(4);
    for (const control of controls) {
      expect(control.getAttribute("tabindex")).not.toBe("-1");
      expect(control.hasAttribute("disabled")).toBe(false);
    }
  });
});
