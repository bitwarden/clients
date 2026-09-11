import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormGroup } from "@angular/forms";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { ActivatedRoute, Router, provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { asUuid, uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import {
  CalloutComponent,
  DialogService,
  SelectItemView,
  ToastService,
} from "@bitwarden/components";

import type { AccessConnector, RotationConfig, TargetSystem, TargetSystemId } from "../rotation";
import {
  AccessConnectorStatus,
  TargetSystemKind,
  TargetSystemMethod,
  TargetSystemStatus,
} from "../rotation";
import { RotationSdkService } from "../rotation-sdk.service";
import {
  accessConnector,
  connectorId,
  ORGANIZATION_ID,
  rotationConfig,
  sysId,
  targetSystem,
} from "../testing/rotation-builders";

import {
  TargetSystemEditComponent,
  targetSystemEditDiscardGuard,
} from "./target-system-edit.component";

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

/**
 * Stands in for the rotation shell route.
 */
const ROUTE_PARENT = { snapshot: { params: {} } };

function makeSystem(overrides: Partial<TargetSystem> = {}): TargetSystem {
  return targetSystem({ id: sysId("sys-1"), ...overrides });
}

const NO_CHARACTER_CLASSES = {
  includeUppercase: false,
  includeLowercase: false,
  includeDigits: false,
  includeSymbols: false,
};

function policyFormOf(fixture: ComponentFixture<TargetSystemEditComponent>): FormGroup {
  return (fixture.componentInstance as unknown as { policyForm: FormGroup }).policyForm;
}

function nameFormOf(fixture: ComponentFixture<TargetSystemEditComponent>): FormGroup {
  return (fixture.componentInstance as unknown as { nameForm: FormGroup }).nameForm;
}

function createFormOf(fixture: ComponentFixture<TargetSystemEditComponent>): FormGroup {
  return (fixture.componentInstance as unknown as { createForm: FormGroup }).createForm;
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

/** Build create mode with arbitrary query params, returning the pieces a handoff test needs. */
async function setupCreateWithQueryParams(queryParams: Record<string, string>) {
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
          snapshot: { params: { organizationId: ORG_ID }, queryParams },
          parent: ROUTE_PARENT,
        },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(TargetSystemEditComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return {
    fixture,
    rotationSdk,
    router: TestBed.inject(Router),
    component: fixture.componentInstance as unknown as {
      createForm: { patchValue: (v: unknown) => void };
      submitCreate: () => Promise<void>;
    },
  };
}

/** Build a configured TestBed for edit mode (with targetSystemId). */
async function setupEdit(
  rotationSdk: ReturnType<typeof mock<RotationSdkService>>,
  routeTargetSystemId: string = uuidAsString(sysId("sys-1")),
) {
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
          snapshot: { params: { organizationId: ORG_ID, targetSystemId: routeTargetSystemId } },
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
    // Manual systems carry an editable password policy.
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

  it("marks the policy invalid when every character class is cleared", () => {
    const policyForm = policyFormOf(fixture);
    policyForm.patchValue(NO_CHARACTER_CLASSES);

    expect(policyForm.invalid).toBe(true);
    expect(policyForm.errors?.["noCharacterClass"]).toBe(true);
  });

  it("clears the character-class error when one class is re-enabled", () => {
    const policyForm = policyFormOf(fixture);
    policyForm.patchValue(NO_CHARACTER_CLASSES);
    policyForm.patchValue({ includeSymbols: true });

    expect(policyForm.errors).toBeNull();
    expect(policyForm.valid).toBe(true);
  });

  it("does not create a target system when every character class is cleared", async () => {
    rotationSdk.createTargetSystem.mockResolvedValue(makeSystem());
    jest.spyOn(router, "navigate").mockResolvedValue(true);

    const comp = fixture.componentInstance as unknown as {
      createForm: { patchValue: (v: unknown) => void };
      submitCreate: () => Promise<void>;
    };
    comp.createForm.patchValue({
      name: "No classes",
      method: TargetSystemMethod.Automatic,
      kind: TargetSystemKind.Entra,
    });
    policyFormOf(fixture).patchValue(NO_CHARACTER_CLASSES);
    await comp.submitCreate();

    expect(rotationSdk.createTargetSystem).not.toHaveBeenCalled();
  });

  it("seeds Manual method from the ?template=manual query param", async () => {
    TestBed.resetTestingModule();
    const comp = await setupCreateWithTemplate("manual");
    expect(comp.createForm.getRawValue().method).toBe(TargetSystemMethod.Manual);
    // No integration card for Manual (not Automatic), but the password-policy card is shown for
    // both methods.
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

  /**
   * The managed-credential create page sends the operator here when its target picker has nothing
   * they want.
   */
  it("returns to the credential create page with the new target when ?then=managed-credential", async () => {
    TestBed.resetTestingModule();
    const created = makeSystem({ id: sysId("sys-new") });
    const { component, rotationSdk, router } = await setupCreateWithQueryParams({
      then: "managed-credential",
    });
    rotationSdk.createTargetSystem.mockResolvedValue(created);
    const nav = jest.spyOn(router, "navigate").mockResolvedValue(true);

    component.createForm.patchValue({
      name: "Manual System",
      method: TargetSystemMethod.Manual,
    });
    await component.submitCreate();

    expect(nav).toHaveBeenCalledWith(
      ["managed-credentials", "new"],
      expect.objectContaining({
        relativeTo: ROUTE_PARENT,
        queryParams: { targetSystemId: sysId("sys-new") },
      }),
    );
  });

  it("does not ask to discard when handing back to the credential create page", async () => {
    TestBed.resetTestingModule();
    const { fixture, component, rotationSdk, router } = await setupCreateWithQueryParams({
      then: "managed-credential",
    });
    rotationSdk.createTargetSystem.mockResolvedValue(makeSystem({ id: sysId("sys-new") }));
    jest.spyOn(router, "navigate").mockResolvedValue(true);
    const dialogService = TestBed.inject(DialogService);

    component.createForm.patchValue({
      name: "Manual System",
      method: TargetSystemMethod.Manual,
    });
    createFormOf(fixture).markAsDirty();
    await component.submitCreate();

    await expect(
      targetSystemEditDiscardGuard(
        fixture.componentInstance,
        null as never,
        null as never,
        null as never,
      ) as Promise<boolean>,
    ).resolves.toBe(true);
    expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
  });

  it("goes to the target-systems list after create when no ?then is given", async () => {
    TestBed.resetTestingModule();
    const { component, rotationSdk, router } = await setupCreateWithQueryParams({});
    rotationSdk.createTargetSystem.mockResolvedValue(makeSystem());
    const nav = jest.spyOn(router, "navigate").mockResolvedValue(true);

    component.createForm.patchValue({
      name: "Manual System",
      method: TargetSystemMethod.Manual,
    });
    await component.submitCreate();

    expect(nav).toHaveBeenCalledWith(
      [".."],
      expect.objectContaining({ relativeTo: expect.anything() }),
    );
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

// Mounts the real template so the radio group and reactive cards are exercised end-to-end.
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

  it("renders a consequence hint under each method radio", () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector("#target-system-edit_radio_automatic bit-hint")?.textContent).toContain(
      "pamTargetSystemMethodAutomaticHint",
    );
    expect(el.querySelector("#target-system-edit_radio_manual bit-hint")?.textContent).toContain(
      "pamTargetSystemMethodManualHint",
    );
  });

  it("shows the Integration (kind) select only for the Automatic method", () => {
    const el = fixture.nativeElement as HTMLElement;
    // Automatic is the default: kind select is present.
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
    // Automatic + Entra (native) is the default: static "Supported" text, no checkbox.
    patchKind(TargetSystemKind.Entra);
    expect(el.querySelector("#target-system-edit_checkbox_session-termination")).toBeNull();
  });

  it("shows the session-termination checkbox only for custom scripts", () => {
    const el = fixture.nativeElement as HTMLElement;
    patchKind(TargetSystemKind.CustomScript);
    expect(el.querySelector("#target-system-edit_checkbox_session-termination")).toBeTruthy();
  });

  it("renders the character-class error only once every class is cleared", () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector("#target-system-edit_error_character-class")).toBeNull();

    const policyForm = policyFormOf(fixture);
    policyForm.patchValue(NO_CHARACTER_CLASSES);
    policyForm.markAllAsTouched();
    fixture.detectChanges();

    expect(el.querySelector("#target-system-edit_error_character-class")).toBeTruthy();
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

  it("does not save when every character class is cleared", async () => {
    rotationSdk.updateTargetSystem.mockResolvedValue(undefined);

    policyFormOf(fixture).patchValue(NO_CHARACTER_CLASSES);
    await (
      fixture.componentInstance as unknown as { submitEdit: () => Promise<void> }
    ).submitEdit();

    expect(rotationSdk.updateTargetSystem).not.toHaveBeenCalled();
  });

  it("isActive is true for a system in service", () => {
    const comp = fixture.componentInstance as unknown as { isActive: () => boolean };
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
    expect(
      (fixture2.componentInstance as unknown as { loadError: () => unknown }).loadError(),
    ).toBeNull();
  });

  const mixedCaseIdCases: [string, TargetSystemId, string][] = [
    ["the route id is uppercase", sysId("sys-1"), uuidAsString(sysId("sys-1")).toUpperCase()],
    [
      "the stored id is uppercase and the route id is lower case",
      asUuid<TargetSystemId>(uuidAsString(sysId("sys-1")).toUpperCase()),
      uuidAsString(sysId("sys-1")),
    ],
  ];

  it.each(mixedCaseIdCases)(
    "loads the record when %s",
    async (_case, storedId, routeTargetSystemId) => {
      TestBed.resetTestingModule();
      const caseSdk = mock<RotationSdkService>();
      const caseToast = mock<ToastService>();
      caseSdk.listTargetSystems.mockResolvedValue([makeSystem({ id: storedId })]);
      await setupEdit(caseSdk, routeTargetSystemId);
      TestBed.overrideProvider(ToastService, { useValue: caseToast });
      const nav = jest.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);

      const fx = TestBed.createComponent(TargetSystemEditComponent);
      fx.detectChanges();
      await fx.whenStable();
      fx.detectChanges();

      expect(nameFormOf(fx).getRawValue().name).toBe("Prod Entra");
      expect(nav).not.toHaveBeenCalled();
      expect(caseToast.showToast).not.toHaveBeenCalled();
    },
  );
});

describe("TargetSystemEditComponent — discard guard", () => {
  let rotationSdk: ReturnType<typeof mock<RotationSdkService>>;
  let dialogService: ReturnType<typeof mock<DialogService>>;
  let router: Router;

  const CREATE_DIALOG = {
    title: { key: "pamTargetSystemDiscardTitle" },
    content: { key: "pamDiscardContent" },
    acceptButtonText: { key: "pamDiscardConfirm" },
    cancelButtonText: { key: "cancel" },
    type: "warning",
  };

  const EDIT_DIALOG = {
    title: { key: "discardEditsTitle" },
    content: { key: "discardEditsConfirmation" },
    acceptButtonText: { key: "discardEdits" },
    cancelButtonText: { key: "keepEditing" },
    type: "warning",
  };

  function runGuard(component: TargetSystemEditComponent): Promise<boolean> {
    return targetSystemEditDiscardGuard(
      component,
      null as never,
      null as never,
      null as never,
    ) as Promise<boolean>;
  }

  async function mount(mode: "create" | "edit") {
    rotationSdk = mock<RotationSdkService>();
    dialogService = mock<DialogService>();
    rotationSdk.listTargetSystems.mockResolvedValue([makeSystem()]);
    if (mode === "create") {
      await setupCreate(rotationSdk);
    } else {
      await setupEdit(rotationSdk);
    }
    TestBed.overrideProvider(ToastService, { useValue: mock<ToastService>() });
    TestBed.overrideProvider(DialogService, { useValue: dialogService });
    router = TestBed.inject(Router);
    const fixture = TestBed.createComponent(TargetSystemEditComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it("leaves an untouched create form without asking", async () => {
    const fixture = await mount("create");

    await expect(runGuard(fixture.componentInstance)).resolves.toBe(true);
    expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
  });

  it("asks about an abandoned new target system", async () => {
    const fixture = await mount("create");
    dialogService.openSimpleDialog.mockResolvedValue(true);

    createFormOf(fixture).controls.name.markAsDirty();

    await expect(runGuard(fixture.componentInstance)).resolves.toBe(true);
    expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(CREATE_DIALOG);
  });

  it("asks when only the policy card was touched", async () => {
    const fixture = await mount("create");
    dialogService.openSimpleDialog.mockResolvedValue(true);

    policyFormOf(fixture).controls.minLength.markAsDirty();

    await expect(runGuard(fixture.componentInstance)).resolves.toBe(true);
    expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(CREATE_DIALOG);
  });

  it("asks about unsaved edits with the shared edit wording", async () => {
    const fixture = await mount("edit");
    dialogService.openSimpleDialog.mockResolvedValue(true);

    nameFormOf(fixture).controls.name.markAsDirty();

    await expect(runGuard(fixture.componentInstance)).resolves.toBe(true);
    expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(EDIT_DIALOG);
  });

  it("stays on the page when the operator keeps editing", async () => {
    const fixture = await mount("edit");
    dialogService.openSimpleDialog.mockResolvedValue(false);
    const nav = jest.spyOn(router, "navigate").mockResolvedValue(true);

    nameFormOf(fixture).patchValue({ name: "Half typed" });
    nameFormOf(fixture).markAsDirty();
    await (fixture.componentInstance as unknown as { cancel: () => Promise<void> }).cancel();

    await expect(runGuard(fixture.componentInstance)).resolves.toBe(false);
    expect(nav).not.toHaveBeenCalled();
    expect(nameFormOf(fixture).getRawValue().name).toBe("Half typed");
  });

  it("does not ask after a successful save", async () => {
    const fixture = await mount("edit");
    rotationSdk.updateTargetSystem.mockResolvedValue(undefined);

    nameFormOf(fixture).patchValue({ name: "Renamed" });
    nameFormOf(fixture).markAsDirty();
    await (
      fixture.componentInstance as unknown as { submitEdit: () => Promise<void> }
    ).submitEdit();

    await expect(runGuard(fixture.componentInstance)).resolves.toBe(true);
    expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
  });

  it("does not ask after a successful create", async () => {
    const fixture = await mount("create");
    rotationSdk.createTargetSystem.mockResolvedValue(makeSystem());
    jest.spyOn(router, "navigate").mockResolvedValue(true);

    const createForm = createFormOf(fixture);
    createForm.patchValue({
      name: "My System",
      method: TargetSystemMethod.Automatic,
      kind: TargetSystemKind.Entra,
    });
    createForm.markAsDirty();
    await (
      fixture.componentInstance as unknown as { submitCreate: () => Promise<void> }
    ).submitCreate();

    expect(rotationSdk.createTargetSystem).toHaveBeenCalled();
    await expect(runGuard(fixture.componentInstance)).resolves.toBe(true);
    expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
  });
});

/**
 * The assigned-access-connectors picker, the diff it stages, and the one action row.
 */
describe("TargetSystemEditComponent — assigned access connectors", () => {
  /** One row of the picker's table, as these tests read it. */
  type ConnectorRow = {
    connector: AccessConnector;
    statusLabelKey: string;
    staged: "assign" | "unassign" | null;
  };

  /** The component's protected surface, as these tests drive it. */
  type AssignmentsComp = {
    assignedConnectorRows: () => ConnectorRow[];
    connectorOptions: () => SelectItemView[];
    noConnectorsEligible: () => boolean;
    canAssignConnectors: () => boolean;
    connectorsUnavailable: () => boolean;
    stageAssign: (selected: SelectItemView[]) => Promise<readonly string[]>;
    stageUnassign: (row: ConnectorRow) => Promise<boolean>;
    submitEdit: () => Promise<void>;
    deleteSystem: () => Promise<void>;
  };

  const SYSTEM_ID = sysId("sys-1");

  let fixture: ComponentFixture<TargetSystemEditComponent>;
  let component: AssignmentsComp;
  let rotationSdk: ReturnType<typeof mock<RotationSdkService>>;
  let toastService: ReturnType<typeof mock<ToastService>>;
  let dialogService: ReturnType<typeof mock<DialogService>>;
  let router: Router;

  /** The option the picker would offer for a connector. */
  function optionFor(connector: AccessConnector): SelectItemView {
    return { id: String(connector.id), listName: connector.name, labelName: connector.name };
  }

  function rowFor(connector: AccessConnector): ConnectorRow {
    const row = component.assignedConnectorRows().find((r) => r.connector.id === connector.id);
    expect(row).toBeDefined();
    return row!;
  }

  async function setup(
    connectors: AccessConnector[],
    system: Partial<TargetSystem> = {},
    renderTemplate = false,
  ): Promise<void> {
    TestBed.resetTestingModule();
    rotationSdk = mock<RotationSdkService>();
    toastService = mock<ToastService>();
    dialogService = mock<DialogService>();
    rotationSdk.listTargetSystems.mockResolvedValue([makeSystem({ id: SYSTEM_ID, ...system })]);
    rotationSdk.listConnectors.mockResolvedValue(connectors);
    rotationSdk.listConfigs.mockResolvedValue([]);
    if (!renderTemplate) {
      TestBed.overrideComponent(TargetSystemEditComponent, { set: { template: "" } });
    }
    await TestBed.configureTestingModule({
      imports: [TargetSystemEditComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: RotationSdkService, useValue: rotationSdk },
        { provide: I18nService, useValue: i18nFake },
        { provide: ToastService, useValue: toastService },
        { provide: DialogService, useValue: dialogService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { params: { organizationId: ORG_ID, targetSystemId: SYSTEM_ID } } },
        },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    jest.spyOn(router, "navigate").mockResolvedValue(true);
    fixture = TestBed.createComponent(TargetSystemEditComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    component = fixture.componentInstance as unknown as AssignmentsComp;
  }

  it("lists only the connectors that name this target system", async () => {
    const assigned = accessConnector({
      id: connectorId("c-assigned"),
      name: "Prod connector",
      assignedTargetSystemIds: [SYSTEM_ID],
    });
    const elsewhere = accessConnector({
      id: connectorId("c-elsewhere"),
      assignedTargetSystemIds: [sysId("sys-other")],
    });
    await setup([assigned, elsewhere]);

    expect(component.assignedConnectorRows().map((r) => r.connector.id)).toEqual([assigned.id]);
    expect(component.assignedConnectorRows().map((r) => r.staged)).toEqual([null]);
  });

  it("lists a connector whose stored assignment id differs from the route id only in case", async () => {
    const assigned = accessConnector({
      id: connectorId("c-assigned"),
      name: "Prod connector",
      assignedTargetSystemIds: [asUuid<TargetSystemId>(uuidAsString(SYSTEM_ID).toUpperCase())],
    });
    await setup([assigned]);

    expect(component.assignedConnectorRows().map((r) => r.connector.id)).toEqual([assigned.id]);
    expect(component.connectorOptions()).toEqual([]);
  });

  it("derives no rows when nothing is assigned, and offers what is free", async () => {
    const free = accessConnector({ id: connectorId("c-free") });
    await setup([free]);

    expect(component.assignedConnectorRows()).toEqual([]);
    expect(component.connectorOptions().map((o) => o.id)).toEqual([free.id]);
  });

  it("offers nothing once every enabled connector is assigned here", async () => {
    await setup([
      accessConnector({ id: connectorId("c-1"), assignedTargetSystemIds: [SYSTEM_ID] }),
      accessConnector({ id: connectorId("c-2"), status: AccessConnectorStatus.Disabled }),
    ]);

    expect(component.connectorOptions()).toEqual([]);
    // Having assigned them all is not the same as the org having none; the hint differs.
    expect(component.noConnectorsEligible()).toBe(false);
  });

  it("separates having nothing eligible from having assigned it all", async () => {
    await setup([
      accessConnector({ id: connectorId("c-1"), status: AccessConnectorStatus.Disabled }),
    ]);

    expect(component.connectorOptions()).toEqual([]);
    expect(component.noConnectorsEligible()).toBe(true);
  });

  it("labels a disabled, offline connector by key rather than by word", async () => {
    await setup([
      accessConnector({
        id: connectorId("c-1"),
        status: AccessConnectorStatus.Disabled,
        isConnected: false,
        assignedTargetSystemIds: [SYSTEM_ID],
      }),
    ]);

    expect(component.assignedConnectorRows()[0].statusLabelKey).toBe(
      "pamAccessConnectorStatusInactive",
    );
  });

  it("offers assignment only for an active, automatic target", async () => {
    await setup([], { status: TargetSystemStatus.Disabled });
    expect(component.canAssignConnectors()).toBe(false);

    await setup([], { method: TargetSystemMethod.Manual, kind: undefined });
    expect(component.canAssignConnectors()).toBe(false);

    await setup([]);
    expect(component.canAssignConnectors()).toBe(true);
  });

  it("reports the connector list as unavailable rather than as empty when the read fails", async () => {
    TestBed.resetTestingModule();
    rotationSdk = mock<RotationSdkService>();
    rotationSdk.listTargetSystems.mockResolvedValue([makeSystem({ id: SYSTEM_ID })]);
    rotationSdk.listConnectors.mockRejectedValue(new Error("boom"));
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
          useValue: { snapshot: { params: { organizationId: ORG_ID, targetSystemId: SYSTEM_ID } } },
        },
      ],
    }).compileComponents();
    const fx = TestBed.createComponent(TargetSystemEditComponent);
    fx.detectChanges();
    await fx.whenStable();
    fx.detectChanges();

    const comp = fx.componentInstance as unknown as AssignmentsComp;
    expect(comp.connectorsUnavailable()).toBe(true);
    expect(comp.noConnectorsEligible()).toBe(false);
  });

  describe("staging", () => {
    it("adds a marked row and writes nothing", async () => {
      const free = accessConnector({ id: connectorId("c-free"), name: "Spare connector" });
      await setup([free]);

      await expect(component.stageAssign([optionFor(free)])).resolves.toEqual([free.id]);

      expect(rowFor(free).staged).toBe("assign");
      expect(rotationSdk.assignTarget).not.toHaveBeenCalled();
      expect(component.connectorOptions()).toEqual([]);
    });

    it("marks a stored row for removal but leaves it in the table", async () => {
      const assigned = accessConnector({
        id: connectorId("c-assigned"),
        assignedTargetSystemIds: [SYSTEM_ID],
      });
      await setup([assigned]);

      await expect(component.stageUnassign(rowFor(assigned))).resolves.toBe(true);

      expect(rowFor(assigned).staged).toBe("unassign");
      expect(rotationSdk.unassignTarget).not.toHaveBeenCalled();
      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
    });

    it("offers a connector staged for removal back, and re-assigning it cancels the removal", async () => {
      const assigned = accessConnector({
        id: connectorId("c-assigned"),
        assignedTargetSystemIds: [SYSTEM_ID],
      });
      await setup([assigned]);
      await component.stageUnassign(rowFor(assigned));

      expect(component.connectorOptions().map((o) => o.id)).toEqual([assigned.id]);

      await component.stageAssign([optionFor(assigned)]);

      expect(component.assignedConnectorRows()).toHaveLength(1);
      expect(rowFor(assigned).staged).toBeNull();
    });

    it("drops a staged assignment rather than staging a removal for it", async () => {
      const free = accessConnector({ id: connectorId("c-free") });
      await setup([free]);
      await component.stageAssign([optionFor(free)]);

      await expect(component.stageUnassign(rowFor(free))).resolves.toBe(true);

      expect(component.assignedConnectorRows()).toEqual([]);
      expect(component.connectorOptions().map((o) => o.id)).toEqual([free.id]);
    });

    it("reports nothing changed when a row is already staged for removal", async () => {
      const assigned = accessConnector({
        id: connectorId("c-assigned"),
        assignedTargetSystemIds: [SYSTEM_ID],
      });
      await setup([assigned]);
      await component.stageUnassign(rowFor(assigned));

      await expect(component.stageUnassign(rowFor(assigned))).resolves.toBe(false);
      expect(component.assignedConnectorRows()).toHaveLength(1);
    });

    it("ignores a selection that is not on offer", async () => {
      const disabled = accessConnector({
        id: connectorId("c-disabled"),
        status: AccessConnectorStatus.Disabled,
      });
      await setup([disabled]);

      await expect(component.stageAssign([optionFor(disabled)])).resolves.toEqual([]);
      expect(component.assignedConnectorRows()).toEqual([]);
    });

    it("marks the edit form dirty so the unsaved-changes guard fires", async () => {
      const free = accessConnector({ id: connectorId("c-free") });
      await setup([free]);
      dialogService.openSimpleDialog.mockResolvedValue(true);
      expect(nameFormOf(fixture).dirty).toBe(false);

      await component.stageAssign([optionFor(free)]);

      expect(nameFormOf(fixture).dirty).toBe(true);
      await expect(
        targetSystemEditDiscardGuard(
          fixture.componentInstance,
          null as never,
          null as never,
          null as never,
        ) as Promise<boolean>,
      ).resolves.toBe(true);
      expect(dialogService.openSimpleDialog).toHaveBeenCalled();
    });

    it("marks the edit form dirty for a staged removal too", async () => {
      const assigned = accessConnector({
        id: connectorId("c-assigned"),
        assignedTargetSystemIds: [SYSTEM_ID],
      });
      await setup([assigned]);

      await component.stageUnassign(rowFor(assigned));

      expect(nameFormOf(fixture).dirty).toBe(true);
    });
  });

  describe("saving the staged diff", () => {
    it("writes the record first, then the removals, then the additions", async () => {
      const assigned = accessConnector({
        id: connectorId("c-assigned"),
        assignedTargetSystemIds: [SYSTEM_ID],
      });
      const free = accessConnector({ id: connectorId("c-free") });
      await setup([assigned, free]);
      rotationSdk.updateTargetSystem.mockResolvedValue(undefined);
      rotationSdk.assignTarget.mockResolvedValue(undefined);
      rotationSdk.unassignTarget.mockResolvedValue(undefined);

      await component.stageUnassign(rowFor(assigned));
      await component.stageAssign([optionFor(free)]);
      await component.submitEdit();

      expect(rotationSdk.unassignTarget).toHaveBeenCalledWith(ORG_ID, assigned.id, SYSTEM_ID);
      expect(rotationSdk.assignTarget).toHaveBeenCalledWith(ORG_ID, free.id, SYSTEM_ID);
      expect(rotationSdk.updateTargetSystem.mock.invocationCallOrder[0]).toBeLessThan(
        rotationSdk.unassignTarget.mock.invocationCallOrder[0],
      );
      expect(rotationSdk.unassignTarget.mock.invocationCallOrder[0]).toBeLessThan(
        rotationSdk.assignTarget.mock.invocationCallOrder[0],
      );
    });

    it("clears the staged marks, re-reads, and stops the guard asking", async () => {
      const free = accessConnector({ id: connectorId("c-free") });
      await setup([free]);
      rotationSdk.updateTargetSystem.mockResolvedValue(undefined);
      rotationSdk.assignTarget.mockResolvedValue(undefined);

      await component.stageAssign([optionFor(free)]);
      rotationSdk.listConnectors.mockResolvedValue([
        accessConnector({ id: free.id, assignedTargetSystemIds: [SYSTEM_ID] }),
      ]);
      await component.submitEdit();

      expect(component.assignedConnectorRows().map((r) => r.staged)).toEqual([null]);
      expect(nameFormOf(fixture).dirty).toBe(false);
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    });

    it("leaves the assignments alone when the record write is refused", async () => {
      const free = accessConnector({ id: connectorId("c-free") });
      await setup([free]);
      rotationSdk.updateTargetSystem.mockRejectedValue(new Error("boom"));

      await component.stageAssign([optionFor(free)]);
      await component.submitEdit();

      expect(rotationSdk.assignTarget).not.toHaveBeenCalled();
      expect(rowFor(free).staged).toBe("assign");
      expect(nameFormOf(fixture).dirty).toBe(true);
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
    });

    it("applies what it can and keeps only the refused write staged", async () => {
      const takes = accessConnector({
        id: connectorId("c-takes"),
        assignedTargetSystemIds: [SYSTEM_ID],
      });
      const refuses = accessConnector({
        id: connectorId("c-refuses"),
        assignedTargetSystemIds: [SYSTEM_ID],
      });
      await setup([takes, refuses]);
      rotationSdk.updateTargetSystem.mockResolvedValue(undefined);
      rotationSdk.unassignTarget.mockImplementation((_org, connector) =>
        connector === refuses.id ? Promise.reject(new Error("boom")) : Promise.resolve(),
      );

      await component.stageUnassign(rowFor(takes));
      await component.stageUnassign(rowFor(refuses));
      rotationSdk.listConnectors.mockResolvedValue([
        accessConnector({ id: takes.id }),
        accessConnector({ id: refuses.id, assignedTargetSystemIds: [SYSTEM_ID] }),
      ]);
      await component.submitEdit();

      expect(rotationSdk.unassignTarget).toHaveBeenCalledTimes(2);
      expect(component.assignedConnectorRows().map((r) => [r.connector.id, r.staged])).toEqual([
        [refuses.id, "unassign"],
      ]);
      expect(nameFormOf(fixture).dirty).toBe(true);
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
      expect(toastService.showToast).not.toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    });

    it("does not re-read the connectors when nothing was staged", async () => {
      await setup([]);
      rotationSdk.updateTargetSystem.mockResolvedValue(undefined);
      rotationSdk.listConnectors.mockClear();

      await component.submitEdit();

      expect(rotationSdk.listConnectors).not.toHaveBeenCalled();
      expect(rotationSdk.assignTarget).not.toHaveBeenCalled();
      expect(rotationSdk.unassignTarget).not.toHaveBeenCalled();
    });
  });

  describe("deleteSystem", () => {
    it("deletes and leaves the page once the operator confirms", async () => {
      await setup([]);
      dialogService.openSimpleDialog.mockResolvedValue(true);
      rotationSdk.deleteTargetSystem.mockResolvedValue(undefined);

      await component.deleteSystem();

      expect(rotationSdk.deleteTargetSystem).toHaveBeenCalledWith(ORG_ID, SYSTEM_ID);
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
      expect(router.navigate).toHaveBeenCalled();
    });

    it("warns that connector assignments go with the target when there are any", async () => {
      await setup([
        accessConnector({ id: connectorId("c-assigned"), assignedTargetSystemIds: [SYSTEM_ID] }),
      ]);
      dialogService.openSimpleDialog.mockResolvedValue(false);

      await component.deleteSystem();

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            key: "pamTargetSystemDeleteAssignedConnectorsContent",
          }),
        }),
      );
    });

    it("uses the plain confirmation when nothing is assigned", async () => {
      await setup([]);
      dialogService.openSimpleDialog.mockResolvedValue(false);

      await component.deleteSystem();

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            key: "pamTargetSystemDeleteContentDeactivateInstead",
          }),
        }),
      );
      expect(rotationSdk.deleteTargetSystem).not.toHaveBeenCalled();
    });

    it("stays on the page and surfaces the refusal when the server rejects the delete", async () => {
      await setup([]);
      dialogService.openSimpleDialog.mockResolvedValue(true);
      rotationSdk.deleteTargetSystem.mockRejectedValue(new Error("still referenced"));

      await component.deleteSystem();

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe("rendered", () => {
    function el(): HTMLElement {
      return fixture.nativeElement as HTMLElement;
    }

    it("renders the picker with a row per assigned connector and a remove control", async () => {
      await setup(
        [
          accessConnector({
            id: connectorId("c-assigned"),
            name: "Prod connector",
            assignedTargetSystemIds: [SYSTEM_ID],
          }),
        ],
        {},
        true,
      );

      expect(el().querySelector("pam-assignment-picker")).toBeTruthy();
      expect(el().querySelector("#target-system-edit_multi-select_options")).toBeTruthy();
      expect(el().querySelector("#target-system-edit_button_assign")).toBeTruthy();
      expect(el().textContent).toContain("Prod connector");
      expect(
        el().querySelector(`#target-system-edit_button_unassign-${connectorId("c-assigned")}`),
      ).toBeTruthy();
    });

    it("renders the empty row and no remove control when nothing is assigned", async () => {
      await setup([], {}, true);

      expect(el().textContent).toContain("pamTargetSystemConnectorAssignmentsEmpty");
      expect(el().querySelector('[id^="target-system-edit_button_unassign-"]')).toBeNull();
    });

    it("marks a staged addition as not yet saved", async () => {
      const free = accessConnector({ id: connectorId("c-free"), name: "Spare connector" });
      await setup([free], {}, true);

      await component.stageAssign([optionFor(free)]);
      fixture.detectChanges();

      expect(el().textContent).toContain("pamRotationAssignmentPendingAssign");
      expect(el().querySelector(".tw-line-through")).toBeNull();
    });

    it("marks a staged removal as not yet saved, and keeps its row", async () => {
      const assigned = accessConnector({
        id: connectorId("c-assigned"),
        name: "Prod connector",
        assignedTargetSystemIds: [SYSTEM_ID],
      });
      await setup([assigned], {}, true);

      await component.stageUnassign(rowFor(assigned));
      fixture.detectChanges();

      expect(el().textContent).toContain("pamRotationAssignmentPendingUnassign");
      expect(el().querySelector(".tw-line-through")?.textContent?.trim()).toBe("Prod connector");
    });

    it("hides the picker for a manual target, which never claims a connector", async () => {
      await setup([], { method: TargetSystemMethod.Manual, kind: undefined }, true);

      expect(el().querySelector("pam-assignment-picker")).toBeNull();
      expect(el().textContent).not.toContain("pamTargetSystemConnectorAssignments");
    });

    it("puts Save and Delete in one action row, with nothing that saves on its own", async () => {
      await setup([], {}, true);

      const save = el().querySelector("#target-system-edit_button_save");
      const remove = el().querySelector("#target-system-edit_button_delete");
      expect(save).toBeTruthy();
      expect(remove).toBeTruthy();
      // One row, Save first and Delete pushed to the far end.
      expect(save!.parentElement).toBe(remove!.parentElement);
      const order = save!.compareDocumentPosition(remove!);
      expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(remove!.className).toContain("tw-ms-auto");
      expect(el().querySelector("#target-system-edit_button_deactivate")).toBeNull();
      expect(el().querySelector("#target-system-edit_button_activate")).toBeNull();
    });
  });
});

/**
 * The setup hint names the steps a target has not had done yet.
 */
describe("TargetSystemEditComponent — outstanding setup hint", () => {
  const SYSTEM_ID = sysId("sys-1");
  const CONNECTOR_STEP = "pamTargetSystemSetupGuidanceAutomaticConnector";
  const CREDENTIAL_STEP = "pamTargetSystemSetupGuidanceCredential";

  /** The component's protected surface, as these tests read it. */
  type HintComp = {
    outstandingSetupSteps: () => readonly string[];
    stageAssign: (selected: SelectItemView[]) => Promise<readonly string[]>;
  };

  type SetupOptions = {
    connectors?: AccessConnector[];
    configs?: RotationConfig[];
    system?: Partial<TargetSystem>;
    /** Leave the configs read in flight, to look at the page before it has an answer. */
    holdConfigs?: boolean;
    connectorsFail?: boolean;
    configsFail?: boolean;
    render?: boolean;
  };

  let fixture: ComponentFixture<TargetSystemEditComponent>;
  let component: HintComp;
  let rotationSdk: ReturnType<typeof mock<RotationSdkService>>;

  /** A connector already assigned to this target. */
  function assignedConnector(): AccessConnector {
    return accessConnector({
      id: connectorId("c-assigned"),
      name: "Prod connector",
      assignedTargetSystemIds: [SYSTEM_ID],
    });
  }

  /** A managed credential naming this target. */
  function credentialHere(): RotationConfig {
    return rotationConfig({ targetSystemId: SYSTEM_ID });
  }

  async function setup(options: SetupOptions = {}): Promise<void> {
    TestBed.resetTestingModule();
    rotationSdk = mock<RotationSdkService>();
    rotationSdk.listTargetSystems.mockResolvedValue([
      makeSystem({ id: SYSTEM_ID, ...options.system }),
    ]);

    if (options.connectorsFail) {
      rotationSdk.listConnectors.mockRejectedValue(new Error("unreachable"));
    } else {
      rotationSdk.listConnectors.mockResolvedValue(options.connectors ?? []);
    }

    if (options.holdConfigs) {
      rotationSdk.listConfigs.mockReturnValue(new Promise<RotationConfig[]>(() => {}));
    } else if (options.configsFail) {
      rotationSdk.listConfigs.mockRejectedValue(new Error("unreachable"));
    } else {
      rotationSdk.listConfigs.mockResolvedValue(options.configs ?? []);
    }

    if (!options.render) {
      TestBed.overrideComponent(TargetSystemEditComponent, { set: { template: "" } });
    }
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
          useValue: { snapshot: { params: { organizationId: ORG_ID, targetSystemId: SYSTEM_ID } } },
        },
      ],
    }).compileComponents();
    jest.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);
    fixture = TestBed.createComponent(TargetSystemEditComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    component = fixture.componentInstance as unknown as HintComp;
  }

  it("names both steps when nothing has been set up", async () => {
    await setup();

    expect(component.outstandingSetupSteps()).toEqual([CONNECTOR_STEP, CREDENTIAL_STEP]);
  });

  it("names only the credential once a connector is assigned", async () => {
    await setup({ connectors: [assignedConnector()] });

    expect(component.outstandingSetupSteps()).toEqual([CREDENTIAL_STEP]);
  });

  it("names only the connector once a credential exists", async () => {
    await setup({ configs: [credentialHere()] });

    expect(component.outstandingSetupSteps()).toEqual([CONNECTOR_STEP]);
  });

  it("names nothing once both steps are done", async () => {
    await setup({ connectors: [assignedConnector()], configs: [credentialHere()] });

    expect(component.outstandingSetupSteps()).toEqual([]);
  });

  it("ignores a credential that names a different target", async () => {
    await setup({ configs: [rotationConfig({ targetSystemId: sysId("other") })] });

    expect(component.outstandingSetupSteps()).toContain(CREDENTIAL_STEP);
  });

  it("matches a credential whose target id differs only in case", async () => {
    const upper = uuidAsString(SYSTEM_ID).toUpperCase() as unknown as TargetSystemId;
    await setup({ configs: [rotationConfig({ targetSystemId: upper })] });

    expect(component.outstandingSetupSteps()).not.toContain(CREDENTIAL_STEP);
  });

  it("never names the connector step for a manual target, which has no connector to assign", async () => {
    await setup({ system: { method: TargetSystemMethod.Manual, kind: undefined } });

    expect(component.outstandingSetupSteps()).toEqual([CREDENTIAL_STEP]);
  });

  it("names nothing for a manual target that already has its credential", async () => {
    await setup({
      system: { method: TargetSystemMethod.Manual, kind: undefined },
      configs: [credentialHere()],
    });

    expect(component.outstandingSetupSteps()).toEqual([]);
  });

  it("says nothing while the credentials read is still in flight", async () => {
    await setup({ holdConfigs: true });

    expect(component.outstandingSetupSteps()).toEqual([]);
  });

  it("does not claim the connector step when the connectors could not be read", async () => {
    await setup({ connectorsFail: true });

    expect(component.outstandingSetupSteps()).toEqual([CREDENTIAL_STEP]);
  });

  it("does not claim the credential step when the credentials could not be read", async () => {
    await setup({ configsFail: true });

    expect(component.outstandingSetupSteps()).toEqual([CONNECTOR_STEP]);
  });

  it("says nothing for a target that is out of service, which can act on neither step", async () => {
    await setup({ system: { status: TargetSystemStatus.Disabled } });

    expect(component.outstandingSetupSteps()).toEqual([]);
  });

  it("drops the connector step as soon as one is staged, before the save lands", async () => {
    const free = accessConnector({ id: connectorId("c-free"), name: "Spare connector" });
    await setup({ connectors: [free] });
    expect(component.outstandingSetupSteps()).toContain(CONNECTOR_STEP);

    await component.stageAssign([
      { id: String(free.id), listName: free.name, labelName: free.name },
    ]);

    expect(component.outstandingSetupSteps()).toEqual([CREDENTIAL_STEP]);
  });

  it("reads the credentials without holding the page shut", async () => {
    await setup({ holdConfigs: true, render: true });

    expect((fixture.componentInstance as unknown as { loading: () => boolean }).loading()).toBe(
      false,
    );
    expect(
      (fixture.nativeElement as HTMLElement).querySelector("#target-system-edit_input_name"),
    ).toBeTruthy();
  });

  describe("rendered", () => {
    function el(): HTMLElement {
      return fixture.nativeElement as HTMLElement;
    }

    function callout(): HTMLElement | null {
      return el().querySelector("#target-system-edit_callout_setup-guidance");
    }

    it("lists both steps in order when neither is done", async () => {
      await setup({ render: true });

      const items = callout()!.querySelectorAll("li");
      expect(Array.from(items).map((li) => li.textContent!.trim())).toEqual([
        CONNECTOR_STEP,
        CREDENTIAL_STEP,
      ]);
    });

    it("renders a single step as one line with no list", async () => {
      await setup({ connectors: [assignedConnector()], render: true });

      expect(callout()!.querySelectorAll("li").length).toBe(0);
      expect(callout()!.textContent).toContain(CREDENTIAL_STEP);
      expect(callout()!.textContent).not.toContain(CONNECTOR_STEP);
    });

    it("carries no visible title, so one short line does not sit under a heading", async () => {
      await setup({ connectors: [assignedConnector()], render: true });

      expect(callout()!.querySelector("header")).toBeNull();
    });

    it("stays a low-emphasis hint rather than an alert", async () => {
      await setup({ render: true });

      const debugCallout = fixture.debugElement.query(By.directive(CalloutComponent));
      expect((debugCallout.componentInstance as CalloutComponent).type()).toBe("subtle");
    });

    it("names the hint for assistive technology even without a visible title", async () => {
      await setup({ render: true });

      expect(callout()!.querySelector("aside")!.getAttribute("aria-label")).toBe(
        "pamTargetSystemSetupGuidanceTitle",
      );
    });

    it("renders no hint at all once rotation is set up", async () => {
      await setup({
        connectors: [assignedConnector()],
        configs: [credentialHere()],
        render: true,
      });

      expect(callout()).toBeNull();
      expect(el().textContent).not.toContain("pamTargetSystemSetupGuidance");
    });

    it("renders no hint while the credentials read is in flight", async () => {
      await setup({ holdConfigs: true, render: true });

      expect(callout()).toBeNull();
    });

    it("does not block the save button", async () => {
      await setup({ render: true });

      const save = el().querySelector("#target-system-edit_button_save") as HTMLButtonElement;
      expect(save).toBeTruthy();
      expect(save.disabled).toBe(false);
    });
  });
});

describe("TargetSystemEditComponent — loading skeleton", () => {
  const SYSTEM_ID = sysId("sys-1");

  let fixture: ComponentFixture<TargetSystemEditComponent>;
  let rotationSdk: ReturnType<typeof mock<RotationSdkService>>;

  const el = () => fixture.nativeElement as HTMLElement;

  afterEach(() => jest.useRealTimers());

  /**
   * Runs the placeholder's clock on.
   */
  function advance(ms: number): void {
    fixture.detectChanges();
    jest.advanceTimersByTime(ms);
    fixture.detectChanges();
  }

  /**
   * Renders the page with the target system read still in flight.
   */
  async function renderLoading({ editing = true } = {}) {
    TestBed.resetTestingModule();
    jest.useFakeTimers({ doNotFake: ["nextTick", "queueMicrotask", "setImmediate"] });
    rotationSdk = mock<RotationSdkService>();
    rotationSdk.listTargetSystems.mockResolvedValue([makeSystem({ id: SYSTEM_ID })]);
    rotationSdk.listConnectors.mockResolvedValue([]);
    rotationSdk.listConfigs.mockResolvedValue([]);

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
            snapshot: {
              params: {
                organizationId: ORG_ID,
                ...(editing ? { targetSystemId: SYSTEM_ID } : {}),
              },
            },
          },
        },
      ],
    }).compileComponents();

    jest.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);
    fixture = TestBed.createComponent(TargetSystemEditComponent);
    fixture.detectChanges();
  }

  /** Renders the page mid-load with its placeholder already drawn. */
  async function renderSkeleton({ editing = true } = {}) {
    await renderLoading({ editing });
    advance(1000);
  }

  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it("stands skeleton fields in for the form, inside the real card furniture", async () => {
    await renderSkeleton();
    const loading = el().querySelector('[data-testid="target-system-edit-loading"]');

    expect(el().querySelector("bit-spinner")).toBeNull();
    expect(loading).not.toBeNull();
    expect(loading!.querySelector("bit-skeleton")).not.toBeNull();
    expect(loading!.textContent).toContain("pamTargetSystemGeneralInfoHeading");
    expect(loading!.textContent).toContain("pamTargetSystemPolicyHeading");
    expect(el().querySelector("#target-system-edit_input_name")).toBeNull();
  });

  it("keeps the placeholder itself out of the accessibility tree", async () => {
    await renderLoading();

    expect(
      el().querySelector('[data-testid="target-system-edit-loading"]')!.getAttribute("aria-hidden"),
    ).toBe("true");
  });

  it("opens the create page straight onto the form, with no placeholder", async () => {
    await renderLoading({ editing: false });

    expect(el().querySelector('[data-testid="target-system-edit-loading"]')).toBeNull();
    expect(el().querySelector("#target-system-edit_input_name")).not.toBeNull();
  });

  it("announces the load from a live region, then the arrival", async () => {
    await renderSkeleton();

    const status = el().querySelector('[data-testid="rotation-loading-status"]');
    expect(status!.getAttribute("role")).toBe("status");
    expect(status!.getAttribute("aria-live")).toBe("polite");
    expect(status!.textContent).toContain("loading");

    await settle();
    advance(1000);

    expect(el().querySelector('[data-testid="rotation-loading-status"]')!.textContent).toContain(
      "pamRotationPageLoaded",
    );
  });

  it("replaces the skeleton with the real form once the target system lands", async () => {
    await renderSkeleton();

    await settle();
    advance(1000);

    expect(el().querySelector('[data-testid="target-system-edit-loading"]')).toBeNull();
    expect(el().querySelector("bit-skeleton")).toBeNull();
    expect(el().querySelector("#target-system-edit_input_name")).not.toBeNull();
  });

  it("renders the page's own chrome, not a blank area, before the delay is up", async () => {
    await renderLoading();
    advance(999);

    expect(el().querySelector('[data-testid="target-system-edit-loading"]')).not.toBeNull();
    expect(el().querySelector("bit-skeleton")).toBeNull();
    expect(el().querySelector("pam-detail-breadcrumb")).not.toBeNull();
  });

  it("never draws the placeholder for a target system that arrives inside the delay", async () => {
    await renderLoading();
    advance(500);

    await settle();
    advance(1000);

    expect(el().querySelector("bit-skeleton")).toBeNull();
    expect(el().querySelector('[data-testid="target-system-edit-loading"]')).toBeNull();
    expect(el().querySelector("#target-system-edit_input_name")).not.toBeNull();
  });

  it("holds the placeholder its minimum time once it is up, so it cannot blink", async () => {
    await renderSkeleton();
    expect(el().querySelector("bit-skeleton")).not.toBeNull();

    await settle();
    advance(300);

    expect(el().querySelector("bit-skeleton")).not.toBeNull();

    advance(700);

    expect(el().querySelector("bit-skeleton")).toBeNull();
    expect(el().querySelector("#target-system-edit_input_name")).not.toBeNull();
  });

  it("announces the load at once, not on the placeholder's clock", async () => {
    await renderLoading();

    expect(el().querySelector('[data-testid="rotation-loading-status"]')!.textContent).toContain(
      "loading",
    );
    expect(el().querySelector("bit-skeleton")).toBeNull();
  });
});

describe("TargetSystemEditComponent — load error state", () => {
  const SYSTEM_ID = sysId("sys-1");

  let fixture: ComponentFixture<TargetSystemEditComponent>;
  let rotationSdk: ReturnType<typeof mock<RotationSdkService>>;
  let toastService: ReturnType<typeof mock<ToastService>>;
  let nav: jest.SpyInstance;

  const el = () => fixture.nativeElement as HTMLElement;

  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /**
   * Renders the edit page from its own template, with the target-system read either failing or
   * answering.
   */
  async function render({ readFails = true } = {}) {
    TestBed.resetTestingModule();
    rotationSdk = mock<RotationSdkService>();
    toastService = mock<ToastService>();
    if (readFails) {
      rotationSdk.listTargetSystems.mockRejectedValue(new Error("boom"));
    } else {
      rotationSdk.listTargetSystems.mockResolvedValue([makeSystem({ id: SYSTEM_ID })]);
    }
    rotationSdk.listConnectors.mockResolvedValue([]);
    rotationSdk.listConfigs.mockResolvedValue([]);

    await TestBed.configureTestingModule({
      imports: [TargetSystemEditComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: RotationSdkService, useValue: rotationSdk },
        { provide: I18nService, useValue: i18nFake },
        { provide: ToastService, useValue: toastService },
        { provide: DialogService, useValue: mock<DialogService>() },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { params: { organizationId: ORG_ID, targetSystemId: SYSTEM_ID } },
          },
        },
      ],
    }).compileComponents();

    nav = jest.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);
    fixture = TestBed.createComponent(TargetSystemEditComponent);
    fixture.detectChanges();
    await settle();
  }

  it("stays on the page and reports the failure rather than bouncing to the list", async () => {
    await render();

    expect(el().querySelector("pam-rotation-load-error")).not.toBeNull();
    expect(el().textContent).toContain("pamRotationListLoadErrorTitle");
    expect(el().querySelector('[data-testid="target-system-edit-loading"]')).toBeNull();
    expect(el().querySelector("#target-system-edit_input_name")).toBeNull();
    expect(nav).not.toHaveBeenCalled();
    expect(toastService.showToast).not.toHaveBeenCalled();
  });

  it("does not announce a failed read as loaded", async () => {
    await render();

    expect(el().querySelector('[data-testid="rotation-loading-status"]')!.textContent?.trim()).toBe(
      "",
    );
  });

  it("re-reads the target system from the error state, and shows it once it lands", async () => {
    await render();
    rotationSdk.listTargetSystems.mockResolvedValue([makeSystem({ id: SYSTEM_ID })]);

    el().querySelector<HTMLButtonElement>("#rotation-load-error_button_retry")!.click();
    await settle();

    expect(rotationSdk.listTargetSystems).toHaveBeenCalledTimes(2);
    expect(el().querySelector("pam-rotation-load-error")).toBeNull();
    expect(el().querySelector("#target-system-edit_input_name")).not.toBeNull();
    expect(nameFormOf(fixture).getRawValue().name).toBe("Prod Entra");
  });

  it("renders the form when the read lands first time", async () => {
    await render({ readFails: false });

    expect(el().querySelector("pam-rotation-load-error")).toBeNull();
    expect(el().querySelector("#target-system-edit_input_name")).not.toBeNull();
    expect(nav).not.toHaveBeenCalled();
  });

  /**
   * The post-save re-read is a different read from the one that opens the page.
   */
  describe("re-reading after a save", () => {
    const submitEdit = () =>
      (fixture.componentInstance as unknown as { submitEdit: () => Promise<void> }).submitEdit();

    it("keeps the saved form on screen when the re-read fails, and says so", async () => {
      await render({ readFails: false });
      rotationSdk.updateTargetSystem.mockResolvedValue(undefined);
      rotationSdk.listTargetSystems.mockRejectedValue(new Error("boom"));

      await submitEdit();
      await settle();

      expect(el().querySelector("pam-rotation-load-error")).toBeNull();
      expect(el().querySelector("#target-system-edit_input_name")).not.toBeNull();
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "warning", message: "pamTargetSystemSavedNotReread" }),
      );
      expect(toastService.showToast).not.toHaveBeenCalledWith(
        expect.objectContaining({ message: "pamTargetSystemSaved" }),
      );
      expect(nameFormOf(fixture).dirty).toBe(false);
    });

    it("does not claim a save when the re-read no longer holds the target", async () => {
      await render({ readFails: false });
      rotationSdk.updateTargetSystem.mockResolvedValue(undefined);
      rotationSdk.listTargetSystems.mockResolvedValue([]);

      await submitEdit();
      await settle();

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ message: "pamTargetSystemNotFound" }),
      );
      expect(toastService.showToast).not.toHaveBeenCalledWith(
        expect.objectContaining({ message: "pamTargetSystemSaved" }),
      );
      expect(nav).toHaveBeenCalled();
    });

    it("reports the save plainly when the re-read lands", async () => {
      await render({ readFails: false });
      rotationSdk.updateTargetSystem.mockResolvedValue(undefined);

      await submitEdit();
      await settle();

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success", message: "pamTargetSystemSaved" }),
      );
    });
  });
});

/**
 * The withdrawal warning answers a live checkbox.
 */
describe("TargetSystemEditComponent — session termination withdrawal (rendered)", () => {
  const SYSTEM_ID = sysId("sys-1");

  let fixture: ComponentFixture<TargetSystemEditComponent>;

  const el = () => fixture.nativeElement as HTMLElement;

  async function render(system: Partial<TargetSystem> = {}) {
    TestBed.resetTestingModule();
    const rotationSdk = mock<RotationSdkService>();
    rotationSdk.listTargetSystems.mockResolvedValue([
      makeSystem({
        id: SYSTEM_ID,
        kind: TargetSystemKind.CustomScript,
        supportsSessionTermination: true,
        ...system,
      }),
    ]);
    rotationSdk.listConnectors.mockResolvedValue([]);
    rotationSdk.listConfigs.mockResolvedValue([]);

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
            snapshot: { params: { organizationId: ORG_ID, targetSystemId: SYSTEM_ID } },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TargetSystemEditComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function terminationCheckbox(): HTMLInputElement {
    const input = el().querySelector<HTMLInputElement>(
      "#target-system-edit_checkbox_session-termination",
    );
    expect(input).not.toBeNull();
    return input!;
  }

  it("warns once the operator unchecks a capability the target already has", async () => {
    await render();
    expect(el().textContent).not.toContain("pamTargetSystemTerminationWithdrawalWarning");

    const checkbox = terminationCheckbox();
    checkbox.click();
    fixture.detectChanges();

    expect(checkbox.checked).toBe(false);
    expect(el().textContent).toContain("pamTargetSystemTerminationWithdrawalWarning");
  });

  it("withdraws the warning again when the box is re-checked", async () => {
    await render();

    const checkbox = terminationCheckbox();
    checkbox.click();
    fixture.detectChanges();
    checkbox.click();
    fixture.detectChanges();

    expect(el().textContent).not.toContain("pamTargetSystemTerminationWithdrawalWarning");
  });

  it("says nothing for a target that never supported termination", async () => {
    await render({ supportsSessionTermination: false });

    terminationCheckbox().click();
    fixture.detectChanges();

    expect(el().textContent).not.toContain("pamTargetSystemTerminationWithdrawalWarning");
  });

  /**
   * The page names the integration through the same helper the list column uses.
   */
  describe("naming the integration", () => {
    it("names a kind it can model", async () => {
      await render({ kind: TargetSystemKind.Mssql, supportsSessionTermination: false });

      expect(el().textContent).toContain("pamTargetSystemTypeMssql");
    });

    it("leaves a kind it cannot model unnamed", async () => {
      await render({ kind: TargetSystemKind.Unknown, supportsSessionTermination: false });

      expect(el().textContent).toContain("pamTargetSystemMethodAutomatic");
      expect(el().textContent).not.toContain("pamTargetSystemTypeCustomScript");
      expect(el().textContent).not.toContain("pamTargetSystemTypeEntra");
    });
  });
});
