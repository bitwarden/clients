import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { ActivatedRoute, Router, provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";

import {
  PamApiService,
  TargetSystemKind,
  TargetSystemMethod,
  TargetSystemResponse,
  TargetSystemStatus,
} from "@bitwarden/bit-pam";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";

import { TargetSystemEditComponent } from "./target-system-edit.component";

// JSDOM has no ResizeObserver
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(global as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;

/** Simple i18n fake that echoes the key as its translation. */
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
    passwordPolicy: {
      minLength: 14,
      maxLength: 64,
      includeUppercase: true,
      includeLowercase: true,
      includeDigits: true,
      includeSymbols: true,
    },
    supportsSessionTermination: true,
    ...overrides,
  } as TargetSystemResponse;
}

function makeListResponse(data: TargetSystemResponse[]): ListResponse<TargetSystemResponse> {
  return { data, continuationToken: null } as unknown as ListResponse<TargetSystemResponse>;
}

/** Build a configured TestBed for create mode (no targetSystemId). */
async function setupCreate(pamApi: ReturnType<typeof mock<PamApiService>>) {
  TestBed.overrideComponent(TargetSystemEditComponent, { set: { template: "" } });
  await TestBed.configureTestingModule({
    imports: [TargetSystemEditComponent, NoopAnimationsModule],
    providers: [
      provideRouter([]),
      { provide: PamApiService, useValue: pamApi },
      { provide: I18nService, useValue: i18nFake },
      { provide: ToastService, useValue: mock<ToastService>() },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { params: { organizationId: "org-123" } },
        },
      },
    ],
  }).compileComponents();
}

/** Build a configured TestBed for edit mode (with targetSystemId). */
async function setupEdit(pamApi: ReturnType<typeof mock<PamApiService>>) {
  TestBed.overrideComponent(TargetSystemEditComponent, { set: { template: "" } });
  await TestBed.configureTestingModule({
    imports: [TargetSystemEditComponent, NoopAnimationsModule],
    providers: [
      provideRouter([]),
      { provide: PamApiService, useValue: pamApi },
      { provide: I18nService, useValue: i18nFake },
      { provide: ToastService, useValue: mock<ToastService>() },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { params: { organizationId: "org-123", targetSystemId: "sys-1" } },
        },
      },
    ],
  }).compileComponents();
}

describe("TargetSystemEditComponent — create mode", () => {
  let fixture: ComponentFixture<TargetSystemEditComponent>;
  let pamApi: ReturnType<typeof mock<PamApiService>>;
  let toastService: ReturnType<typeof mock<ToastService>>;
  let router: Router;

  beforeEach(async () => {
    pamApi = mock<PamApiService>();
    toastService = mock<ToastService>();
    await setupCreate(pamApi);
    // Override toast with our spy
    TestBed.overrideProvider(ToastService, { useValue: toastService });
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(TargetSystemEditComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it("editing flag is false", () => {
    const comp = fixture.componentInstance as unknown as { editing: boolean };
    expect(comp.editing).toBe(false);
  });

  it("titleText returns create title", () => {
    const comp = fixture.componentInstance as unknown as { titleText: () => string };
    expect(comp.titleText()).toBe("pamTargetSystemCreateTitle");
  });

  it("calls createTargetSystem on submit with Automatic method", async () => {
    pamApi.createTargetSystem.mockResolvedValue(makeSystem());
    const nav = jest.spyOn(router, "navigate").mockResolvedValue(true);

    // Patch form to valid state via the formGroup
    const createForm = (
      fixture.componentInstance as unknown as { createForm: { patchValue: (v: unknown) => void } }
    ).createForm;
    (createForm as unknown as { patchValue: (v: unknown) => void }).patchValue({
      name: "My System",
      method: TargetSystemMethod.Automatic,
      kind: TargetSystemKind.Entra,
    });

    const policyForm = (
      fixture.componentInstance as unknown as { policyForm: { patchValue: (v: unknown) => void } }
    ).policyForm;
    policyForm.patchValue({
      minLength: 14,
      maxLength: 64,
      includeUppercase: true,
      includeLowercase: true,
      includeDigits: true,
      includeSymbols: true,
      supportsSessionTermination: false,
    });

    fixture.detectChanges();
    await (
      fixture.componentInstance as unknown as { submitCreate: () => Promise<void> }
    ).submitCreate();

    expect(pamApi.createTargetSystem).toHaveBeenCalled();
    expect(nav).toHaveBeenCalled();
  });

  it("calls createTargetSystem with Manual method", async () => {
    pamApi.createTargetSystem.mockResolvedValue(
      makeSystem({ method: TargetSystemMethod.Manual, kind: null }),
    );
    jest.spyOn(router, "navigate").mockResolvedValue(true);

    const comp = fixture.componentInstance;
    (comp as unknown as { createForm: { patchValue: (v: unknown) => void } }).createForm.patchValue(
      {
        name: "Manual System",
        method: TargetSystemMethod.Manual,
      },
    );
    fixture.detectChanges();

    await (comp as unknown as { submitCreate: () => Promise<void> }).submitCreate();

    const call = pamApi.createTargetSystem.mock.calls[0];
    expect(call).toBeDefined();
    expect(call![1].method).toBe(TargetSystemMethod.Manual);
  });

  it("does not submit when form is invalid (empty name)", async () => {
    pamApi.createTargetSystem.mockResolvedValue(makeSystem());
    jest.spyOn(router, "navigate").mockResolvedValue(true);

    // Leave name empty (invalid)
    const comp = fixture.componentInstance as unknown as { submitCreate: () => Promise<void> };
    await comp.submitCreate();

    expect(pamApi.createTargetSystem).not.toHaveBeenCalled();
  });

  it("shows error toast on API failure", async () => {
    pamApi.createTargetSystem.mockRejectedValue(new Error("network fail"));
    jest.spyOn(router, "navigate").mockResolvedValue(true);

    const comp = fixture.componentInstance as unknown as {
      createForm: { patchValue: (v: unknown) => void };
      policyForm: { patchValue: (v: unknown) => void };
      submitCreate: () => Promise<void>;
    };
    comp.createForm.patchValue({
      name: "My System",
      method: TargetSystemMethod.Automatic,
      kind: TargetSystemKind.Entra,
    });
    comp.policyForm.patchValue({
      minLength: 14,
      maxLength: 64,
      includeUppercase: true,
      includeLowercase: true,
      includeDigits: true,
      includeSymbols: true,
      supportsSessionTermination: false,
    });
    fixture.detectChanges();
    await comp.submitCreate();

    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error" }),
    );
  });
});

describe("TargetSystemEditComponent — edit mode", () => {
  let fixture: ComponentFixture<TargetSystemEditComponent>;
  let pamApi: ReturnType<typeof mock<PamApiService>>;
  let toastService: ReturnType<typeof mock<ToastService>>;

  beforeEach(async () => {
    pamApi = mock<PamApiService>();
    toastService = mock<ToastService>();
    pamApi.listTargetSystems.mockResolvedValue(makeListResponse([makeSystem()]));
    await setupEdit(pamApi);
    TestBed.overrideProvider(ToastService, { useValue: toastService });
    fixture = TestBed.createComponent(TargetSystemEditComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it("editing flag is true", () => {
    const comp = fixture.componentInstance as unknown as { editing: boolean };
    expect(comp.editing).toBe(true);
  });

  it("titleText returns edit title", () => {
    const comp = fixture.componentInstance as unknown as { titleText: () => string };
    expect(comp.titleText()).toBe("pamTargetSystemEditTitle");
  });

  it("pre-fills the name form from existing system", () => {
    const nameForm = (
      fixture.componentInstance as unknown as {
        nameForm: { getRawValue: () => { name: string } };
      }
    ).nameForm;
    expect(nameForm.getRawValue().name).toBe("Prod Entra");
  });

  it("calls renameTargetSystem on submitName", async () => {
    pamApi.renameTargetSystem.mockResolvedValue(makeSystem({ name: "Renamed" }));

    const comp = fixture.componentInstance as unknown as {
      nameForm: { patchValue: (v: unknown) => void };
      submitName: () => Promise<void>;
    };
    comp.nameForm.patchValue({ name: "Renamed" });
    await comp.submitName();

    expect(pamApi.renameTargetSystem).toHaveBeenCalledWith(
      "org-123",
      "sys-1",
      expect.objectContaining({ name: "Renamed" }),
    );
    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" }),
    );
  });

  it("calls updateTargetSystemPolicy on submitPolicy", async () => {
    pamApi.updateTargetSystemPolicy.mockResolvedValue(makeSystem());

    const comp = fixture.componentInstance as unknown as {
      submitPolicy: () => Promise<void>;
    };
    await comp.submitPolicy();

    expect(pamApi.updateTargetSystemPolicy).toHaveBeenCalledWith(
      "org-123",
      "sys-1",
      expect.objectContaining({ passwordPolicy: expect.any(Object) }),
    );
    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" }),
    );
  });

  it("shows termination withdrawal warning when supportsSessionTermination unchecked", async () => {
    // existing has supportsSessionTermination: true; uncheck it
    const comp = fixture.componentInstance as unknown as {
      policyForm: { patchValue: (v: unknown) => void };
      showTerminationWarning: () => boolean;
    };
    comp.policyForm.patchValue({ supportsSessionTermination: false });
    fixture.detectChanges();
    expect(comp.showTerminationWarning()).toBe(true);
  });

  it("does not show termination warning when supportsSessionTermination checked", async () => {
    const comp = fixture.componentInstance as unknown as {
      policyForm: { patchValue: (v: unknown) => void };
      showTerminationWarning: () => boolean;
    };
    comp.policyForm.patchValue({ supportsSessionTermination: true });
    fixture.detectChanges();
    expect(comp.showTerminationWarning()).toBe(false);
  });

  it("navigates back when not found", async () => {
    // Rebuild for a missing id scenario
    TestBed.resetTestingModule();
    const pamApi2 = mock<PamApiService>();
    const toastService2 = mock<ToastService>();
    pamApi2.listTargetSystems.mockResolvedValue(makeListResponse([]));
    TestBed.overrideComponent(TargetSystemEditComponent, { set: { template: "" } });
    await TestBed.configureTestingModule({
      imports: [TargetSystemEditComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: PamApiService, useValue: pamApi2 },
        { provide: I18nService, useValue: i18nFake },
        { provide: ToastService, useValue: toastService2 },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { params: { organizationId: "org-123", targetSystemId: "missing-id" } },
          },
        },
      ],
    }).compileComponents();
    const router2 = TestBed.inject(Router);
    const nav = jest.spyOn(router2, "navigate").mockResolvedValue(true);

    const fixture2 = TestBed.createComponent(TargetSystemEditComponent);
    fixture2.detectChanges();
    await fixture2.whenStable();

    expect(nav).toHaveBeenCalled();
    expect(toastService2.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error" }),
    );
  });
});
