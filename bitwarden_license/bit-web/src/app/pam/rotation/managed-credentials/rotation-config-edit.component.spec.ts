import { TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, provideRouter } from "@angular/router";
import { BehaviorSubject, of } from "rxjs";

import {
  PamApiService,
  RotationConfigDetailsResponse,
  RotationConfigResponse,
  TargetSystemMethod,
  TargetSystemResponse,
  TargetSystemStatus,
} from "@bitwarden/bit-pam";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { ToastService } from "@bitwarden/components";

import { OrgCiphersService } from "../org-ciphers.service";
import { TargetSystemsService } from "../target-systems/target-systems.service";

import { RotationConfigEditComponent } from "./rotation-config-edit.component";

const i18nFake: Pick<I18nService, "t" | "translate"> = {
  t: (id: string) => id,
  translate: (id: string) => id,
};

function makeTargetRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    Id: "ts-1",
    Name: "Test Target",
    Method: TargetSystemMethod.Automatic,
    Kind: 0,
    Status: TargetSystemStatus.Active,
    PasswordPolicy: null,
    SupportsSessionTermination: true,
    ...overrides,
  };
}

function makeConfigDetailsRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    Id: "cfg-1",
    CipherId: "cipher-1",
    TargetSystemId: "ts-1",
    TargetSystemName: "Target",
    TargetSystemMethod: TargetSystemMethod.Automatic,
    AccountIdentity: "admin@example.com",
    TerminateSessions: false,
    ScheduleCron: "0 0 0 * * ?",
    RotateOnAccessEnd: false,
    Enabled: true,
    LastRotationAt: null,
    NextRotationAt: null,
    HasActiveJob: false,
    AwaitingManualRotation: false,
    Jobs: [],
    ...overrides,
  };
}

type SetupOptions = {
  configId?: string;
  existingConfig?: RotationConfigDetailsResponse | null;
};

function setup(options: SetupOptions = {}) {
  const { configId, existingConfig } = options;

  const target = new TargetSystemResponse(makeTargetRaw());

  const pamApi: jest.Mocked<
    Pick<
      PamApiService,
      | "listRotationConfigs"
      | "getRotationConfig"
      | "createRotationConfig"
      | "updateRotationConfigSettings"
      | "updateRotationConfigAccount"
    >
  > = {
    listRotationConfigs: jest.fn().mockResolvedValue({ data: [], continuationToken: null }),
    getRotationConfig: jest
      .fn()
      .mockResolvedValue(
        existingConfig ?? new RotationConfigDetailsResponse(makeConfigDetailsRaw()),
      ),
    createRotationConfig: jest
      .fn()
      .mockResolvedValue(new RotationConfigResponse(makeConfigDetailsRaw())),
    updateRotationConfigSettings: jest
      .fn()
      .mockResolvedValue(new RotationConfigResponse(makeConfigDetailsRaw())),
    updateRotationConfigAccount: jest
      .fn()
      .mockResolvedValue(new RotationConfigResponse(makeConfigDetailsRaw())),
  };

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
  // so the real implementations (which inject AccountService, PamApiService, etc.)
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
              organizationId: "org-1",
              ...(configId ? { configId } : {}),
            },
          },
        },
      },
      { provide: PamApiService, useValue: pamApi },
      { provide: TargetSystemsService, useValue: targetSystemsService },
      { provide: OrgCiphersService, useValue: orgCiphersService },
      { provide: ToastService, useValue: toastService },
      { provide: I18nService, useValue: i18nFake },
    ],
  });

  const fixture = TestBed.createComponent(RotationConfigEditComponent);
  const component = fixture.componentInstance as any;
  fixture.detectChanges();

  return { fixture, component, pamApi, targetSystemsService, orgCiphersService, toastService };
}

describe("RotationConfigEditComponent — CREATE mode", () => {
  it("starts in create mode when no configId is present", () => {
    const { component } = setup();
    expect(component.editing).toBe(false);
  });

  it("loads target systems and ciphers on init", async () => {
    const { fixture, targetSystemsService, orgCiphersService } = setup();
    await fixture.whenStable();
    expect(targetSystemsService.load).toHaveBeenCalledWith("org-1");
    expect(orgCiphersService.load).toHaveBeenCalledWith("org-1");
  });

  it("calls pamApi.createRotationConfig on valid create submit", async () => {
    const { component, pamApi, fixture } = setup();
    await fixture.whenStable();

    component.createForm.setValue({
      cipherId: "cipher-1",
      targetSystemId: "ts-1",
      accountIdentity: "admin@example.com",
      terminateSessions: false,
      scheduleCron: null,
      rotateOnAccessEnd: false,
    });

    await component.submitCreate();
    expect(pamApi.createRotationConfig).toHaveBeenCalled();
  });

  it("does not call createRotationConfig when form is invalid", async () => {
    const { component, pamApi } = setup();
    // cipherId + targetSystemId empty — form is invalid
    await component.submitCreate();
    expect(pamApi.createRotationConfig).not.toHaveBeenCalled();
  });
});

describe("RotationConfigEditComponent — EDIT mode", () => {
  it("starts in edit mode when configId param is present", () => {
    const { component } = setup({ configId: "cfg-1" });
    expect(component.editing).toBe(true);
  });

  it("fetches the rotation config details on init", async () => {
    const { fixture, pamApi } = setup({ configId: "cfg-1" });
    await fixture.whenStable();
    expect(pamApi.getRotationConfig).toHaveBeenCalledWith("org-1", "cfg-1");
  });

  it("patches settingsForm from the loaded config", async () => {
    const { component, fixture } = setup({ configId: "cfg-1" });
    await fixture.whenStable();
    expect(component.settingsForm.controls.scheduleCron.value).toBe("0 0 0 * * ?");
  });

  it("calls pamApi.updateRotationConfigSettings on settings submit", async () => {
    const { component, fixture, pamApi } = setup({ configId: "cfg-1" });
    await fixture.whenStable();
    await component.submitSettings();
    expect(pamApi.updateRotationConfigSettings).toHaveBeenCalledWith(
      "org-1",
      "cfg-1",
      expect.any(Object),
    );
  });

  it("calls pamApi.updateRotationConfigAccount on account submit", async () => {
    const { component, fixture, pamApi } = setup({ configId: "cfg-1" });
    await fixture.whenStable();
    await component.submitAccount();
    expect(pamApi.updateRotationConfigAccount).toHaveBeenCalledWith(
      "org-1",
      "cfg-1",
      expect.any(Object),
    );
  });

  it("does not submit account when form is invalid", async () => {
    const { component, fixture, pamApi } = setup({ configId: "cfg-1" });
    await fixture.whenStable();
    component.accountForm.controls.accountIdentity.setValue("");
    await component.submitAccount();
    expect(pamApi.updateRotationConfigAccount).not.toHaveBeenCalled();
  });

  it("sets accountFormLocked to true when hasActiveJob is true", async () => {
    const existingConfig = new RotationConfigDetailsResponse(
      makeConfigDetailsRaw({ HasActiveJob: true }),
    );
    const { component, fixture } = setup({ configId: "cfg-1", existingConfig });
    await fixture.whenStable();
    expect(component.accountFormLocked()).toBe(true);
  });

  it("navigates away and toasts on not-found error", async () => {
    const pamApiFailing: any = {
      getRotationConfig: jest.fn().mockRejectedValue(new Error("Not found")),
      listRotationConfigs: jest.fn().mockResolvedValue({ data: [] }),
      updateRotationConfigSettings: jest.fn(),
      updateRotationConfigAccount: jest.fn(),
      createRotationConfig: jest.fn(),
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
            snapshot: { params: { organizationId: "org-1", configId: "missing" } },
          },
        },
        { provide: PamApiService, useValue: pamApiFailing },
        { provide: TargetSystemsService, useValue: targetSystemsStub },
        { provide: OrgCiphersService, useValue: orgCiphersService },
        { provide: ToastService, useValue: toastService },
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
});
