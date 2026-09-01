import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { ActivatedRoute, Router, provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, ToastService } from "@bitwarden/components";

import type { TargetSystemView } from "../rotation";
import { TargetSystemKind, TargetSystemMethod, TargetSystemStatus } from "../rotation";
import { RotationSdkService } from "../rotation-sdk.service";
import { ORGANIZATION_ID, sysId } from "../testing/rotation-builders";

import { TargetSystemEditComponent } from "./target-system-edit.component";

// JSDOM has no ResizeObserver
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(global as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;

/** Simple i18n fake that echoes the key as its translation. */
const ORG_ID = ORGANIZATION_ID;

const i18nFake: Pick<I18nService, "t" | "translate"> = {
  t: (id: string) => id,
  translate: (id: string) => id,
};

function makeSystem(overrides: Partial<TargetSystemView> = {}): TargetSystemView {
  return {
    id: sysId("sys-1"),
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
  } as TargetSystemView;
}

/** Build a configured TestBed for create mode (no targetSystemId). */
async function setupCreate(rotationSdk: ReturnType<typeof mock<RotationSdkService>>) {
  TestBed.overrideComponent(TargetSystemEditComponent, { set: { template: "" } });
  await TestBed.configureTestingModule({
    imports: [TargetSystemEditComponent, NoopAnimationsModule],
    providers: [
      provideRouter([]),
      { provide: RotationSdkService, useValue: rotationSdk },
      { provide: I18nService, useValue: i18nFake },
      { provide: ToastService, useValue: mock<ToastService>() },
      { provide: DialogService, useValue: mock<DialogService>() },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { params: { organizationId: ORG_ID } },
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
  const rotationSdk = mock<RotationSdkService>();
  TestBed.overrideComponent(TargetSystemEditComponent, { set: { template: "" } });
  await TestBed.configureTestingModule({
    imports: [TargetSystemEditComponent, NoopAnimationsModule],
    providers: [
      provideRouter([]),
      { provide: RotationSdkService, useValue: rotationSdk },
      { provide: I18nService, useValue: i18nFake },
      { provide: ToastService, useValue: mock<ToastService>() },
      { provide: DialogService, useValue: mock<DialogService>() },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { params: { organizationId: ORG_ID }, queryParams: { template } },
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
async function setupEdit(rotationSdk: ReturnType<typeof mock<RotationSdkService>>) {
  TestBed.overrideComponent(TargetSystemEditComponent, { set: { template: "" } });
  await TestBed.configureTestingModule({
    imports: [TargetSystemEditComponent, NoopAnimationsModule],
    providers: [
      provideRouter([]),
      { provide: RotationSdkService, useValue: rotationSdk },
      { provide: I18nService, useValue: i18nFake },
      { provide: ToastService, useValue: mock<ToastService>() },
      { provide: DialogService, useValue: mock<DialogService>() },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { params: { organizationId: ORG_ID, targetSystemId: sysId("sys-1") } },
        },
      },
    ],
  }).compileComponents();
}

describe("TargetSystemEditComponent — create mode", () => {
  let fixture: ComponentFixture<TargetSystemEditComponent>;
  let rotationSdk: ReturnType<typeof mock<RotationSdkService>>;
  let toastService: ReturnType<typeof mock<ToastService>>;
  let router: Router;

  beforeEach(async () => {
    rotationSdk = mock<RotationSdkService>();
    toastService = mock<ToastService>();
    await setupCreate(rotationSdk);
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
    rotationSdk.createTargetSystem.mockResolvedValue(makeSystem());
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

    expect(rotationSdk.createTargetSystem).toHaveBeenCalled();
    expect(nav).toHaveBeenCalled();
  });

  it("calls createTargetSystem with Manual method", async () => {
    rotationSdk.createTargetSystem.mockResolvedValue(
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

    const call = rotationSdk.createTargetSystem.mock.calls[0];
    expect(call).toBeDefined();
    expect(call![1].method).toBe(TargetSystemMethod.Manual);
    // Manual systems now carry an editable password policy.
    expect(call![1].passwordPolicy).toBeDefined();
  });

  it("does not submit when form is invalid (empty name)", async () => {
    rotationSdk.createTargetSystem.mockResolvedValue(makeSystem());
    jest.spyOn(router, "navigate").mockResolvedValue(true);

    // Leave name empty (invalid)
    const comp = fixture.componentInstance as unknown as { submitCreate: () => Promise<void> };
    await comp.submitCreate();

    expect(rotationSdk.createTargetSystem).not.toHaveBeenCalled();
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
    rotationSdk.createTargetSystem.mockResolvedValue(makeSystem());
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

    const request = rotationSdk.createTargetSystem.mock.calls[0]![1];
    expect(request.method).toBe("automatic");
    expect(request).toMatchObject({ supportsSessionTermination: true });
  });

  it("honors the checkbox for a custom script", async () => {
    rotationSdk.createTargetSystem.mockResolvedValue(makeSystem());
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

    const request = rotationSdk.createTargetSystem.mock.calls[0]![1];
    expect(request.method).toBe("automatic");
    expect(request).toMatchObject({ supportsSessionTermination: false });
  });

  it("shows error toast on API failure", async () => {
    rotationSdk.createTargetSystem.mockRejectedValue(new Error("network fail"));
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
    const rotationSdk = mock<RotationSdkService>();
    await TestBed.configureTestingModule({
      imports: [TargetSystemEditComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: RotationSdkService, useValue: rotationSdk },
        { provide: I18nService, useValue: i18nFake },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: DialogService, useValue: mock<DialogService>() },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { params: { organizationId: ORG_ID }, queryParams: {} } },
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
  let rotationSdk: ReturnType<typeof mock<RotationSdkService>>;
  let toastService: ReturnType<typeof mock<ToastService>>;
  let dialogService: ReturnType<typeof mock<DialogService>>;

  beforeEach(async () => {
    rotationSdk = mock<RotationSdkService>();
    toastService = mock<ToastService>();
    dialogService = mock<DialogService>();
    rotationSdk.listTargetSystems.mockResolvedValue([makeSystem()]);
    await setupEdit(rotationSdk);
    TestBed.overrideProvider(ToastService, { useValue: toastService });
    TestBed.overrideProvider(DialogService, { useValue: dialogService });
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

  it("persists the name and the policy in one write on submitEdit", async () => {
    rotationSdk.updateTargetSystem.mockResolvedValue(undefined);
    rotationSdk.listTargetSystems.mockResolvedValue([makeSystem({ name: "Renamed" })]);

    const comp = fixture.componentInstance as unknown as {
      nameForm: { patchValue: (v: unknown) => void };
      submitEdit: () => Promise<void>;
    };
    comp.nameForm.patchValue({ name: "Renamed" });
    await comp.submitEdit();

    // One call, not two: the server takes the name, the policy and the capability together.
    expect(rotationSdk.updateTargetSystem).toHaveBeenCalledTimes(1);
    expect(rotationSdk.updateTargetSystem).toHaveBeenCalledWith(
      ORG_ID,
      sysId("sys-1"),
      expect.objectContaining({
        name: "Renamed",
        passwordPolicy: expect.any(Object),
      }),
    );
  });

  // Retirement — a target system has no delete route, so taking one out of service is disable.
  it("isActive is true for a system in service", () => {
    const comp = fixture.componentInstance as unknown as { isActive: () => boolean };
    expect(comp.isActive()).toBe(true);
  });

  it("disables the target system and re-reads once the operator confirms", async () => {
    dialogService.openSimpleDialog.mockResolvedValue(true);
    rotationSdk.disableTargetSystem.mockResolvedValue(undefined);
    rotationSdk.listTargetSystems.mockResolvedValue([
      makeSystem({ status: TargetSystemStatus.Disabled }),
    ]);

    const comp = fixture.componentInstance as unknown as {
      disableSystem: () => Promise<void>;
      isActive: () => boolean;
    };
    await comp.disableSystem();

    expect(rotationSdk.disableTargetSystem).toHaveBeenCalledWith(ORG_ID, sysId("sys-1"));
    // Disable answers 204, so the page must re-read to learn the new status.
    expect(rotationSdk.listTargetSystems).toHaveBeenCalled();
    expect(comp.isActive()).toBe(false);
    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" }),
    );
  });

  it("leaves the system alone when the confirmation is dismissed", async () => {
    dialogService.openSimpleDialog.mockResolvedValue(false);

    await (
      fixture.componentInstance as unknown as { disableSystem: () => Promise<void> }
    ).disableSystem();

    expect(rotationSdk.disableTargetSystem).not.toHaveBeenCalled();
  });

  it("shows an error toast when disable fails", async () => {
    dialogService.openSimpleDialog.mockResolvedValue(true);
    rotationSdk.disableTargetSystem.mockRejectedValue(new Error("boom"));

    await (
      fixture.componentInstance as unknown as { disableSystem: () => Promise<void> }
    ).disableSystem();

    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error" }),
    );
  });

  it("offers the reverse action for a retired system and returns it to service", async () => {
    // Rebuild against a system that is already out of service.
    TestBed.resetTestingModule();
    const retiredSdk = mock<RotationSdkService>();
    const retiredToast = mock<ToastService>();
    const retired = makeSystem({ status: TargetSystemStatus.Disabled });
    retiredSdk.listTargetSystems.mockResolvedValue([retired]);
    await setupEdit(retiredSdk);
    TestBed.overrideProvider(ToastService, { useValue: retiredToast });
    const fx = TestBed.createComponent(TargetSystemEditComponent);
    fx.detectChanges();
    await fx.whenStable();
    fx.detectChanges();

    const comp = fx.componentInstance as unknown as {
      isActive: () => boolean;
      enableSystem: () => Promise<void>;
    };
    expect(comp.isActive()).toBe(false);

    retiredSdk.enableTargetSystem.mockResolvedValue(undefined);
    retiredSdk.listTargetSystems.mockResolvedValue([
      makeSystem({ status: TargetSystemStatus.Active }),
    ]);
    // No confirmation: enable is the recoverable direction.
    await comp.enableSystem();

    expect(retiredSdk.enableTargetSystem).toHaveBeenCalledWith(ORG_ID, sysId("sys-1"));
    expect(comp.isActive()).toBe(true);
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

  it("saves the password policy for a Manual system (no session termination)", async () => {
    TestBed.resetTestingModule();
    const rotationApiManual = mock<RotationSdkService>();
    const manual = makeSystem({
      method: TargetSystemMethod.Manual,
      kind: null,
      supportsSessionTermination: null,
    });
    rotationApiManual.listTargetSystems.mockResolvedValue([manual]);
    rotationApiManual.updateTargetSystem.mockResolvedValue(undefined);
    TestBed.overrideComponent(TargetSystemEditComponent, { set: { template: "" } });
    await TestBed.configureTestingModule({
      imports: [TargetSystemEditComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: RotationSdkService, useValue: rotationApiManual },
        { provide: I18nService, useValue: i18nFake },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: DialogService, useValue: mock<DialogService>() },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { params: { organizationId: ORG_ID, targetSystemId: sysId("sys-1") } },
          },
        },
      ],
    }).compileComponents();
    const fx = TestBed.createComponent(TargetSystemEditComponent);
    fx.detectChanges();
    await fx.whenStable();
    fx.detectChanges();

    await (fx.componentInstance as unknown as { submitEdit: () => Promise<void> }).submitEdit();

    expect(rotationApiManual.updateTargetSystem).toHaveBeenCalledWith(
      ORG_ID,
      sysId("sys-1"),
      expect.objectContaining({
        passwordPolicy: expect.any(Object),
        supportsSessionTermination: false,
      }),
    );
  });

  it("navigates back when not found", async () => {
    // Rebuild for a missing id scenario
    TestBed.resetTestingModule();
    const rotationApi2 = mock<RotationSdkService>();
    const toastService2 = mock<ToastService>();
    rotationApi2.listTargetSystems.mockResolvedValue([]);
    TestBed.overrideComponent(TargetSystemEditComponent, { set: { template: "" } });
    await TestBed.configureTestingModule({
      imports: [TargetSystemEditComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: RotationSdkService, useValue: rotationApi2 },
        { provide: I18nService, useValue: i18nFake },
        { provide: ToastService, useValue: toastService2 },
        { provide: DialogService, useValue: mock<DialogService>() },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { params: { organizationId: ORG_ID, targetSystemId: sysId("missing-id") } },
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
