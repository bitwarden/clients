import { ComponentFixture, TestBed, fakeAsync, tick, flushMicrotasks } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { ActivatedRoute, Router, provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { DaemonsService } from "../daemons/daemons.service";
import type { TargetSystem, TargetSystemId } from "../rotation";
import { TargetSystemKind, TargetSystemMethod, TargetSystemStatus } from "../rotation";
import { deferred } from "../testing/deferred";
import { ORGANIZATION_ID, sysId } from "../testing/rotation-builders";

import { TargetSystemsTabComponent } from "./target-systems-tab.component";
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
    loadError$: BehaviorSubject<unknown | null>;
    systems$: BehaviorSubject<TargetSystem[]>;
    systemById$: BehaviorSubject<Map<string, TargetSystem>>;
    activeAutomaticSystems$: BehaviorSubject<TargetSystem[]>;
    load: jest.Mock;
    setEnabled: jest.Mock;
    delete: jest.Mock;
  };
  let daemonsService: { forgetTargetSystem: jest.Mock };
  let router: Router;
  let dialogService: ReturnType<typeof mock<DialogService>>;
  let toastService: ReturnType<typeof mock<ToastService>>;

  async function createComponent({ renderTemplate = false } = {}) {
    if (!renderTemplate) {
      // Override the template AND imports to avoid pulling in HeaderModule → SharedModule → DialogModule
      // which would provide a real DialogService, overriding our test mock.
      // Must come before configureTestingModule.
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
    daemonsService = { forgetTargetSystem: jest.fn() };
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

  describe("in-flight row guard", () => {
    type Guarded = {
      disable: (s: TargetSystem) => Promise<void>;
      enable: (s: TargetSystem) => Promise<void>;
      confirmDelete: (s: TargetSystem) => Promise<void>;
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
  });
});
