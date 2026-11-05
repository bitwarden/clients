import { DomPortalOutlet, TemplatePortal } from "@angular/cdk/portal";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormControl, FormGroup } from "@angular/forms";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { ActivatedRoute, Params, Router, convertToParamMap, provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { asUuid, uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import {
  CalloutComponent,
  DialogService,
  LayoutFooterService,
  SelectItemView,
  TabLinkComponent,
  ToastService,
} from "@bitwarden/components";

import { leaveThroughGuard } from "../../testing/unsaved-changes";
import { CONFIG_QUERY_PARAM, THEN_CREDENTIAL, THEN_QUERY_PARAM } from "../create-flow";
import type {
  AccessConnector,
  AccessConnectorId,
  RotationConfigView,
  TargetSystemView,
  TargetSystemId,
} from "../rotation";
import {
  AccessConnectorStatus,
  TargetSystemKind,
  TargetSystemMethod,
  TargetSystemStatus,
} from "../rotation";
import { ROTATION_TABS, rotationLink } from "../rotation-links";
import { RotationSdkService } from "../rotation-sdk.service";
import {
  accessConnector,
  configId,
  connectorId,
  ORGANIZATION_ID,
  rotationConfig,
  sysId,
  targetSystem,
  targetSystemSealedFields,
} from "../testing/rotation-builders";

import { TargetSystemEditComponent } from "./target-system-edit.component";

// JSDOM has no ResizeObserver
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(global as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;

const ORG_ID = ORGANIZATION_ID;

const i18nFake: Pick<I18nService, "t" | "translate"> = {
  t: (id: string) => id,
  translate: (id: string) => id,
};

/** Stub for the rotation shell route. */
const ROUTE_PARENT = { snapshot: { params: {} } };

/** Adds the `paramMap` the component reads its tab from, mirroring the snapshot's params. */
function withParamMap<T extends { snapshot: { params: Params } }>(route: T) {
  return { ...route, paramMap: of(convertToParamMap(route.snapshot.params)) };
}

function makeSystem(overrides: Partial<TargetSystemView> = {}): TargetSystemView {
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
      { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
      {
        provide: ActivatedRoute,
        useValue: withParamMap({
          snapshot: { params: { organizationId: ORG_ID } },
        }),
      },
    ],
  }).compileComponents();
}

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
      { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
      {
        provide: ActivatedRoute,
        useValue: withParamMap({
          snapshot: { params: { organizationId: ORG_ID }, queryParams: { template } },
        }),
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

async function setupCreateWithQueryParams(
  queryParams: Record<string, string>,
  connectors: AccessConnector[] = [],
) {
  const rotationSdk = mock<RotationSdkService>();
  rotationSdk.listConnectors.mockResolvedValue(connectors);
  TestBed.overrideComponent(TargetSystemEditComponent, { set: { template: "" } });
  await TestBed.configureTestingModule({
    imports: [TargetSystemEditComponent, NoopAnimationsModule],
    providers: [
      provideRouter([]),
      { provide: RotationSdkService, useValue: rotationSdk },
      { provide: I18nService, useValue: i18nFake },
      { provide: ToastService, useValue: mock<ToastService>() },
      { provide: DialogService, useValue: mock<DialogService>() },
      { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
      {
        provide: ActivatedRoute,
        useValue: withParamMap({
          snapshot: { params: { organizationId: ORG_ID }, queryParams },
          parent: ROUTE_PARENT,
        }),
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
      connectorsControl: { setValue: (v: SelectItemView[]) => void };
      chosenConnectors: () => AccessConnector[];
      noneChosenConnected: () => boolean;
      orgHasNoConnectors: () => boolean;
      removeChosenConnector: (id: AccessConnectorId) => void;
      submitCreate: () => Promise<void>;
      cancel: () => Promise<void>;
    },
  };
}

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
      { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
      {
        provide: ActivatedRoute,
        useValue: withParamMap({
          snapshot: { params: { organizationId: ORG_ID, targetSystemId: routeTargetSystemId } },
        }),
      },
    ],
  }).compileComponents();
}

describe("TargetSystemEditComponent: create mode", () => {
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
      makeSystem({ method: TargetSystemMethod.Manual, sealed: undefined }),
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
    expect(call![1].passwordPolicy).toBeDefined();
  });

  it("does not submit when form is invalid (empty name)", async () => {
    rotationSdk.createTargetSystem.mockResolvedValue(makeSystem());
    jest.spyOn(router, "navigate").mockResolvedValue(true);

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

  /** Mirrors `bitwarden_pam_sealed::MIN_PASSWORD_ENTROPY_BITS` (80 bits); 20 digits ≈ 66.4 bits. */
  it("marks the policy invalid when it falls below the shared strength floor", () => {
    const policyForm = policyFormOf(fixture);
    policyForm.patchValue({
      minLength: 5,
      maxLength: 20,
      includeUppercase: false,
      includeLowercase: false,
      includeDigits: true,
      includeSymbols: false,
    });

    expect(policyForm.invalid).toBe(true);
    expect(policyForm.errors?.["belowStrengthFloor"]).toBe(true);
  });

  /** The default policy (14-64, every class) is comfortably above the floor. */
  it("does not flag the default policy as too weak", () => {
    const policyForm = policyFormOf(fixture);

    expect(policyForm.errors?.["belowStrengthFloor"]).toBeFalsy();
  });

  it("clears the strength-floor error once the length is raised enough", () => {
    const policyForm = policyFormOf(fixture);
    policyForm.patchValue({
      minLength: 5,
      maxLength: 20,
      includeUppercase: false,
      includeLowercase: false,
      includeDigits: true,
      includeSymbols: false,
    });
    expect(policyForm.errors?.["belowStrengthFloor"]).toBe(true);

    policyForm.patchValue({ maxLength: 128 });

    expect(policyForm.errors?.["belowStrengthFloor"]).toBeFalsy();
  });

  it("rejects a length bound outside the generator's 5-128 range", () => {
    const policyForm = policyFormOf(fixture);
    policyForm.controls.maxLength.setValue(200);

    expect(policyForm.controls.maxLength.errors?.["max"]).toBeDefined();
  });

  it("does not create a target system when the policy is below the strength floor", async () => {
    rotationSdk.createTargetSystem.mockResolvedValue(makeSystem());
    jest.spyOn(router, "navigate").mockResolvedValue(true);

    const comp = fixture.componentInstance as unknown as {
      createForm: { patchValue: (v: unknown) => void };
      submitCreate: () => Promise<void>;
    };
    comp.createForm.patchValue({
      name: "Weak policy",
      method: TargetSystemMethod.Automatic,
      kind: TargetSystemKind.Entra,
    });
    policyFormOf(fixture).patchValue({
      minLength: 5,
      maxLength: 20,
      includeUppercase: false,
      includeLowercase: false,
      includeDigits: true,
      includeSymbols: false,
    });
    await comp.submitCreate();

    expect(rotationSdk.createTargetSystem).not.toHaveBeenCalled();
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

  it("seeds Automatic + Active Directory from the ?template=active-directory query param", async () => {
    TestBed.resetTestingModule();
    const comp = await setupCreateWithTemplate("active-directory");
    const value = comp.createForm.getRawValue();

    expect(value.method).toBe(TargetSystemMethod.Automatic);
    expect(value.kind).toBe(TargetSystemKind.ActiveDirectory);
  });

  /** The managed-credential create page sends operators here when no target fits. */
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

    await expect(leaveThroughGuard(fixture.componentInstance)).resolves.toBe(true);
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

    expect(nav).toHaveBeenCalledWith(rotationLink(ORG_ID, ROTATION_TABS.targetSystems));
  });

  it("toasts 'Target system added' when handing back to the credential page", async () => {
    TestBed.resetTestingModule();
    const { component, rotationSdk, router } = await setupCreateWithQueryParams({
      then: "managed-credential",
    });
    rotationSdk.createTargetSystem.mockResolvedValue(makeSystem());
    jest.spyOn(router, "navigate").mockResolvedValue(true);
    const toastService = TestBed.inject(ToastService);

    component.createForm.patchValue({ name: "Manual System", method: TargetSystemMethod.Manual });
    await component.submitCreate();

    expect(toastService.showToast).toHaveBeenCalledWith({
      variant: "success",
      message: "pamTargetSystemAddedSuccess",
    });
  });

  it("uses the pamTargetSystemCreatedSuccess toast for a plain create", async () => {
    TestBed.resetTestingModule();
    const { component, rotationSdk, router } = await setupCreateWithQueryParams({});
    rotationSdk.createTargetSystem.mockResolvedValue(makeSystem());
    jest.spyOn(router, "navigate").mockResolvedValue(true);
    const toastService = TestBed.inject(ToastService);

    component.createForm.patchValue({ name: "Manual System", method: TargetSystemMethod.Manual });
    await component.submitCreate();

    expect(toastService.showToast).toHaveBeenCalledWith({
      variant: "success",
      message: "pamTargetSystemCreatedSuccess",
    });
  });

  it("returns Cancel to the credential create page without asking to discard", async () => {
    TestBed.resetTestingModule();
    const { fixture, component, router } = await setupCreateWithQueryParams({
      then: "managed-credential",
    });
    const nav = jest.spyOn(router, "navigate").mockResolvedValue(true);
    const dialogService = TestBed.inject(DialogService);

    component.createForm.patchValue({ name: "Half typed" });
    createFormOf(fixture).markAsDirty();
    await component.cancel();

    expect(nav).toHaveBeenCalledWith([
      "/organizations",
      ORG_ID,
      "pam",
      "rotation",
      "managed-credentials",
      "new",
    ]);
    await expect(leaveThroughGuard(fixture.componentInstance)).resolves.toBe(true);
    expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
  });

  it("sends Cancel to the list when there is no ?then", async () => {
    TestBed.resetTestingModule();
    const { component, router } = await setupCreateWithQueryParams({});
    const nav = jest.spyOn(router, "navigate").mockResolvedValue(true);

    await component.cancel();

    expect(nav).toHaveBeenCalledWith(rotationLink(ORG_ID, ROTATION_TABS.targetSystems));
  });

  describe("choosing access connectors on create", () => {
    const connectedConnector = accessConnector({
      id: connectorId("c-1"),
      name: "Primary",
      isConnected: true,
    });
    const offlineConnector = accessConnector({
      id: connectorId("c-2"),
      name: "Backup",
      isConnected: false,
    });
    const inactiveConnector = accessConnector({
      id: connectorId("c-3"),
      name: "Retired",
      status: AccessConnectorStatus.Disabled,
    });

    function pick(...connectors: AccessConnector[]): SelectItemView[] {
      return connectors.map((c) => ({
        id: String(c.id),
        listName: c.name,
        labelName: c.name,
      }));
    }

    it("lists the chosen connectors and warns only while none of them is connected", async () => {
      TestBed.resetTestingModule();
      const { component } = await setupCreateWithQueryParams({}, [
        connectedConnector,
        offlineConnector,
      ]);

      component.connectorsControl.setValue(pick(offlineConnector));
      expect(component.chosenConnectors().map((c) => c.name)).toEqual(["Backup"]);
      expect(component.noneChosenConnected()).toBe(true);

      component.connectorsControl.setValue(pick(offlineConnector, connectedConnector));
      expect(component.chosenConnectors().map((c) => c.name)).toEqual(["Backup", "Primary"]);
      expect(component.noneChosenConnected()).toBe(false);
    });

    it("removes a connector from the selection from its row", async () => {
      TestBed.resetTestingModule();
      const { component } = await setupCreateWithQueryParams({}, [
        connectedConnector,
        offlineConnector,
      ]);
      component.connectorsControl.setValue(pick(connectedConnector, offlineConnector));

      component.removeChosenConnector(offlineConnector.id);

      expect(component.chosenConnectors().map((c) => c.name)).toEqual(["Primary"]);
    });

    it("reports an org with no connectors, and not one that only has inactive ones", async () => {
      TestBed.resetTestingModule();
      const empty = await setupCreateWithQueryParams({}, []);
      expect(empty.component.orgHasNoConnectors()).toBe(true);

      TestBed.resetTestingModule();
      const inactiveOnly = await setupCreateWithQueryParams({}, [inactiveConnector]);
      expect(inactiveOnly.component.orgHasNoConnectors()).toBe(false);
    });

    it("assigns each chosen connector to the new target after creating it", async () => {
      TestBed.resetTestingModule();
      const created = makeSystem({ id: sysId("sys-new") });
      const { component, rotationSdk, router } = await setupCreateWithQueryParams({}, [
        connectedConnector,
        offlineConnector,
      ]);
      rotationSdk.createTargetSystem.mockResolvedValue(created);
      jest.spyOn(router, "navigate").mockResolvedValue(true);
      component.createForm.patchValue({
        name: "Entra",
        method: TargetSystemMethod.Automatic,
        kind: TargetSystemKind.Entra,
      });
      component.connectorsControl.setValue(pick(connectedConnector, offlineConnector));

      await component.submitCreate();

      expect(rotationSdk.assignTarget).toHaveBeenCalledTimes(2);
      expect(rotationSdk.assignTarget).toHaveBeenCalledWith(
        ORG_ID,
        connectedConnector.id,
        created.id,
      );
      expect(rotationSdk.assignTarget).toHaveBeenCalledWith(
        ORG_ID,
        offlineConnector.id,
        created.id,
      );
    });

    it("assigns nothing for a manual target", async () => {
      TestBed.resetTestingModule();
      const { component, rotationSdk, router } = await setupCreateWithQueryParams({}, [
        connectedConnector,
      ]);
      rotationSdk.createTargetSystem.mockResolvedValue(makeSystem());
      jest.spyOn(router, "navigate").mockResolvedValue(true);
      component.createForm.patchValue({ name: "Manual", method: TargetSystemMethod.Manual });
      component.connectorsControl.setValue(pick(connectedConnector));

      await component.submitCreate();

      expect(rotationSdk.assignTarget).not.toHaveBeenCalled();
    });

    it("opens the created target's edit page and reports the error when an assignment fails", async () => {
      TestBed.resetTestingModule();
      const created = makeSystem({ id: sysId("sys-new") });
      const { component, rotationSdk, router } = await setupCreateWithQueryParams(
        { then: "managed-credential" },
        [connectedConnector],
      );
      rotationSdk.createTargetSystem.mockResolvedValue(created);
      rotationSdk.assignTarget.mockRejectedValue(new Error("refused"));
      const nav = jest.spyOn(router, "navigate").mockResolvedValue(true);
      const toastService = TestBed.inject(ToastService);
      component.createForm.patchValue({
        name: "Entra",
        method: TargetSystemMethod.Automatic,
        kind: TargetSystemKind.Entra,
      });
      component.connectorsControl.setValue(pick(connectedConnector));

      await component.submitCreate();

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
      expect(nav).toHaveBeenCalledWith(
        ["target-systems", created.id],
        expect.objectContaining({ relativeTo: ROUTE_PARENT }),
      );
    });
  });

  /**
   * Two-phase create can leave the row in `pending_seal`; `TargetSystemCreateError` carries its
   * id, so this routes to the pending target's edit page instead of a stuck create form.
   */
  it("routes to the pending target's edit page on a partial create failure", async () => {
    TestBed.resetTestingModule();
    const { component, rotationSdk, router } = await setupCreateWithQueryParams({});
    const pendingId = sysId("sys-pending");
    rotationSdk.createTargetSystem.mockRejectedValue({
      id: pendingId,
      message: "Sealing failed",
    });
    const nav = jest.spyOn(router, "navigate").mockResolvedValue(true);

    component.createForm.patchValue({
      name: "Prod Entra",
      method: TargetSystemMethod.Automatic,
      kind: TargetSystemKind.Entra,
    });
    await component.submitCreate();

    expect(nav).toHaveBeenCalledWith(
      ["target-systems", pendingId],
      expect.objectContaining({ relativeTo: ROUTE_PARENT }),
    );
  });

  it("shows a distinct toast for a partial create failure, not the generic error", async () => {
    TestBed.resetTestingModule();
    const { component, rotationSdk, router } = await setupCreateWithQueryParams({});
    rotationSdk.createTargetSystem.mockRejectedValue({ id: sysId("sys-pending"), message: "boom" });
    jest.spyOn(router, "navigate").mockResolvedValue(true);
    const toast = TestBed.inject(ToastService);

    component.createForm.patchValue({
      name: "Prod Entra",
      method: TargetSystemMethod.Automatic,
      kind: TargetSystemKind.Entra,
    });
    await component.submitCreate();

    expect(toast.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "warning",
        message: "pamTargetSystemCreatePartialFailure",
      }),
    );
  });

  it("does not route anywhere for an ordinary create failure", async () => {
    TestBed.resetTestingModule();
    const { component, rotationSdk, router } = await setupCreateWithQueryParams({});
    rotationSdk.createTargetSystem.mockRejectedValue(new Error("network fail"));
    const nav = jest.spyOn(router, "navigate").mockResolvedValue(true);

    component.createForm.patchValue({
      name: "Prod Entra",
      method: TargetSystemMethod.Automatic,
      kind: TargetSystemKind.Entra,
    });
    await component.submitCreate();

    expect(nav).not.toHaveBeenCalled();
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
    // The checkbox stays false; a native integration must still report supported.
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

  it("submits supportsSessionTermination=false for Active Directory even when the control is checked", async () => {
    rotationSdk.createTargetSystem.mockResolvedValue(makeSystem());
    jest.spyOn(router, "navigate").mockResolvedValue(true);

    const comp = fixture.componentInstance as unknown as {
      createForm: { patchValue: (v: unknown) => void };
      policyForm: { patchValue: (v: unknown) => void };
      submitCreate: () => Promise<void>;
    };
    comp.createForm.patchValue({
      name: "Corp DC",
      method: TargetSystemMethod.Automatic,
      kind: TargetSystemKind.ActiveDirectory,
    });
    comp.policyForm.patchValue({
      minLength: 14,
      maxLength: 64,
      includeUppercase: true,
      includeLowercase: true,
      includeDigits: true,
      includeSymbols: true,
      supportsSessionTermination: true,
    });
    fixture.detectChanges();
    await comp.submitCreate();

    const request = rotationSdk.createTargetSystem.mock.calls[0]![1];
    expect(request.method).toBe("automatic");
    expect(request).toMatchObject({ supportsSessionTermination: false });
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

  it("sends the policy and no integration fields for a manual target", async () => {
    rotationSdk.createTargetSystem.mockResolvedValue(makeSystem());
    jest.spyOn(router, "navigate").mockResolvedValue(true);

    const comp = fixture.componentInstance as unknown as {
      createForm: { patchValue: (v: unknown) => void };
      policyForm: { patchValue: (v: unknown) => void };
      submitCreate: () => Promise<void>;
    };
    comp.createForm.patchValue({ name: "Legacy mainframe", method: TargetSystemMethod.Manual });
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
    expect(request.method).toBe("manual");
    expect(request).toMatchObject({ passwordPolicy: expect.objectContaining({ minLength: 14 }) });
    expect(request).not.toHaveProperty("kind");
    expect(request).not.toHaveProperty("supportsSessionTermination");
  });

  it("surfaces the server's sentence when the SDK wraps an error response", async () => {
    rotationSdk.createTargetSystem.mockRejectedValue(
      new Error(
        'error in response: status code 400 Bad Request: {"message":"Name is required.","object":"error"}',
      ),
    );
    jest.spyOn(router, "navigate").mockResolvedValue(true);

    const comp = fixture.componentInstance as unknown as {
      createForm: { patchValue: (v: unknown) => void };
      policyForm: { patchValue: (v: unknown) => void };
      submitCreate: () => Promise<void>;
    };
    comp.createForm.patchValue({ name: "My System", method: TargetSystemMethod.Manual });
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
      expect.objectContaining({ variant: "error", message: "Name is required." }),
    );
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

describe("TargetSystemEditComponent: create mode (rendered)", () => {
  let fixture: ComponentFixture<TargetSystemEditComponent>;
  let rotationSdk: ReturnType<typeof mock<RotationSdkService>>;

  beforeEach(async () => {
    rotationSdk = mock<RotationSdkService>();
    await TestBed.configureTestingModule({
      imports: [TargetSystemEditComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: RotationSdkService, useValue: rotationSdk },
        { provide: I18nService, useValue: i18nFake },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        {
          provide: ActivatedRoute,
          useValue: withParamMap({
            snapshot: { params: { organizationId: ORG_ID }, queryParams: {} },
          }),
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

  it("says nothing about a system id, which a target does not have until it is saved", () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="target-system-edit-system-id"]')).toBeNull();
  });

  it("renders a consequence hint under each method radio", () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector("#target-system-edit_radio_automatic bit-hint")?.textContent).toContain(
      "pamTargetSystemMethodAutomaticDescription",
    );
    expect(el.querySelector("#target-system-edit_radio_manual bit-hint")?.textContent).toContain(
      "pamTargetSystemMethodManualDescription",
    );
  });

  it("shows the Integration (kind) select only for the Automatic method", () => {
    const el = fixture.nativeElement as HTMLElement;
    // Automatic is the default.
    expect(el.querySelector("#target-system-edit_select_kind")).toBeTruthy();

    patchMethod(TargetSystemMethod.Manual);
    expect(el.querySelector("#target-system-edit_select_kind")).toBeNull();

    patchMethod(TargetSystemMethod.Automatic);
    expect(el.querySelector("#target-system-edit_select_kind")).toBeTruthy();
  });

  it("puts system type, ending sessions and access connectors in the General information card", () => {
    const el = fixture.nativeElement as HTMLElement;
    const headings = [...el.querySelectorAll("h2")].map((h) => h.textContent?.trim());
    expect(headings).toEqual(["pamTargetSystemGeneralInfoHeading", "pamTargetSystemPolicyHeading"]);

    const card = el.querySelector("bit-card")!;
    const labels = [...card.querySelectorAll("bit-label, [data-testid] p")].map((l) =>
      l.textContent?.trim(),
    );
    expect(labels).toEqual(
      expect.arrayContaining([
        "name",
        "pamTargetSystemMethodLabel",
        "pamTargetSystemSystemTypeLabel",
        "pamTargetSystemEndingSessions",
        "pamTargetSystemAccessConnectors",
      ]),
    );
  });

  it("drops system type, ending sessions and access connectors for a manual target", () => {
    patchMethod(TargetSystemMethod.Manual);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).not.toContain("pamTargetSystemSystemTypeLabel");
    expect(el.textContent).not.toContain("pamTargetSystemEndingSessions");
    expect(el.textContent).not.toContain("pamTargetSystemAccessConnectors");
    expect(el.textContent).toContain("pamTargetSystemPolicyHeading");
    expect(el.textContent).not.toContain("pamTargetSystemPolicyManualHint");
  });

  it("starts with no system type chosen and says when ending sessions will show", () => {
    const el = fixture.nativeElement as HTMLElement;
    const block = el.querySelector('[data-testid="target-system-edit-ending-sessions"]')!;
    expect(block.textContent).toContain("pamTargetSystemEndingSessionsUnsetHint");
    expect(block.textContent).not.toContain("pamTargetSystemSessionTerminationSupported");
  });

  it("shows Not supported for a custom script, with no session-termination checkbox", () => {
    patchKind(TargetSystemKind.CustomScript);
    const el = fixture.nativeElement as HTMLElement;
    const block = el.querySelector('[data-testid="target-system-edit-ending-sessions"]')!;
    expect(block.textContent).toContain("pamTargetSystemSessionTerminationNo");
    expect(block.textContent).toContain("pamTargetSystemEndingSessionsCustomScriptHint");
    expect(el.querySelector("#target-system-edit_checkbox_session-termination")).toBeNull();
  });

  it("shows Supported and the Entra helper for Entra, with no session-termination checkbox", () => {
    patchKind(TargetSystemKind.Entra);
    const el = fixture.nativeElement as HTMLElement;
    const block = el.querySelector('[data-testid="target-system-edit-ending-sessions"]')!;
    expect(block.textContent).toContain("pamTargetSystemSessionTerminationSupported");
    expect(block.textContent).toContain("pamTargetSystemEndingSessionsEntraHint");
    expect(el.querySelector("#target-system-edit_checkbox_session-termination")).toBeNull();
  });

  it("groups the password policy characters under one label with the short option names", () => {
    const el = fixture.nativeElement as HTMLElement;
    const legend = [...el.querySelectorAll("legend")].find((l) =>
      l.textContent?.includes("pamTargetSystemPolicyCharacters"),
    );
    expect(legend).toBeDefined();
    const labels = [...legend!.closest("fieldset")!.querySelectorAll("bit-label")].map((l) =>
      l.textContent?.trim(),
    );
    expect(labels).toEqual([
      "pamTargetSystemPolicyUppercaseLetters",
      "pamTargetSystemPolicyLowercaseLetters",
      "pamTargetSystemPolicyDigitsOption",
      "pamTargetSystemPolicySymbolsOption",
    ]);
  });

  it("offers Entra and a custom script as the only integrations", () => {
    const { kindOptions } = fixture.componentInstance as unknown as {
      kindOptions: readonly { label: string }[];
    };
    expect(kindOptions.map((o) => o.label)).toEqual([
      "pamTargetSystemTypeEntra",
      "pamTargetSystemTypeActiveDirectory",
      "pamTargetSystemTypeCustomScript",
    ]);
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
    patchKind(TargetSystemKind.Entra);
    expect(el.querySelector("#target-system-edit_checkbox_session-termination")).toBeNull();
  });

  it("offers no session termination at all for Active Directory", () => {
    const el = fixture.nativeElement as HTMLElement;
    patchKind(TargetSystemKind.ActiveDirectory);

    expect(el.querySelector("#target-system-edit_checkbox_session-termination")).toBeNull();
    expect(el.querySelector("#target-system-edit_session-termination-unsupported")).toBeTruthy();
  });

  it("keeps the not-supported notice off a kind that does terminate sessions", () => {
    const el = fixture.nativeElement as HTMLElement;
    patchKind(TargetSystemKind.Entra);

    expect(el.querySelector("#target-system-edit_session-termination-unsupported")).toBeNull();
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

  it("marks the Target systems crumb with the target system icon", () => {
    const crumbs = (fixture.nativeElement as HTMLElement).querySelector("pam-detail-breadcrumb")!;
    expect(crumbs.querySelector("bit-icon.bwi-target-system")).not.toBeNull();
  });

  it("leaves the disabled picker blank when the organization has no access connectors", () => {
    const el = fixture.nativeElement as HTMLElement;
    const picker = el.querySelector("#target-system-edit_multi-select_connectors")!;

    expect(el.querySelector("#target-system-edit_callout_no-connectors")).not.toBeNull();
    expect(picker.textContent).not.toContain("pamTargetSystemAccessConnectorsPlaceholder");
    fixture.detectChanges();
    expect(picker.querySelector("ng-select")!.classList).toContain("ng-select-disabled");
  });

  it("prompts for a choice once the organization has an access connector", async () => {
    rotationSdk.listConnectors.mockResolvedValue([accessConnector({ name: "East datacenter" })]);
    const withConnector = TestBed.createComponent(TargetSystemEditComponent);
    withConnector.detectChanges();
    await withConnector.whenStable();
    withConnector.detectChanges();

    const picker = (withConnector.nativeElement as HTMLElement).querySelector(
      "#target-system-edit_multi-select_connectors",
    )!;
    expect(picker.textContent).toContain("pamTargetSystemAccessConnectorsPlaceholder");
    expect(picker.querySelector("ng-select")!.classList).not.toContain("ng-select-disabled");
  });

  describe("the pinned Save bar", () => {
    const footerPortal = () => TestBed.inject(LayoutFooterService).portal();

    function typeName(name: string): void {
      const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
        "#target-system-edit_input_name",
      )!;
      input.value = name;
      input.dispatchEvent(new Event("input"));
      fixture.detectChanges();
      TestBed.flushEffects();
    }

    it("has no Save or Cancel before anything is entered", () => {
      expect(footerPortal()).toBeUndefined();
      expect(fixture.nativeElement.querySelector("#target-system-edit_button_save")).toBeNull();
    });

    it("pins Save and Cancel once there is input, and creates from there", async () => {
      rotationSdk.createTargetSystem.mockResolvedValue(
        targetSystem({ method: TargetSystemMethod.Manual }),
      );
      jest.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);
      patchMethod(TargetSystemMethod.Manual);
      typeName("HR Payroll DB");

      const host = document.createElement("div");
      document.body.appendChild(host);
      const outlet = new DomPortalOutlet(host);
      outlet.attach(footerPortal() as TemplatePortal);
      expect(host.querySelector("#target-system-edit_button_cancel")).toBeTruthy();
      expect(host.querySelector("#target-system-edit_button_delete-footer")).toBeNull();

      host.querySelector<HTMLButtonElement>("#target-system-edit_button_save")!.click();
      await fixture.whenStable();
      outlet.dispose();
      host.remove();

      expect(rotationSdk.createTargetSystem).toHaveBeenCalledWith(
        ORG_ID,
        expect.objectContaining({ method: "manual", name: "HR Payroll DB" }),
      );
    });
  });
});

describe("TargetSystemEditComponent: edit mode", () => {
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

  it("titleText is the target's own name once loaded", () => {
    const comp = fixture.componentInstance as unknown as { titleText: () => string };
    expect(comp.titleText()).toBe(makeSystem().name);
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

    // The server takes the name, policy and capability in one write.
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

  /**
   * `updateTargetSystem` replaces the blob wholesale, so `method`/`kind` must be resupplied from
   * `existing.sealed`, not a form control, both are read-only on this page.
   */
  it("resends the stored method and kind, unedited, for an automatic target", async () => {
    rotationSdk.updateTargetSystem.mockResolvedValue(undefined);

    const comp = fixture.componentInstance as unknown as {
      nameForm: { patchValue: (v: unknown) => void };
      submitEdit: () => Promise<void>;
    };
    comp.nameForm.patchValue({ name: "Renamed" });
    await comp.submitEdit();

    expect(rotationSdk.updateTargetSystem).toHaveBeenCalledWith(
      ORG_ID,
      sysId("sys-1"),
      expect.objectContaining({ method: "automatic", kind: TargetSystemKind.Entra }),
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

  it("saves the password policy for a Manual system (no session termination)", async () => {
    TestBed.resetTestingModule();
    const rotationApiManual = mock<RotationSdkService>();
    const manual = makeSystem({
      method: TargetSystemMethod.Manual,
      sealed: undefined,
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
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        {
          provide: ActivatedRoute,
          useValue: withParamMap({
            snapshot: { params: { organizationId: ORG_ID, targetSystemId: sysId("sys-1") } },
          }),
        },
      ],
    }).compileComponents();
    const fx = TestBed.createComponent(TargetSystemEditComponent);
    fx.detectChanges();
    await fx.whenStable();
    fx.detectChanges();

    await (fx.componentInstance as unknown as { submitEdit: () => Promise<void> }).submitEdit();

    // A manual target's update request carries neither `supportsSessionTermination` nor `kind`.
    expect(rotationApiManual.updateTargetSystem).toHaveBeenCalledWith(
      ORG_ID,
      sysId("sys-1"),
      expect.objectContaining({
        method: "manual",
        passwordPolicy: expect.any(Object),
      }),
    );
    const [, , request] = rotationApiManual.updateTargetSystem.mock.calls[0];
    expect(request).not.toHaveProperty("supportsSessionTermination");
    expect(request).not.toHaveProperty("kind");
  });

  it("navigates back when not found", async () => {
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
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        {
          provide: ActivatedRoute,
          useValue: withParamMap({
            snapshot: { params: { organizationId: ORG_ID, targetSystemId: sysId("missing-id") } },
          }),
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

  async function buildEditFixture(
    system: TargetSystemView,
  ): Promise<
    [ComponentFixture<TargetSystemEditComponent>, ReturnType<typeof mock<RotationSdkService>>]
  > {
    TestBed.resetTestingModule();
    const sdk = mock<RotationSdkService>();
    sdk.listTargetSystems.mockResolvedValue([system]);
    sdk.updateTargetSystem.mockResolvedValue(undefined);
    await setupEdit(sdk);
    const fx = TestBed.createComponent(TargetSystemEditComponent);
    fx.detectChanges();
    await fx.whenStable();
    fx.detectChanges();
    return [fx, sdk];
  }

  it("keeps a stored session-termination capability the form cannot express", async () => {
    const [fx, sdk] = await buildEditFixture(
      makeSystem({
        sealed: targetSystemSealedFields({
          kind: TargetSystemKind.Unknown,
          supportsSessionTermination: true,
        }),
      }),
    );
    const comp = fx.componentInstance as unknown as {
      nameForm: { patchValue: (v: unknown) => void };
      showRetainedTermination: () => boolean;
      submitEdit: () => Promise<void>;
    };

    comp.nameForm.patchValue({ name: "Renamed" });
    await comp.submitEdit();

    expect(sdk.updateTargetSystem).toHaveBeenCalledWith(
      ORG_ID,
      sysId("sys-1"),
      expect.objectContaining({ name: "Renamed", supportsSessionTermination: true }),
    );
    expect(comp.showRetainedTermination()).toBe(true);
  });

  it("claims no session-termination capability the target was not sealed with", async () => {
    const [fx, sdk] = await buildEditFixture(
      makeSystem({
        sealed: targetSystemSealedFields({
          kind: TargetSystemKind.Unknown,
          supportsSessionTermination: false,
        }),
      }),
    );
    const comp = fx.componentInstance as unknown as {
      policyForm: { patchValue: (v: unknown) => void };
      showRetainedTermination: () => boolean;
      submitEdit: () => Promise<void>;
    };

    comp.policyForm.patchValue({ supportsSessionTermination: true });
    await comp.submitEdit();

    expect(sdk.updateTargetSystem).toHaveBeenCalledWith(
      ORG_ID,
      sysId("sys-1"),
      expect.objectContaining({ supportsSessionTermination: false }),
    );
    expect(comp.showRetainedTermination()).toBe(false);
  });
});

describe("TargetSystemEditComponent: Active Directory edit mode", () => {
  let fixture: ComponentFixture<TargetSystemEditComponent>;
  let rotationSdk: ReturnType<typeof mock<RotationSdkService>>;

  const activeDirectorySystem = makeSystem({
    name: "Corp DC",
    sealed: targetSystemSealedFields({
      kind: TargetSystemKind.ActiveDirectory,
      supportsSessionTermination: true,
    }),
  });

  beforeEach(async () => {
    TestBed.resetTestingModule();
    rotationSdk = mock<RotationSdkService>();
    rotationSdk.listTargetSystems.mockResolvedValue([activeDirectorySystem]);
    rotationSdk.updateTargetSystem.mockResolvedValue(undefined);
    await setupEdit(rotationSdk);
    fixture = TestBed.createComponent(TargetSystemEditComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it("leaves the stored supportsSessionTermination=true standing on save", async () => {
    const comp = fixture.componentInstance as unknown as {
      nameForm: { patchValue: (v: unknown) => void };
      showRetainedTermination: () => boolean;
      submitEdit: () => Promise<void>;
    };

    comp.nameForm.patchValue({ name: "Corp DC (Frankfurt)" });
    await comp.submitEdit();

    expect(rotationSdk.updateTargetSystem).toHaveBeenCalledWith(
      ORG_ID,
      activeDirectorySystem.id,
      expect.objectContaining({
        name: "Corp DC (Frankfurt)",
        supportsSessionTermination: true,
      }),
    );
    expect(comp.showRetainedTermination()).toBe(true);
  });

  it("names the integration on the loaded system", () => {
    const comp = fixture.componentInstance as unknown as { kindLabelKey: () => string | null };

    expect(comp.kindLabelKey()).toBe("pamTargetSystemTypeActiveDirectory");
  });
});

describe("TargetSystemEditComponent: system id (rendered)", () => {
  const SYSTEM_ID = sysId("sys-1");

  let fixture: ComponentFixture<TargetSystemEditComponent>;
  let platformUtilsService: ReturnType<typeof mock<PlatformUtilsService>>;

  async function setup(routeTargetSystemId: string = uuidAsString(SYSTEM_ID)): Promise<void> {
    TestBed.resetTestingModule();
    const rotationSdk = mock<RotationSdkService>();
    rotationSdk.listTargetSystems.mockResolvedValue([makeSystem({ id: SYSTEM_ID })]);
    rotationSdk.listConnectors.mockResolvedValue([]);
    rotationSdk.listConfigs.mockResolvedValue([]);
    platformUtilsService = mock<PlatformUtilsService>();
    await TestBed.configureTestingModule({
      imports: [TargetSystemEditComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: RotationSdkService, useValue: rotationSdk },
        { provide: I18nService, useValue: i18nFake },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        {
          provide: ActivatedRoute,
          useValue: withParamMap({
            snapshot: { params: { organizationId: ORG_ID, targetSystemId: routeTargetSystemId } },
          }),
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TargetSystemEditComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function idBlock(): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="target-system-edit-system-id"]',
    );
  }

  it("states the id in full, so a paste into a connector's config can be checked by eye", async () => {
    await setup();

    expect(idBlock()?.textContent).toContain(uuidAsString(SYSTEM_ID));
  });

  it("copies the id", async () => {
    await setup();

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>("#target-system-edit_button_copy-id")!
      .click();

    expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith(uuidAsString(SYSTEM_ID));
  });

  it("copies the stored id, not the route's spelling of it", async () => {
    await setup(uuidAsString(SYSTEM_ID).toUpperCase());

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>("#target-system-edit_button_copy-id")!
      .click();

    expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith(uuidAsString(SYSTEM_ID));
  });
});

describe("TargetSystemEditComponent: status badge", () => {
  const SYSTEM_ID = sysId("sys-1");

  async function badgeLabelKey(
    system: Partial<TargetSystemView>,
    connectors: AccessConnector[],
    { connectorsFail = false } = {},
  ): Promise<string | undefined> {
    TestBed.resetTestingModule();
    const rotationSdk = mock<RotationSdkService>();
    rotationSdk.listTargetSystems.mockResolvedValue([makeSystem({ id: SYSTEM_ID, ...system })]);
    if (connectorsFail) {
      rotationSdk.listConnectors.mockRejectedValue(new Error("boom"));
    } else {
      rotationSdk.listConnectors.mockResolvedValue(connectors);
    }
    rotationSdk.listConfigs.mockResolvedValue([]);
    await TestBed.configureTestingModule({
      imports: [TargetSystemEditComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: RotationSdkService, useValue: rotationSdk },
        { provide: I18nService, useValue: i18nFake },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        {
          provide: ActivatedRoute,
          useValue: withParamMap({
            snapshot: {
              params: { organizationId: ORG_ID, targetSystemId: uuidAsString(SYSTEM_ID) },
            },
          }),
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(TargetSystemEditComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return (
      fixture.componentInstance as unknown as {
        statusBadge: () => { labelKey: string } | null;
      }
    ).statusBadge()?.labelKey;
  }

  it("shows Active for an active target a connected connector holds", async () => {
    const held = accessConnector({ assignedTargetSystemIds: [SYSTEM_ID] });

    expect(await badgeLabelKey({ status: TargetSystemStatus.Active }, [held])).toBe(
      "pamTargetSystemStatusActive",
    );
  });

  it("shows Not connected for an active automatic target no connector holds", async () => {
    expect(await badgeLabelKey({ status: TargetSystemStatus.Active }, [])).toBe(
      "pamTargetSystemStatusNotConnected",
    );
  });

  it("shows Inactive for a deactivated target, ahead of Not connected", async () => {
    expect(await badgeLabelKey({ status: TargetSystemStatus.Disabled }, [])).toBe(
      "pamTargetSystemStatusInactive",
    );
  });

  it("shows Active for a manual target, which has no connector to lack", async () => {
    expect(
      await badgeLabelKey(
        { status: TargetSystemStatus.Active, method: TargetSystemMethod.Manual },
        [],
      ),
    ).toBe("pamTargetSystemStatusActive");
  });

  it("draws no badge for an active automatic target while the connector read is pending", async () => {
    TestBed.resetTestingModule();
    const rotationSdk = mock<RotationSdkService>();
    rotationSdk.listTargetSystems.mockResolvedValue([
      makeSystem({ id: SYSTEM_ID, status: TargetSystemStatus.Active }),
    ]);
    rotationSdk.listConnectors.mockReturnValue(new Promise(() => {}));
    rotationSdk.listConfigs.mockResolvedValue([]);
    await TestBed.configureTestingModule({
      imports: [TargetSystemEditComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: RotationSdkService, useValue: rotationSdk },
        { provide: I18nService, useValue: i18nFake },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        {
          provide: ActivatedRoute,
          useValue: withParamMap({
            snapshot: {
              params: { organizationId: ORG_ID, targetSystemId: uuidAsString(SYSTEM_ID) },
            },
          }),
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(TargetSystemEditComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector("#target-system-edit_status")).toBeNull();
  });

  it("does not claim Not connected when the connector read failed", async () => {
    expect(
      await badgeLabelKey({ status: TargetSystemStatus.Active }, [], { connectorsFail: true }),
    ).toBe("pamTargetSystemStatusActive");
  });
});

describe("TargetSystemEditComponent: unsaved changes", () => {
  let rotationSdk: ReturnType<typeof mock<RotationSdkService>>;
  let dialogService: ReturnType<typeof mock<DialogService>>;
  let router: Router;

  const DISCARD_DIALOG = {
    title: { key: "discardEditsTitle" },
    content: { key: "discardEditsConfirmation" },
    acceptButtonText: { key: "discardEdits" },
    cancelButtonText: { key: "backToEditing" },
    type: "danger",
    hideIcon: true,
  };

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

    await expect(leaveThroughGuard(fixture.componentInstance)).resolves.toBe(true);
    expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
  });

  it("asks about an abandoned new target system", async () => {
    const fixture = await mount("create");
    dialogService.openSimpleDialog.mockResolvedValue(true);

    createFormOf(fixture).controls.name.markAsDirty();

    await expect(leaveThroughGuard(fixture.componentInstance)).resolves.toBe(true);
    expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(DISCARD_DIALOG);
  });

  it("asks when only the policy card was touched", async () => {
    const fixture = await mount("create");
    dialogService.openSimpleDialog.mockResolvedValue(true);

    policyFormOf(fixture).controls.minLength.markAsDirty();

    await expect(leaveThroughGuard(fixture.componentInstance)).resolves.toBe(true);
    expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(DISCARD_DIALOG);
  });

  it("asks about unsaved edits to an existing target system", async () => {
    const fixture = await mount("edit");
    dialogService.openSimpleDialog.mockResolvedValue(true);

    nameFormOf(fixture).controls.name.markAsDirty();

    await expect(leaveThroughGuard(fixture.componentInstance)).resolves.toBe(true);
    expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(DISCARD_DIALOG);
  });

  it("stays on the page when the operator keeps editing", async () => {
    const fixture = await mount("edit");
    dialogService.openSimpleDialog.mockResolvedValue(false);
    // The router runs the route's guard on the way out; that is where Cancel is asked about.
    const nav = jest
      .spyOn(router, "navigate")
      .mockImplementation(() => leaveThroughGuard(fixture.componentInstance));

    nameFormOf(fixture).patchValue({ name: "Half typed" });
    nameFormOf(fixture).markAsDirty();
    await (fixture.componentInstance as unknown as { cancel: () => Promise<void> }).cancel();

    await expect(nav.mock.results[0].value).resolves.toBe(false);
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

    await expect(leaveThroughGuard(fixture.componentInstance)).resolves.toBe(true);
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
    await expect(leaveThroughGuard(fixture.componentInstance)).resolves.toBe(true);
    expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
  });
});

describe("TargetSystemEditComponent: assigned access connectors", () => {
  type ChosenRow = { id: AccessConnectorId; name: string; badgeLabelKey: string };

  type AssignmentsComp = {
    chosenConnectorRows: () => ChosenRow[];
    createConnectorOptions: () => SelectItemView[];
    connectorsControl: FormControl<SelectItemView[]>;
    noneAssigned: () => boolean;
    noneChosenConnected: () => boolean;
    connectorsUnavailable: () => boolean;
    dirty: () => boolean;
    showFooter: () => boolean;
    discardEdits: () => void;
    removeChosenConnector: (id: AccessConnectorId) => void;
    submitEdit: () => Promise<void>;
    deleteSystem: () => Promise<void>;
    deactivate: () => Promise<void>;
    activate: () => Promise<void>;
    isDisabled: () => boolean;
  };

  const SYSTEM_ID = sysId("sys-1");

  let fixture: ComponentFixture<TargetSystemEditComponent>;
  let component: AssignmentsComp;
  let rotationSdk: ReturnType<typeof mock<RotationSdkService>>;
  let toastService: ReturnType<typeof mock<ToastService>>;
  let dialogService: ReturnType<typeof mock<DialogService>>;
  let router: Router;

  function optionFor(connector: AccessConnector): SelectItemView {
    return { id: String(connector.id), listName: connector.name, labelName: connector.name };
  }

  /** Picks like the multi-select does: dirty first, then the new value. */
  function choose(...connectors: AccessConnector[]): void {
    component.connectorsControl.markAsDirty();
    component.connectorsControl.setValue(connectors.map(optionFor));
  }

  async function setup(
    connectors: AccessConnector[],
    system: Partial<TargetSystemView> = {},
    renderTemplate = false,
    configs: RotationConfigView[] = [],
  ): Promise<void> {
    TestBed.resetTestingModule();
    rotationSdk = mock<RotationSdkService>();
    toastService = mock<ToastService>();
    dialogService = mock<DialogService>();
    rotationSdk.listTargetSystems.mockResolvedValue([makeSystem({ id: SYSTEM_ID, ...system })]);
    rotationSdk.listConnectors.mockResolvedValue(connectors);
    rotationSdk.listConfigs.mockResolvedValue(configs);
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
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        {
          provide: ActivatedRoute,
          useValue: withParamMap({
            snapshot: { params: { organizationId: ORG_ID, targetSystemId: SYSTEM_ID } },
          }),
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

  it("starts the picker with the connectors that name this target system", async () => {
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

    expect(component.connectorsControl.value.map((o) => o.id)).toEqual([assigned.id]);
    expect(component.chosenConnectorRows().map((r) => r.id)).toEqual([assigned.id]);
    expect(component.dirty()).toBe(false);
    expect(component.connectorsControl.dirty).toBe(false);
  });

  it("starts with a connector whose stored assignment id differs from the route id only in case", async () => {
    const assigned = accessConnector({
      id: connectorId("c-assigned"),
      assignedTargetSystemIds: [asUuid<TargetSystemId>(uuidAsString(SYSTEM_ID).toUpperCase())],
    });
    await setup([assigned]);

    expect(component.chosenConnectorRows().map((r) => r.id)).toEqual([assigned.id]);
  });

  it("starts empty and offers every enabled connector when nothing is assigned", async () => {
    const free = accessConnector({ id: connectorId("c-free") });
    const disabled = accessConnector({
      id: connectorId("c-disabled"),
      status: AccessConnectorStatus.Disabled,
    });
    await setup([free, disabled]);

    expect(component.chosenConnectorRows()).toEqual([]);
    expect(component.createConnectorOptions().map((o) => o.id)).toEqual([free.id]);
  });

  it("keeps a disabled connector the target already holds on offer, badged Inactive", async () => {
    await setup([
      accessConnector({
        id: connectorId("c-1"),
        status: AccessConnectorStatus.Disabled,
        isConnected: false,
        assignedTargetSystemIds: [SYSTEM_ID],
      }),
    ]);

    expect(component.createConnectorOptions()).toHaveLength(1);
    expect(component.chosenConnectorRows()[0].badgeLabelKey).toBe("inactive");
  });

  it("badges a connector Connected or Disconnected by its connection", async () => {
    await setup([
      accessConnector({
        id: connectorId("c-on"),
        isConnected: true,
        assignedTargetSystemIds: [SYSTEM_ID],
      }),
      accessConnector({
        id: connectorId("c-off"),
        isConnected: false,
        assignedTargetSystemIds: [SYSTEM_ID],
      }),
    ]);

    expect(component.chosenConnectorRows().map((r) => r.badgeLabelKey)).toEqual([
      "pamAccessConnectorConnected",
      "pamAccessConnectorDisconnected",
    ]);
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
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        {
          provide: ActivatedRoute,
          useValue: withParamMap({
            snapshot: { params: { organizationId: ORG_ID, targetSystemId: SYSTEM_ID } },
          }),
        },
      ],
    }).compileComponents();
    const fx = TestBed.createComponent(TargetSystemEditComponent);
    fx.detectChanges();
    await fx.whenStable();
    fx.detectChanges();

    const comp = fx.componentInstance as unknown as AssignmentsComp;
    expect(comp.connectorsUnavailable()).toBe(true);
    // An unread list is not "none assigned", so it must not warn or offer to remove them all.
    expect(comp.noneAssigned()).toBe(false);
  });

  describe("warnings under the field", () => {
    it("warns right away when the target holds no access connector", async () => {
      await setup([accessConnector({ id: connectorId("c-free") })]);

      expect(component.noneAssigned()).toBe(true);
    });

    it("warns once the last one is removed", async () => {
      const assigned = accessConnector({
        id: connectorId("c-assigned"),
        assignedTargetSystemIds: [SYSTEM_ID],
      });
      await setup([assigned]);
      expect(component.noneAssigned()).toBe(false);

      component.removeChosenConnector(assigned.id);

      expect(component.noneAssigned()).toBe(true);
    });

    it("warns that none are connected when every pick is offline or inactive", async () => {
      const offline = accessConnector({
        id: connectorId("c-off"),
        isConnected: false,
        assignedTargetSystemIds: [SYSTEM_ID],
      });
      const online = accessConnector({ id: connectorId("c-on"), isConnected: true });
      await setup([offline, online]);
      expect(component.noneChosenConnected()).toBe(true);

      choose(offline, online);

      expect(component.noneChosenConnected()).toBe(false);
    });

    it("does not count a connected but inactive connector as able to rotate", async () => {
      await setup([
        accessConnector({
          id: connectorId("c-1"),
          status: AccessConnectorStatus.Disabled,
          isConnected: true,
          assignedTargetSystemIds: [SYSTEM_ID],
        }),
      ]);

      expect(component.noneChosenConnected()).toBe(true);
    });
  });

  describe("editing the picks", () => {
    it("marks the form dirty so the unsaved-changes guard fires and the footer shows", async () => {
      const free = accessConnector({ id: connectorId("c-free") });
      await setup([free]);
      dialogService.openSimpleDialog.mockResolvedValue(true);
      expect(component.showFooter()).toBe(false);

      choose(free);

      expect(component.dirty()).toBe(true);
      expect(component.showFooter()).toBe(true);
      await expect(leaveThroughGuard(fixture.componentInstance)).resolves.toBe(true);
      expect(dialogService.openSimpleDialog).toHaveBeenCalled();
    });

    it("is dirty for a removal too", async () => {
      const assigned = accessConnector({
        id: connectorId("c-assigned"),
        assignedTargetSystemIds: [SYSTEM_ID],
      });
      await setup([assigned]);

      component.removeChosenConnector(assigned.id);

      expect(component.dirty()).toBe(true);
    });

    it("goes back to what the target holds, and hides the footer, on Cancel", async () => {
      const assigned = accessConnector({
        id: connectorId("c-assigned"),
        assignedTargetSystemIds: [SYSTEM_ID],
      });
      await setup([assigned]);
      component.removeChosenConnector(assigned.id);
      nameFormOf(fixture).patchValue({ name: "Renamed" });
      nameFormOf(fixture).markAsDirty();

      component.discardEdits();

      expect(component.chosenConnectorRows().map((r) => r.id)).toEqual([assigned.id]);
      expect(nameFormOf(fixture).value.name).toBe(makeSystem().name);
      expect(component.dirty()).toBe(false);
      expect(component.showFooter()).toBe(false);
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe("saving the picks", () => {
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

      choose(free);
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

    it("re-reads, adopts what the server holds, and stops the guard asking", async () => {
      const free = accessConnector({ id: connectorId("c-free") });
      await setup([free]);
      rotationSdk.updateTargetSystem.mockResolvedValue(undefined);
      rotationSdk.assignTarget.mockResolvedValue(undefined);

      choose(free);
      rotationSdk.listConnectors.mockResolvedValue([
        accessConnector({ id: free.id, assignedTargetSystemIds: [SYSTEM_ID] }),
      ]);
      await component.submitEdit();

      expect(component.chosenConnectorRows().map((r) => r.id)).toEqual([free.id]);
      expect(component.dirty()).toBe(false);
      expect(component.showFooter()).toBe(false);
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    });

    it("leaves the assignments alone when the record write is refused", async () => {
      const free = accessConnector({ id: connectorId("c-free") });
      await setup([free]);
      rotationSdk.updateTargetSystem.mockRejectedValue(new Error("boom"));

      choose(free);
      await component.submitEdit();

      expect(rotationSdk.assignTarget).not.toHaveBeenCalled();
      expect(component.chosenConnectorRows().map((r) => r.id)).toEqual([free.id]);
      expect(component.dirty()).toBe(true);
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
    });

    it("applies what it can and stays dirty for the refused write", async () => {
      const takes = accessConnector({
        id: connectorId("c-takes"),
        assignedTargetSystemIds: [SYSTEM_ID],
      });
      const refuses = accessConnector({
        id: connectorId("c-refuses"),
        assignedTargetSystemIds: [SYSTEM_ID],
      });
      await setup([takes, refuses]);
      dialogService.openSimpleDialog.mockResolvedValue(true);
      rotationSdk.updateTargetSystem.mockResolvedValue(undefined);
      rotationSdk.unassignTarget.mockImplementation((_org, connector) =>
        connector === refuses.id ? Promise.reject(new Error("boom")) : Promise.resolve(),
      );

      choose();
      rotationSdk.listConnectors.mockResolvedValue([
        accessConnector({ id: takes.id }),
        accessConnector({ id: refuses.id, assignedTargetSystemIds: [SYSTEM_ID] }),
      ]);
      await component.submitEdit();

      expect(rotationSdk.unassignTarget).toHaveBeenCalledTimes(2);
      expect(component.dirty()).toBe(true);
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

  describe("removing the last access connector", () => {
    const heldBy = (...ids: string[]) =>
      ids.map((id) =>
        accessConnector({ id: connectorId(id), assignedTargetSystemIds: [SYSTEM_ID] }),
      );

    function credentialsOn(count: number): RotationConfigView[] {
      return Array.from({ length: count }, (_, i) =>
        rotationConfig({ id: configId(`cfg-${i}`), targetSystemId: SYSTEM_ID }),
      );
    }

    it("asks first, naming how many managed credentials stop rotating", async () => {
      await setup(heldBy("c-1"), {}, false, credentialsOn(8));
      dialogService.openSimpleDialog.mockResolvedValue(false);

      component.removeChosenConnector(connectorId("c-1"));
      await component.submitEdit();

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          title: { key: "pamTargetSystemRemoveLastConnectorTitle" },
          content: { key: "pamTargetSystemRemoveLastConnectorContent", placeholders: ["8"] },
          acceptButtonText: { key: "pamTargetSystemRemoveLastConnectorConfirm" },
        }),
      );
      expect(rotationSdk.updateTargetSystem).not.toHaveBeenCalled();
      expect(rotationSdk.unassignTarget).not.toHaveBeenCalled();
      expect(component.dirty()).toBe(true);
    });

    it("saves once the operator confirms", async () => {
      await setup(heldBy("c-1"), {}, false, credentialsOn(2));
      dialogService.openSimpleDialog.mockResolvedValue(true);
      rotationSdk.updateTargetSystem.mockResolvedValue(undefined);
      rotationSdk.unassignTarget.mockResolvedValue(undefined);

      component.removeChosenConnector(connectorId("c-1"));
      rotationSdk.listConnectors.mockResolvedValue([accessConnector({ id: connectorId("c-1") })]);
      await component.submitEdit();

      expect(rotationSdk.unassignTarget).toHaveBeenCalledWith(
        ORG_ID,
        connectorId("c-1"),
        SYSTEM_ID,
      );
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    });

    it("uses the singular line for one credential", async () => {
      await setup(heldBy("c-1"), {}, false, credentialsOn(1));
      dialogService.openSimpleDialog.mockResolvedValue(false);

      component.removeChosenConnector(connectorId("c-1"));
      await component.submitEdit();

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          content: { key: "pamTargetSystemRemoveLastConnectorContentOne", placeholders: [] },
        }),
      );
    });

    it("drops the number when there are no credentials or they could not be read", async () => {
      await setup(heldBy("c-1"));
      dialogService.openSimpleDialog.mockResolvedValue(false);
      component.removeChosenConnector(connectorId("c-1"));
      await component.submitEdit();
      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          content: { key: "pamTargetSystemRemoveLastConnectorContentNone", placeholders: [] },
        }),
      );

      await setup(heldBy("c-1"));
      rotationSdk.listConfigs.mockRejectedValue(new Error("boom"));
      dialogService.openSimpleDialog.mockResolvedValue(false);
      component.removeChosenConnector(connectorId("c-1"));
      await component.submitEdit();
      expect(dialogService.openSimpleDialog).toHaveBeenCalledTimes(1);
    });

    it("does not ask when another connector stays, or when none was held to begin with", async () => {
      await setup(heldBy("c-1", "c-2"));
      rotationSdk.updateTargetSystem.mockResolvedValue(undefined);
      rotationSdk.unassignTarget.mockResolvedValue(undefined);
      component.removeChosenConnector(connectorId("c-1"));
      await component.submitEdit();
      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();

      await setup([]);
      rotationSdk.updateTargetSystem.mockResolvedValue(undefined);
      await component.submitEdit();
      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
    });
  });

  describe("activation", () => {
    it("deactivates after confirming, and flips the page to inactive", async () => {
      await setup([]);
      dialogService.openSimpleDialog.mockResolvedValue(true);
      rotationSdk.disableTargetSystem.mockResolvedValue(undefined);

      await component.deactivate();

      expect(rotationSdk.disableTargetSystem).toHaveBeenCalledWith(ORG_ID, SYSTEM_ID);
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ message: "pamTargetSystemDeactivateSuccess" }),
      );
      expect(component.isDisabled()).toBe(true);
    });

    it("leaves the target alone when the operator backs out", async () => {
      await setup([]);
      dialogService.openSimpleDialog.mockResolvedValue(false);

      await component.deactivate();

      expect(rotationSdk.disableTargetSystem).not.toHaveBeenCalled();
    });

    it("activates without asking", async () => {
      await setup([], { status: TargetSystemStatus.Disabled });
      rotationSdk.enableTargetSystem.mockResolvedValue(undefined);

      await component.activate();

      expect(rotationSdk.enableTargetSystem).toHaveBeenCalledWith(ORG_ID, SYSTEM_ID);
      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ message: "pamTargetSystemActivateSuccess" }),
      );
    });

    it("surfaces a refusal and keeps the status", async () => {
      await setup([], { status: TargetSystemStatus.Disabled });
      rotationSdk.enableTargetSystem.mockRejectedValue(new Error("boom"));

      await component.activate();

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
      expect(toastService.showToast).not.toHaveBeenCalledWith(
        expect.objectContaining({ message: "pamTargetSystemActivateSuccess" }),
      );
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
            key: "pamTargetSystemDeleteDialogAssignedConnectorsContentDeactivateInstead",
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
            key: "pamTargetSystemDeleteDialogContentDeactivateInstead",
          }),
        }),
      );
      expect(rotationSdk.deleteTargetSystem).not.toHaveBeenCalled();
    });

    it("does not offer to deactivate a target that is already inactive", async () => {
      await setup([], { status: TargetSystemStatus.Disabled });
      dialogService.openSimpleDialog.mockResolvedValue(false);

      await component.deleteSystem();

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            key: "pamTargetSystemDeleteDialogContent",
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

    it("titles the page with the target's name and draws both tabs", async () => {
      await setup([], { name: "Okta Identity" }, true);

      expect(el().querySelector("bit-header")?.textContent).toContain("Okta Identity");
      const tabs = [...el().querySelectorAll("bit-tab-link")].map((t) => t.textContent?.trim());
      expect(tabs).toEqual(["pamTargetSystemTabConfiguration", "pamRotationTabManagedCredentials"]);
    });

    it("draws the three sections in order: general information, automatic rotation, password policy", async () => {
      await setup([], {}, true);

      const headings = [...el().querySelectorAll("h2")].map((h) => h.textContent?.trim());
      expect(headings).toEqual([
        "pamTargetSystemGeneralInfoHeading",
        "pamTargetSystemAutomaticRotationHeading",
        "pamTargetSystemPolicyHeading",
      ]);
      expect(el().querySelector('[data-testid="target-system-edit-method"]')).toBeTruthy();
      expect(el().querySelector('[data-testid="target-system-edit-system-type"]')).toBeTruthy();
      expect(el().querySelector('[data-testid="target-system-edit-ending-sessions"]')).toBeTruthy();
    });

    it("draws the picks as rows with a state badge and a remove control", async () => {
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

      expect(el().querySelector("pam-assignment-picker")).toBeNull();
      const list = el().querySelector('[data-testid="target-system-edit-chosen-connectors"]');
      expect(list?.textContent).toContain("Prod connector");
      expect(
        el().querySelector(
          `#target-system-edit_button_remove-connector-${connectorId("c-assigned")}`,
        ),
      ).toBeTruthy();
    });

    it("names each connector's remove control after the connector", async () => {
      const t = jest
        .spyOn(i18nFake, "t")
        .mockImplementation((id: string, p1?: string | number) => (p1 ? `${id}:${p1}` : id));
      try {
        await setup(
          [
            accessConnector({
              id: connectorId("c-one"),
              name: "Prod connector",
              assignedTargetSystemIds: [SYSTEM_ID],
            }),
            accessConnector({
              id: connectorId("c-two"),
              name: "Backup connector",
              assignedTargetSystemIds: [SYSTEM_ID],
            }),
          ],
          {},
          true,
        );

        const label = (id: string) =>
          el()
            .querySelector(`#target-system-edit_button_remove-connector-${connectorId(id)}`)
            ?.getAttribute("aria-label");
        expect(label("c-one")).toBe("pamTargetSystemRemoveConnector:Prod connector");
        expect(label("c-two")).toBe("pamTargetSystemRemoveConnector:Backup connector");
      } finally {
        t.mockRestore();
      }
    });

    it("shows the none-assigned warning with no list when nothing is held", async () => {
      await setup([accessConnector({ id: connectorId("c-free") })], {}, true);

      expect(el().querySelector("#target-system-edit_callout_none-assigned")).toBeTruthy();
      expect(el().querySelector('[data-testid="target-system-edit-chosen-connectors"]')).toBeNull();
    });

    it("hides the automatic rotation section for a manual target, which never claims a connector", async () => {
      await setup([], { method: TargetSystemMethod.Manual, sealed: undefined }, true);

      expect(el().textContent).not.toContain("pamTargetSystemAutomaticRotationHeading");
      expect(el().querySelector("#target-system-edit_multi-select_connectors")).toBeNull();
    });

    const menuItems = (): string[] =>
      Array.from(document.querySelectorAll<HTMLElement>("[bitMenuItem]")).map(
        (button) => button.id,
      );

    function openMenu(): void {
      el().querySelector<HTMLButtonElement>("#target-system-edit_button_more")!.click();
      fixture.detectChanges();
    }

    it("offers only the More menu for an active target, with Deactivate and Delete, and no save row", async () => {
      await setup([], {}, true);

      expect(el().querySelector("#target-system-edit_button_activate")).toBeNull();
      openMenu();
      expect(menuItems()).toEqual([
        "target-system-edit_button_deactivate",
        "target-system-edit_button_delete",
      ]);
      expect(document.querySelector("#target-system-edit_button_delete")!.className).toContain(
        "danger",
      );
      expect(el().querySelector("#target-system-edit_button_save")).toBeNull();
      expect(TestBed.inject(LayoutFooterService).portal()).toBeUndefined();
    });

    it("offers a primary Activate beside the More menu, under an inactive notice, for an inactive target", async () => {
      await setup([], { status: TargetSystemStatus.Disabled }, true);

      expect(
        el().querySelector("#target-system-edit_button_activate")!.getAttribute("buttonType"),
      ).toBe("primary");
      expect(el().querySelector("#target-system-edit_callout_inactive")).toBeTruthy();
      openMenu();
      expect(menuItems()).toEqual(["target-system-edit_button_delete"]);
    });

    it("offers only Delete while the target is still being set up", async () => {
      await setup([], { status: TargetSystemStatus.PendingSeal, sealed: undefined }, true);

      expect(el().querySelector("#target-system-edit_button_activate")).toBeNull();
      openMenu();
      expect(menuItems()).toEqual(["target-system-edit_button_delete"]);
    });

    it("keeps the More menu in the header and pins only Save and Cancel once an edit is unsaved", async () => {
      const free = accessConnector({ id: connectorId("c-free") });
      await setup([free], {}, true);

      choose(free);
      fixture.detectChanges();
      TestBed.flushEffects();
      fixture.detectChanges();

      expect(el().querySelector("#target-system-edit_button_more")).toBeTruthy();
      const portal = TestBed.inject(LayoutFooterService).portal();
      expect(portal).toBeTruthy();
      const host = document.createElement("div");
      document.body.appendChild(host);
      const outlet = new DomPortalOutlet(host);
      outlet.attach(portal as TemplatePortal);
      expect(Array.from(host.querySelectorAll("button")).map((button) => button.id)).toEqual([
        "target-system-edit_button_save",
        "target-system-edit_button_cancel",
      ]);
      outlet.dispose();
      host.remove();

      component.discardEdits();
      fixture.detectChanges();
      TestBed.flushEffects();
      expect(TestBed.inject(LayoutFooterService).portal()).toBeUndefined();
      expect(el().querySelector("#target-system-edit_button_more")).toBeTruthy();
    });
  });
});

describe("TargetSystemEditComponent: outstanding setup hint", () => {
  const SYSTEM_ID = sysId("sys-1");
  const CREDENTIAL_STEP = "pamTargetSystemSetupGuidanceCredential";

  type HintComp = {
    outstandingSetupSteps: () => readonly string[];
  };

  type SetupOptions = {
    connectors?: AccessConnector[];
    configs?: RotationConfigView[];
    system?: Partial<TargetSystemView>;
    /** Leave the configs read in flight, to look at the page before it has an answer. */
    holdConfigs?: boolean;
    connectorsFail?: boolean;
    configsFail?: boolean;
    render?: boolean;
  };

  let fixture: ComponentFixture<TargetSystemEditComponent>;
  let component: HintComp;
  let rotationSdk: ReturnType<typeof mock<RotationSdkService>>;

  function assignedConnector(): AccessConnector {
    return accessConnector({
      id: connectorId("c-assigned"),
      name: "Prod connector",
      assignedTargetSystemIds: [SYSTEM_ID],
    });
  }

  /** An active connector the org holds that this target does not, so it can be assigned here. */
  function freeConnector(): AccessConnector {
    return accessConnector({ id: connectorId("c-free"), name: "Spare connector" });
  }

  /** A managed credential naming this target. */
  function credentialHere(): RotationConfigView {
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
      rotationSdk.listConfigs.mockReturnValue(new Promise<RotationConfigView[]>(() => {}));
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
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        {
          provide: ActivatedRoute,
          useValue: withParamMap({
            snapshot: { params: { organizationId: ORG_ID, targetSystemId: SYSTEM_ID } },
          }),
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
    await setup({ connectors: [freeConnector()] });

    // The connector is the Access connectors field's own warning, so only the credential is named.
    expect(component.outstandingSetupSteps()).toEqual([CREDENTIAL_STEP]);
  });

  it("names only the credential once a connector is assigned", async () => {
    await setup({ connectors: [assignedConnector()] });

    expect(component.outstandingSetupSteps()).toEqual([CREDENTIAL_STEP]);
  });

  it("names nothing once a credential exists, even with no connector yet", async () => {
    await setup({ configs: [credentialHere()] });

    expect(component.outstandingSetupSteps()).toEqual([]);
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

  it("names the credential for a manual target, which has no connector to assign", async () => {
    await setup({ system: { method: TargetSystemMethod.Manual, sealed: undefined } });

    expect(component.outstandingSetupSteps()).toEqual([CREDENTIAL_STEP]);
  });

  it("names nothing for a manual target that already has its credential", async () => {
    await setup({
      system: { method: TargetSystemMethod.Manual, sealed: undefined },
      configs: [credentialHere()],
    });

    expect(component.outstandingSetupSteps()).toEqual([]);
  });

  it("says nothing while the credentials read is still in flight", async () => {
    await setup({ holdConfigs: true });

    expect(component.outstandingSetupSteps()).toEqual([]);
  });

  it("still names the credential when the connectors could not be read", async () => {
    await setup({ connectorsFail: true });

    expect(component.outstandingSetupSteps()).toEqual([CREDENTIAL_STEP]);
  });

  it("does not claim the credential step when the credentials could not be read", async () => {
    await setup({ connectors: [freeConnector()], configsFail: true });

    expect(component.outstandingSetupSteps()).toEqual([]);
  });

  it("does not ask for a connector assignment when the org holds none to assign", async () => {
    await setup({ connectors: [] });

    expect(component.outstandingSetupSteps()).toEqual([CREDENTIAL_STEP]);
  });

  it("does not ask for one when every connector the org holds is inactive", async () => {
    await setup({
      connectors: [
        accessConnector({ id: connectorId("c-off"), status: AccessConnectorStatus.Disabled }),
      ],
    });

    expect(component.outstandingSetupSteps()).toEqual([CREDENTIAL_STEP]);
  });

  it("says nothing for a target that is out of service, which can act on neither step", async () => {
    await setup({ system: { status: TargetSystemStatus.Disabled } });

    expect(component.outstandingSetupSteps()).toEqual([]);
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

    it("renders a single step as one line with no list", async () => {
      await setup({ connectors: [assignedConnector()], render: true });

      expect(callout()!.querySelectorAll("li").length).toBe(0);
      expect(callout()!.textContent).toContain(CREDENTIAL_STEP);
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
  });
});

describe("TargetSystemEditComponent: seal status", () => {
  const SYSTEM_ID = sysId("sys-1");

  let fixture: ComponentFixture<TargetSystemEditComponent>;
  let component: {
    sealIssue: () => "ok" | "pending" | "invalid";
    showEditKindPicker: () => boolean;
    editKindControl: { value: TargetSystemKind; setValue: (v: TargetSystemKind) => void };
  };
  let rotationSdk: ReturnType<typeof mock<RotationSdkService>>;

  async function render(system: Partial<TargetSystemView>): Promise<void> {
    TestBed.resetTestingModule();
    rotationSdk = mock<RotationSdkService>();
    rotationSdk.listTargetSystems.mockResolvedValue([makeSystem({ id: SYSTEM_ID, ...system })]);
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
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        {
          provide: ActivatedRoute,
          useValue: withParamMap({
            snapshot: { params: { organizationId: ORG_ID, targetSystemId: SYSTEM_ID } },
          }),
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TargetSystemEditComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    component = fixture.componentInstance as unknown as typeof component;
  }

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it("reports ok and shows no callout for a verified target", async () => {
    await render({});

    expect(component.sealIssue()).toBe("ok");
    expect(el().querySelector("#target-system-edit_callout_seal-issue")).toBeNull();
  });

  it("reports pending and banners setup-incomplete copy for a pending_seal target", async () => {
    await render({ status: TargetSystemStatus.PendingSeal, sealed: undefined });

    expect(component.sealIssue()).toBe("pending");
    const callout = el().querySelector("#target-system-edit_callout_seal-issue");
    expect(callout).not.toBeNull();
    expect(callout!.textContent).toContain("pamTargetSystemSetupIncompleteContent");
  });

  it("reports invalid and banners integrity-check-failed copy for an active-but-unverifiable target", async () => {
    await render({ status: TargetSystemStatus.Active, sealed: undefined });

    expect(component.sealIssue()).toBe("invalid");
    const callout = el().querySelector("#target-system-edit_callout_seal-issue");
    expect(callout).not.toBeNull();
    expect(callout!.textContent).toContain("pamTargetSystemIntegrityCheckFailedContent");
  });

  describe("the kind picker", () => {
    it("is shown, defaulting to Entra, when there is no sealed kind to resend", async () => {
      await render({ status: TargetSystemStatus.PendingSeal, sealed: undefined });

      expect(component.showEditKindPicker()).toBe(true);
      expect(component.editKindControl.value).toBe(TargetSystemKind.Entra);
      expect(el().querySelector("#target-system-edit_select_kind")).not.toBeNull();
    });

    it("is hidden in favor of the read-only label when the sealed kind is known", async () => {
      await render({});

      expect(component.showEditKindPicker()).toBe(false);
      expect(el().querySelector("#target-system-edit_select_kind")).toBeNull();
    });

    it("is hidden for a manual target, which has no kind to pick", async () => {
      await render({ method: TargetSystemMethod.Manual, sealed: undefined });

      expect(component.showEditKindPicker()).toBe(false);
    });

    it("sends the picked kind on save, since there is no sealed value to resend", async () => {
      await render({ status: TargetSystemStatus.PendingSeal, sealed: undefined });
      rotationSdk.updateTargetSystem.mockResolvedValue(undefined);
      component.editKindControl.setValue(TargetSystemKind.CustomScript);

      await (
        fixture.componentInstance as unknown as { submitEdit: () => Promise<void> }
      ).submitEdit();

      expect(rotationSdk.updateTargetSystem).toHaveBeenCalledWith(
        ORG_ID,
        SYSTEM_ID,
        expect.objectContaining({ method: "automatic", kind: TargetSystemKind.CustomScript }),
      );
    });
  });
});

describe("TargetSystemEditComponent: loading skeleton", () => {
  const SYSTEM_ID = sysId("sys-1");

  let fixture: ComponentFixture<TargetSystemEditComponent>;
  let rotationSdk: ReturnType<typeof mock<RotationSdkService>>;

  const el = () => fixture.nativeElement as HTMLElement;

  async function renderLoading({ editing = true } = {}) {
    TestBed.resetTestingModule();
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
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        {
          provide: ActivatedRoute,
          useValue: withParamMap({
            snapshot: {
              params: {
                organizationId: ORG_ID,
                ...(editing ? { targetSystemId: SYSTEM_ID } : {}),
              },
            },
          }),
        },
      ],
    }).compileComponents();

    jest.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);
    fixture = TestBed.createComponent(TargetSystemEditComponent);
    fixture.detectChanges();
  }

  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it("stands skeleton fields in for the form, inside the real card furniture", async () => {
    await renderLoading();
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
    await renderLoading();

    const status = el().querySelector('[data-testid="rotation-loading-status"]');
    expect(status!.getAttribute("role")).toBe("status");
    expect(status!.getAttribute("aria-live")).toBe("polite");
    expect(status!.textContent).toContain("loading");

    await settle();

    expect(el().querySelector('[data-testid="rotation-loading-status"]')!.textContent).toContain(
      "pamRotationPageLoaded",
    );
  });

  it("replaces the skeleton with the real form once the target system lands", async () => {
    await renderLoading();

    await settle();

    expect(el().querySelector('[data-testid="target-system-edit-loading"]')).toBeNull();
    expect(el().querySelector("bit-skeleton")).toBeNull();
    expect(el().querySelector("#target-system-edit_input_name")).not.toBeNull();
  });

  it("renders the page's own chrome around the skeleton, not a blank area", async () => {
    await renderLoading();

    expect(el().querySelector('[data-testid="target-system-edit-loading"]')).not.toBeNull();
    expect(el().querySelector("pam-detail-breadcrumb")).not.toBeNull();
  });
});

describe("TargetSystemEditComponent: load error state", () => {
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
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        {
          provide: ActivatedRoute,
          useValue: withParamMap({
            snapshot: { params: { organizationId: ORG_ID, targetSystemId: SYSTEM_ID } },
          }),
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

  /** The post-save re-read is separate from the read that opens the page. */
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

describe("TargetSystemEditComponent: session termination withdrawal (rendered)", () => {
  const SYSTEM_ID = sysId("sys-1");

  let fixture: ComponentFixture<TargetSystemEditComponent>;

  const el = () => fixture.nativeElement as HTMLElement;

  async function render(overrides: Partial<TargetSystemView> = {}) {
    TestBed.resetTestingModule();
    const rotationSdk = mock<RotationSdkService>();
    rotationSdk.listTargetSystems.mockResolvedValue([
      makeSystem({
        id: SYSTEM_ID,
        sealed: targetSystemSealedFields({
          kind: TargetSystemKind.CustomScript,
          supportsSessionTermination: true,
        }),
        ...overrides,
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
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        {
          provide: ActivatedRoute,
          useValue: withParamMap({
            snapshot: { params: { organizationId: ORG_ID, targetSystemId: SYSTEM_ID } },
          }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TargetSystemEditComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const endingSessions = () =>
    el().querySelector('[data-testid="target-system-edit-ending-sessions"]')!.textContent;

  it("shows what a custom script confirmed, with no checkbox to change it", async () => {
    await render();

    expect(endingSessions()).toContain("pamTargetSystemSessionTerminationSupported");
    expect(endingSessions()).toContain("pamTargetSystemEndingSessionsCustomScriptSupportedHint");
    expect(el().querySelector("#target-system-edit_checkbox_session-termination")).toBeNull();
  });

  it("says a custom script that never confirmed it can't end sessions", async () => {
    await render({
      sealed: targetSystemSealedFields({
        kind: TargetSystemKind.CustomScript,
        supportsSessionTermination: false,
      }),
    });

    expect(endingSessions()).toContain("pamTargetSystemSessionTerminationNo");
    expect(endingSessions()).toContain("pamTargetSystemEndingSessionsCustomScriptHint");
  });

  it("always reads Supported for a native integration", async () => {
    await render({
      sealed: targetSystemSealedFields({
        kind: TargetSystemKind.Entra,
        supportsSessionTermination: false,
      }),
    });

    expect(endingSessions()).toContain("pamTargetSystemSessionTerminationSupported");
    expect(endingSessions()).toContain("pamTargetSystemEndingSessionsEntraHint");
  });

  describe("naming the integration", () => {
    it("names a kind it can model", async () => {
      await render({
        sealed: targetSystemSealedFields({
          kind: TargetSystemKind.Entra,
          supportsSessionTermination: false,
        }),
      });

      expect(el().textContent).toContain("pamTargetSystemTypeEntra");
    });

    it("leaves a kind it cannot model unnamed", async () => {
      await render({
        sealed: targetSystemSealedFields({
          kind: TargetSystemKind.Unknown,
          supportsSessionTermination: false,
        }),
      });

      expect(el().textContent).toContain("pamTargetSystemMethodAutomatic");
      expect(el().textContent).not.toContain("pamTargetSystemTypeCustomScript");
      expect(el().textContent).not.toContain("pamTargetSystemTypeEntra");
    });
  });
});

describe("TargetSystemEditComponent: returning to a managed credential", () => {
  type ReturnComp = {
    connectorsControl: FormControl<SelectItemView[]>;
    submitEdit: () => Promise<void>;
    cancel: () => Promise<void>;
  };

  const SYSTEM_ID = sysId("sys-1");
  const CONFIG_ID = uuidAsString(configId("cfg-1"));
  const CREDENTIAL_ROUTE = [...rotationLink(ORG_ID, ROTATION_TABS.managedCredentials), CONFIG_ID];

  let fixture: ComponentFixture<TargetSystemEditComponent>;
  let rotationSdk: ReturnType<typeof mock<RotationSdkService>>;
  let navigate: jest.SpyInstance;

  async function setup(renderTemplate = false): Promise<void> {
    TestBed.resetTestingModule();
    rotationSdk = mock<RotationSdkService>();
    rotationSdk.listTargetSystems.mockResolvedValue([makeSystem({ id: SYSTEM_ID })]);
    rotationSdk.listConnectors.mockResolvedValue([]);
    rotationSdk.listConfigs.mockResolvedValue([]);
    rotationSdk.updateTargetSystem.mockResolvedValue(undefined);
    if (!renderTemplate) {
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
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        {
          provide: ActivatedRoute,
          useValue: withParamMap({
            snapshot: {
              params: { organizationId: ORG_ID, targetSystemId: SYSTEM_ID },
              queryParams: { [THEN_QUERY_PARAM]: THEN_CREDENTIAL, [CONFIG_QUERY_PARAM]: CONFIG_ID },
            },
          }),
        },
      ],
    }).compileComponents();
    navigate = jest.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);
    fixture = TestBed.createComponent(TargetSystemEditComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const component = () => fixture.componentInstance as unknown as ReturnComp;

  it("keeps the target systems breadcrumb, so the header fits beside its actions", async () => {
    await setup(true);

    const crumbs = (fixture.nativeElement as HTMLElement).querySelector("pam-detail-breadcrumb")!;
    expect(crumbs.textContent).toContain("pamRotationTabTargetSystems");
    expect(crumbs.textContent).not.toContain("pamRotationTabManagedCredentials");
    expect(rotationSdk.getConfig).not.toHaveBeenCalled();
  });

  it("carries the way back to the credential across both tabs", async () => {
    await setup(true);

    const links = fixture.debugElement.queryAll(By.directive(TabLinkComponent));
    const expected = { [THEN_QUERY_PARAM]: THEN_CREDENTIAL, [CONFIG_QUERY_PARAM]: CONFIG_ID };
    expect(links.map((link) => link.componentInstance.queryParams())).toEqual([expected, expected]);
  });

  it("lands on the Access connectors field", async () => {
    await setup(true);
    await fixture.whenStable();

    const field = (fixture.nativeElement as HTMLElement).querySelector(
      "#target-system-edit_multi-select_connectors",
    )!;
    expect(field.contains(document.activeElement)).toBe(true);
  });

  it("goes back to the credential once saved", async () => {
    await setup();
    component().connectorsControl.markAsDirty();

    await component().submitEdit();

    expect(rotationSdk.updateTargetSystem).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(CREDENTIAL_ROUTE);
  });

  it("goes back to the credential on cancel", async () => {
    await setup();

    await component().cancel();

    expect(navigate).toHaveBeenCalledWith(CREDENTIAL_ROUTE);
  });
});
