import { ComponentFixture, TestBed, fakeAsync, tick, flushMicrotasks } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { ActivatedRoute, Router, provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import {
  TargetSystemResponse,
  TargetSystemKind,
  TargetSystemMethod,
  TargetSystemStatus,
} from "@bitwarden/bit-pam";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { TargetSystemsTabComponent } from "./target-systems-tab.component";
import { TargetSystemsService } from "./target-systems.service";

/** Echoes the key as its translation so form-field components don't crash. */
const i18nFake: Pick<I18nService, "t" | "translate"> = {
  t: (id: string) => id,
  translate: (id: string) => id,
};

function makeSystem(overrides: Partial<TargetSystemResponse> = {}): TargetSystemResponse {
  return {
    id: "sys-1",
    name: "Prod Entra",
    method: TargetSystemMethod.Automatic,
    kind: TargetSystemKind.Entra,
    status: TargetSystemStatus.Active,
    passwordPolicy: null,
    supportsSessionTermination: true,
    ...overrides,
  } as TargetSystemResponse;
}

describe("TargetSystemsTabComponent", () => {
  let fixture: ComponentFixture<TargetSystemsTabComponent>;
  let component: TargetSystemsTabComponent;
  let targetSystemsService: {
    loading$: BehaviorSubject<boolean>;
    systems$: BehaviorSubject<TargetSystemResponse[]>;
    systemById$: BehaviorSubject<Map<string, TargetSystemResponse>>;
    activeAutomaticSystems$: BehaviorSubject<TargetSystemResponse[]>;
    load: jest.Mock;
    setEnabled: jest.Mock;
  };
  let router: Router;
  let dialogService: ReturnType<typeof mock<DialogService>>;
  let toastService: ReturnType<typeof mock<ToastService>>;

  beforeEach(async () => {
    targetSystemsService = {
      loading$: new BehaviorSubject<boolean>(false),
      systems$: new BehaviorSubject<TargetSystemResponse[]>([]),
      systemById$: new BehaviorSubject(new Map()),
      activeAutomaticSystems$: new BehaviorSubject<TargetSystemResponse[]>([]),
      load: jest.fn().mockResolvedValue(undefined),
      setEnabled: jest.fn().mockResolvedValue(undefined),
    };
    dialogService = mock<DialogService>();
    dialogService.openSimpleDialog.mockResolvedValue(false);
    toastService = mock<ToastService>();

    // Override the template AND imports to avoid pulling in HeaderModule → SharedModule → DialogModule
    // which would provide a real DialogService, overriding our test mock.
    // Must come before configureTestingModule.
    TestBed.overrideComponent(TargetSystemsTabComponent, { set: { template: "", imports: [] } });

    await TestBed.configureTestingModule({
      imports: [TargetSystemsTabComponent, ReactiveFormsModule, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: TargetSystemsService, useValue: targetSystemsService },
        { provide: I18nService, useValue: i18nFake },
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: toastService },
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({ organizationId: "org-123" }),
            snapshot: { params: { organizationId: "org-123" } },
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
  });

  it("calls load with the organization id on init", () => {
    expect(targetSystemsService.load).toHaveBeenCalledWith("org-123");
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
    const sys = makeSystem({ id: "sys-edit" });
    const navigateSpy = jest.spyOn(router, "navigate").mockResolvedValue(true);
    await (
      component as unknown as { openEdit: (s: TargetSystemResponse) => Promise<boolean> }
    ).openEdit(sys);
    expect(navigateSpy).toHaveBeenCalledWith(
      ["..", "target-systems", "sys-edit"],
      expect.objectContaining({ relativeTo: expect.anything() }),
    );
  });

  describe("disable action", () => {
    it("calls setEnabled(false) after confirmation", fakeAsync(() => {
      const sys = makeSystem({ id: "sys-1", status: TargetSystemStatus.Active });
      dialogService.openSimpleDialog.mockResolvedValue(true);

      const comp = component as unknown as {
        disable: (s: TargetSystemResponse) => Promise<void>;
      };
      void comp.disable(sys);
      tick();

      expect(targetSystemsService.setEnabled).toHaveBeenCalledWith(sys, false);
    }));

    it("does not call setEnabled when confirmation is cancelled", fakeAsync(() => {
      const sys = makeSystem({ id: "sys-1", status: TargetSystemStatus.Active });
      dialogService.openSimpleDialog.mockResolvedValue(false);

      const comp = component as unknown as {
        disable: (s: TargetSystemResponse) => Promise<void>;
      };
      void comp.disable(sys);
      flushMicrotasks();

      expect(targetSystemsService.setEnabled).not.toHaveBeenCalled();
    }));

    it("shows success toast after disabling", fakeAsync(() => {
      const sys = makeSystem({ id: "sys-1", status: TargetSystemStatus.Active });
      dialogService.openSimpleDialog.mockResolvedValue(true);

      const comp = component as unknown as {
        disable: (s: TargetSystemResponse) => Promise<void>;
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
      const sys = makeSystem({ id: "sys-1", status: TargetSystemStatus.Disabled });

      const comp = component as unknown as {
        enable: (s: TargetSystemResponse) => Promise<void>;
      };
      await comp.enable(sys);

      expect(targetSystemsService.setEnabled).toHaveBeenCalledWith(sys, true);
    });

    it("shows success toast after enabling", async () => {
      const sys = makeSystem({ id: "sys-1", status: TargetSystemStatus.Disabled });

      const comp = component as unknown as {
        enable: (s: TargetSystemResponse) => Promise<void>;
      };
      await comp.enable(sys);

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    });
  });
});
