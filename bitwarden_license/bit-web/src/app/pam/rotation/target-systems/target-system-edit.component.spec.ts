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
import { DialogService, ToastService } from "@bitwarden/components";

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
      { provide: DialogService, useValue: mock<DialogService>() },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { params: { organizationId: "org-123" } },
        },
      },
    ],
  }).compileComponents();
}

/** Build create mode with a ?template query param and return the initialized component. */
async function setupCreateWithTemplate(template: string): Promise<
  TargetSystemEditComponent & {
    createForm: { getRawValue: () => { method: TargetSystemMethod; kind: TargetSystemKind } };
  }
> {
  const pamApi = mock<PamApiService>();
  TestBed.overrideComponent(TargetSystemEditComponent, { set: { template: "" } });
  await TestBed.configureTestingModule({
    imports: [TargetSystemEditComponent, NoopAnimationsModule],
    providers: [
      provideRouter([]),
      { provide: PamApiService, useValue: pamApi },
      { provide: I18nService, useValue: i18nFake },
      { provide: ToastService, useValue: mock<ToastService>() },
      { provide: DialogService, useValue: mock<DialogService>() },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { params: { organizationId: "org-123" }, queryParams: { template } },
        },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(TargetSystemEditComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.componentInstance as unknown as TargetSystemEditComponent & {
    createForm: { getRawValue: () => { method: TargetSystemMethod; kind: TargetSystemKind } };
  };
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
      { provide: DialogService, useValue: mock<DialogService>() },
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
    // Manual systems now carry an editable password policy.
    expect(call![1].passwordPolicy).toBeDefined();
  });

  it("does not submit when form is invalid (empty name)", async () => {
    pamApi.createTargetSystem.mockResolvedValue(makeSystem());
    jest.spyOn(router, "navigate").mockResolvedValue(true);

    // Leave name empty (invalid)
    const comp = fixture.componentInstance as unknown as { submitCreate: () => Promise<void> };
    await comp.submitCreate();

    expect(pamApi.createTargetSystem).not.toHaveBeenCalled();
  });

  it("seeds Manual method from the ?template=manual query param", async () => {
    TestBed.resetTestingModule();
    const comp = await setupCreateWithTemplate("manual");
    expect(comp.createForm.getRawValue().method).toBe(TargetSystemMethod.Manual);
    // No integration card for Manual (not Automatic), but the password-policy card is now shown.
    expect((comp as unknown as { isAutomatic: () => boolean }).isAutomatic()).toBe(false);
    expect((comp as unknown as { showPolicyCard: () => boolean }).showPolicyCard()).toBe(true);
  });

  it("seeds Automatic + Custom script from the ?template=custom-script query param", async () => {
    TestBed.resetTestingModule();
    const comp = await setupCreateWithTemplate("custom-script");
    const value = comp.createForm.getRawValue();
    expect(value.method).toBe(TargetSystemMethod.Automatic);
    expect(value.kind).toBe(TargetSystemKind.CustomScript);
    expect((comp as unknown as { showPolicyCard: () => boolean }).showPolicyCard()).toBe(true);
  });

  it("forces supportsSessionTermination=true for a native integration", async () => {
    pamApi.createTargetSystem.mockResolvedValue(makeSystem());
    jest.spyOn(router, "navigate").mockResolvedValue(true);

    const comp = fixture.componentInstance as unknown as {
      createForm: { patchValue: (v: unknown) => void };
      policyForm: { patchValue: (v: unknown) => void };
      submitCreate: () => Promise<void>;
    };
    comp.createForm.patchValue({
      name: "Prod Entra",
      method: TargetSystemMethod.Automatic,
      kind: TargetSystemKind.Entra,
    });
    // Leave the checkbox control false — native integrations must still report supported.
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

    const call = pamApi.createTargetSystem.mock.calls[0];
    expect(call![1].supportsSessionTermination).toBe(true);
  });

  it("honors the checkbox for a custom script", async () => {
    pamApi.createTargetSystem.mockResolvedValue(makeSystem());
    jest.spyOn(router, "navigate").mockResolvedValue(true);

    const comp = fixture.componentInstance as unknown as {
      createForm: { patchValue: (v: unknown) => void };
      policyForm: { patchValue: (v: unknown) => void };
      submitCreate: () => Promise<void>;
    };
    comp.createForm.patchValue({
      name: "Legacy DB",
      method: TargetSystemMethod.Automatic,
      kind: TargetSystemKind.CustomScript,
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

    const call = pamApi.createTargetSystem.mock.calls[0];
    expect(call![1].supportsSessionTermination).toBe(false);
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

// Mounts the real template (no override) so the radio group + reactive Integration/policy
// cards are exercised end-to-end — things a template-stubbed spec cannot catch.
describe("TargetSystemEditComponent — create mode (rendered)", () => {
  let fixture: ComponentFixture<TargetSystemEditComponent>;

  beforeEach(async () => {
    const pamApi = mock<PamApiService>();
    await TestBed.configureTestingModule({
      imports: [TargetSystemEditComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: PamApiService, useValue: pamApi },
        { provide: I18nService, useValue: i18nFake },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: DialogService, useValue: mock<DialogService>() },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { params: { organizationId: "org-123" }, queryParams: {} } },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TargetSystemEditComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  function patchMethod(method: TargetSystemMethod): void {
    (
      fixture.componentInstance as unknown as {
        createForm: { controls: { method: { setValue: (v: TargetSystemMethod) => void } } };
      }
    ).createForm.controls.method.setValue(method);
    fixture.detectChanges();
  }

  it("renders both method radio buttons", () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector("#target-system-edit_radio_automatic")).toBeTruthy();
    expect(el.querySelector("#target-system-edit_radio_manual")).toBeTruthy();
  });

  it("shows the Integration (kind) select only for the Automatic method", () => {
    const el = fixture.nativeElement as HTMLElement;
    // Defaults to Automatic → kind select present.
    expect(el.querySelector("#target-system-edit_select_kind")).toBeTruthy();

    patchMethod(TargetSystemMethod.Manual);
    expect(el.querySelector("#target-system-edit_select_kind")).toBeNull();

    patchMethod(TargetSystemMethod.Automatic);
    expect(el.querySelector("#target-system-edit_select_kind")).toBeTruthy();
  });

  function patchKind(kind: TargetSystemKind): void {
    (
      fixture.componentInstance as unknown as {
        createForm: { controls: { kind: { setValue: (v: TargetSystemKind) => void } } };
      }
    ).createForm.controls.kind.setValue(kind);
    fixture.detectChanges();
  }

  it("hides the session-termination checkbox for native integrations", () => {
    const el = fixture.nativeElement as HTMLElement;
    // Defaults to Automatic + Entra (native) → static "Supported", no checkbox.
    patchKind(TargetSystemKind.Entra);
    expect(el.querySelector("#target-system-edit_checkbox_session-termination")).toBeNull();
  });

  it("shows the session-termination checkbox only for custom scripts", () => {
    const el = fixture.nativeElement as HTMLElement;
    patchKind(TargetSystemKind.CustomScript);
    expect(el.querySelector("#target-system-edit_checkbox_session-termination")).toBeTruthy();
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

  it("persists name and policy together on submitEdit (Automatic)", async () => {
    pamApi.renameTargetSystem.mockResolvedValue(makeSystem({ name: "Renamed" }));
    pamApi.updateTargetSystemPolicy.mockResolvedValue(makeSystem());

    const comp = fixture.componentInstance as unknown as {
      nameForm: { patchValue: (v: unknown) => void };
      submitEdit: () => Promise<void>;
    };
    comp.nameForm.patchValue({ name: "Renamed" });
    await comp.submitEdit();

    expect(pamApi.renameTargetSystem).toHaveBeenCalledWith(
      "org-123",
      "sys-1",
      expect.objectContaining({ name: "Renamed" }),
    );
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

  it("deletes the target system after confirmation and navigates back", async () => {
    const dialog = TestBed.inject(DialogService) as unknown as ReturnType<
      typeof mock<DialogService>
    >;
    dialog.openSimpleDialog.mockResolvedValue(true);
    pamApi.deleteTargetSystem.mockResolvedValue(undefined);
    const nav = jest.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);

    await (
      fixture.componentInstance as unknown as { deleteSystem: () => Promise<void> }
    ).deleteSystem();

    expect(pamApi.deleteTargetSystem).toHaveBeenCalledWith("org-123", "sys-1");
    expect(nav).toHaveBeenCalled();
  });

  it("does not delete when confirmation is cancelled", async () => {
    const dialog = TestBed.inject(DialogService) as unknown as ReturnType<
      typeof mock<DialogService>
    >;
    dialog.openSimpleDialog.mockResolvedValue(false);

    await (
      fixture.componentInstance as unknown as { deleteSystem: () => Promise<void> }
    ).deleteSystem();

    expect(pamApi.deleteTargetSystem).not.toHaveBeenCalled();
  });

  it("saves the password policy for a Manual system (no session termination)", async () => {
    TestBed.resetTestingModule();
    const pamApiManual = mock<PamApiService>();
    const manual = makeSystem({
      method: TargetSystemMethod.Manual,
      kind: null,
      supportsSessionTermination: null,
    });
    pamApiManual.listTargetSystems.mockResolvedValue(makeListResponse([manual]));
    pamApiManual.renameTargetSystem.mockResolvedValue(manual);
    pamApiManual.updateTargetSystemPolicy.mockResolvedValue(manual);
    TestBed.overrideComponent(TargetSystemEditComponent, { set: { template: "" } });
    await TestBed.configureTestingModule({
      imports: [TargetSystemEditComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: PamApiService, useValue: pamApiManual },
        { provide: I18nService, useValue: i18nFake },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: DialogService, useValue: mock<DialogService>() },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { params: { organizationId: "org-123", targetSystemId: "sys-1" } },
          },
        },
      ],
    }).compileComponents();
    const fx = TestBed.createComponent(TargetSystemEditComponent);
    fx.detectChanges();
    await fx.whenStable();
    fx.detectChanges();

    await (fx.componentInstance as unknown as { submitEdit: () => Promise<void> }).submitEdit();

    expect(pamApiManual.updateTargetSystemPolicy).toHaveBeenCalledWith(
      "org-123",
      "sys-1",
      expect.objectContaining({
        passwordPolicy: expect.any(Object),
        supportsSessionTermination: false,
      }),
    );
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
        { provide: DialogService, useValue: mock<DialogService>() },
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
