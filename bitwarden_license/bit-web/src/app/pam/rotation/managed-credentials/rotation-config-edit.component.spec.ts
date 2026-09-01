import { TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, provideRouter } from "@angular/router";
import { BehaviorSubject, of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, ToastService } from "@bitwarden/components";

import { OrgCiphersService } from "../org-ciphers.service";
import type { RotationConfigDetail, RotationConfigId } from "../rotation";
import { RotationSdkService } from "../rotation-sdk.service";
import { TargetSystemsService } from "../target-systems/target-systems.service";
import {
  CIPHER_ID,
  ORGANIZATION_ID,
  TARGET_SYSTEM_ID,
  configId,
  rotationConfigDetail,
  targetSystem,
} from "../testing/rotation-builders";

import { RotationConfigEditComponent } from "./rotation-config-edit.component";

const i18nFake: Pick<I18nService, "t" | "translate"> = {
  t: (id: string) => id,
  translate: (id: string) => id,
};

const ORG_ID = ORGANIZATION_ID;

/** The config the edit page loads: daily schedule, idle, automatic. */
function loadedConfig(overrides: Partial<RotationConfigDetail> = {}): RotationConfigDetail {
  return rotationConfigDetail({
    id: configId("cfg-1"),
    accountIdentity: "admin@example.com",
    scheduleCron: "0 0 0 * * ?",
    ...overrides,
  });
}

type SetupOptions = {
  configId?: RotationConfigId;
  existingConfig?: RotationConfigDetail | null;
};

function setup(options: SetupOptions = {}) {
  const { configId, existingConfig } = options;

  const target = targetSystem();

  const rotationSdk: jest.Mocked<
    Pick<
      RotationSdkService,
      "listConfigs" | "getConfig" | "createConfig" | "updateConfig" | "deleteConfig"
    >
  > = {
    listConfigs: jest.fn().mockResolvedValue([]),
    getConfig: jest.fn().mockResolvedValue(existingConfig ?? loadedConfig()),
    createConfig: jest.fn().mockResolvedValue(loadedConfig()),
    // One write now carries the schedule and the account together.
    updateConfig: jest.fn().mockResolvedValue(loadedConfig()),
    deleteConfig: jest.fn().mockResolvedValue(undefined),
  };

  const dialogService = { openSimpleDialog: jest.fn().mockResolvedValue(true) };

  const targetSystemsService = {
    systems$: new BehaviorSubject([target]),
    load: jest.fn().mockResolvedValue(undefined),
  };

  const orgCiphersService = {
    ciphers$: new BehaviorSubject([] as CipherView[]),
    cipherNameById$: new BehaviorSubject(new Map<string, string>()),
    loading$: new BehaviorSubject(false),
    load: jest.fn().mockResolvedValue(undefined),
  };

  const toastService = { showToast: jest.fn() };

  TestBed.overrideComponent(RotationConfigEditComponent, {
    set: { template: "<div>stub</div>", imports: [] },
  });

  // Override the component-level providers (OrgCiphersService, TargetSystemsService)
  // so the real implementations (which inject AccountService, RotationSdkService, etc.)
  // are never instantiated — component-level providers shadow module-level mocks.
  TestBed.overrideProvider(OrgCiphersService, { useValue: orgCiphersService });
  TestBed.overrideProvider(TargetSystemsService, { useValue: targetSystemsService });

  TestBed.configureTestingModule({
    imports: [RotationConfigEditComponent, ReactiveFormsModule],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            params: {
              organizationId: ORGANIZATION_ID,
              ...(configId ? { configId } : {}),
            },
          },
        },
      },
      { provide: RotationSdkService, useValue: rotationSdk },
      { provide: TargetSystemsService, useValue: targetSystemsService },
      { provide: OrgCiphersService, useValue: orgCiphersService },
      { provide: ToastService, useValue: toastService },
      { provide: DialogService, useValue: dialogService },
      { provide: I18nService, useValue: i18nFake },
    ],
  });

  const fixture = TestBed.createComponent(RotationConfigEditComponent);
  const component = fixture.componentInstance as any;
  fixture.detectChanges();

  return {
    fixture,
    component,
    rotationSdk,
    targetSystemsService,
    orgCiphersService,
    toastService,
    dialogService,
  };
}

describe("RotationConfigEditComponent — CREATE mode", () => {
  it("starts in create mode when no configId is present", () => {
    const { component } = setup();
    expect(component.editing).toBe(false);
  });

  it("loads target systems and ciphers on init", async () => {
    const { fixture, targetSystemsService, orgCiphersService } = setup();
    await fixture.whenStable();
    expect(targetSystemsService.load).toHaveBeenCalledWith(ORG_ID);
    expect(orgCiphersService.load).toHaveBeenCalledWith(ORG_ID);
  });

  it("calls rotationSdk.createConfig on valid create submit", async () => {
    const { component, rotationSdk, fixture } = setup();
    await fixture.whenStable();

    component.createForm.setValue({
      cipherId: CIPHER_ID,
      targetSystemId: TARGET_SYSTEM_ID,
      accountIdentity: "admin@example.com",
      terminateSessions: false,
      scheduleCron: null,
      rotateOnAccessEnd: false,
    });

    await component.submitCreate();
    expect(rotationSdk.createConfig).toHaveBeenCalled();
  });

  it("does not call createConfig when form is invalid", async () => {
    const { component, rotationSdk } = setup();
    // cipherId + targetSystemId empty — form is invalid
    await component.submitCreate();
    expect(rotationSdk.createConfig).not.toHaveBeenCalled();
  });
});

describe("RotationConfigEditComponent — EDIT mode", () => {
  it("starts in edit mode when configId param is present", () => {
    const { component } = setup({ configId: configId("cfg-1") });
    expect(component.editing).toBe(true);
  });

  it("fetches the rotation config details on init", async () => {
    const { fixture, rotationSdk } = setup({ configId: configId("cfg-1") });
    await fixture.whenStable();
    expect(rotationSdk.getConfig).toHaveBeenCalledWith(ORG_ID, configId("cfg-1"));
  });

  it("patches settingsForm from the loaded config", async () => {
    const { component, fixture } = setup({ configId: configId("cfg-1") });
    await fixture.whenStable();
    expect(component.settingsForm.controls.scheduleCron.value).toBe("0 0 0 * * ?");
  });

  /**
   * The schedule and the account used to be two routes and two Save buttons; the server takes
   * them in one write, so one submit carries both cards' values.
   */
  it("sends the schedule and the account together on submit", async () => {
    const { component, fixture, rotationSdk } = setup({ configId: configId("cfg-1") });
    await fixture.whenStable();
    component.accountForm.controls.accountIdentity.setValue("svc_rotation");
    component.accountForm.controls.terminateSessions.setValue(true);

    await component.submitEdit();

    expect(rotationSdk.updateConfig).toHaveBeenCalledWith(
      ORG_ID,
      configId("cfg-1"),
      expect.objectContaining({
        accountIdentity: "svc_rotation",
        terminateSessions: true,
        scheduleCron: "0 0 0 * * ?",
      }),
    );
  });

  it("does not submit when either half of the form is invalid", async () => {
    const { component, fixture, rotationSdk } = setup({ configId: configId("cfg-1") });
    await fixture.whenStable();
    component.accountForm.controls.accountIdentity.setValue("");

    await component.submitEdit();

    expect(rotationSdk.updateConfig).not.toHaveBeenCalled();
  });

  it("sets accountFormLocked to true when hasActiveJob is true", async () => {
    const existingConfig = loadedConfig({ hasActiveJob: true });
    const { component, fixture } = setup({ configId: configId("cfg-1"), existingConfig });
    await fixture.whenStable();
    expect(component.accountFormLocked()).toBe(true);
  });

  it("navigates away and toasts on not-found error", async () => {
    const rotationApiFailing: any = {
      getConfig: jest.fn().mockRejectedValue(new Error("Not found")),
      listConfigs: jest.fn().mockResolvedValue([]),
      updateRotationConfigSettings: jest.fn(),
      updateRotationConfigAccount: jest.fn(),
      createConfig: jest.fn(),
    };

    const toastService = { showToast: jest.fn() };
    const orgCiphersService = {
      ciphers$: new BehaviorSubject([] as CipherView[]),
      cipherNameById$: new BehaviorSubject(new Map<string, string>()),
      loading$: new BehaviorSubject(false),
      load: jest.fn().mockResolvedValue(undefined),
    };

    const targetSystemsStub = { systems$: of([]), load: jest.fn().mockResolvedValue(undefined) };

    TestBed.overrideComponent(RotationConfigEditComponent, {
      set: { template: "<div>stub</div>", imports: [] },
    });
    TestBed.overrideProvider(OrgCiphersService, { useValue: orgCiphersService });
    TestBed.overrideProvider(TargetSystemsService, { useValue: targetSystemsStub });

    TestBed.configureTestingModule({
      imports: [RotationConfigEditComponent, ReactiveFormsModule],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              params: { organizationId: ORGANIZATION_ID, configId: configId("missing") },
            },
          },
        },
        { provide: RotationSdkService, useValue: rotationApiFailing },
        { provide: TargetSystemsService, useValue: targetSystemsStub },
        { provide: OrgCiphersService, useValue: orgCiphersService },
        { provide: ToastService, useValue: toastService },
        { provide: DialogService, useValue: { openSimpleDialog: jest.fn() } },
        { provide: I18nService, useValue: i18nFake },
      ],
    });

    const fixture = TestBed.createComponent(RotationConfigEditComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error" }),
    );
  });

  it("removes the rotation config after confirmation", async () => {
    const { component, fixture, rotationSdk, dialogService } = setup({
      configId: configId("cfg-1"),
    });
    await fixture.whenStable();
    dialogService.openSimpleDialog.mockResolvedValue(true);

    await component.removeRotation();

    expect(rotationSdk.deleteConfig).toHaveBeenCalledWith(ORG_ID, configId("cfg-1"));
  });

  it("does not remove the rotation config when confirmation is cancelled", async () => {
    const { component, fixture, rotationSdk, dialogService } = setup({
      configId: configId("cfg-1"),
    });
    await fixture.whenStable();
    dialogService.openSimpleDialog.mockResolvedValue(false);

    await component.removeRotation();

    expect(rotationSdk.deleteConfig).not.toHaveBeenCalled();
  });

  it("does not remove the rotation config while a job is in progress", async () => {
    const existingConfig = loadedConfig({ hasActiveJob: true });
    const { component, fixture, rotationSdk, dialogService } = setup({
      configId: configId("cfg-1"),
      existingConfig,
    });
    await fixture.whenStable();

    await component.removeRotation();

    expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
    expect(rotationSdk.deleteConfig).not.toHaveBeenCalled();
  });
});
