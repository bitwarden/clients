import { ChangeDetectionStrategy, Component, NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import {
  ActivatedRoute,
  Router,
  Routes,
  convertToParamMap,
  provideRouter,
} from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { BehaviorSubject, of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, TabsModule, ToastService } from "@bitwarden/components";

import { OrgCiphersService } from "../org-ciphers.service";
import type {
  RotationConfig,
  RotationConfigDetail,
  RotationConfigId,
  TargetSystem,
} from "../rotation";
import { QuartzSchedulePreset } from "../rotation";
import { ROTATION_TABS, rotationLink } from "../rotation-links";
import { RotationSdkService } from "../rotation-sdk.service";
import { rotationRoutes } from "../rotation.routes";
import { TargetSystemsService } from "../target-systems/target-systems.service";
import {
  CIPHER_ID,
  ORGANIZATION_ID,
  TARGET_SYSTEM_ID,
  configId,
  sysId,
  rotationConfig,
  rotationConfigDetail,
  targetSystem,
} from "../testing/rotation-builders";

import {
  RotationConfigEditComponent,
  rotationConfigEditDiscardGuard,
} from "./rotation-config-edit.component";

const i18nFake: Pick<I18nService, "t" | "translate"> = {
  t: (id: string) => id,
  translate: (id: string) => id,
};

const ORG_ID = ORGANIZATION_ID;

// JSDOM implements no ResizeObserver.
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

/** The daily preset the loaded config sits on; the rest of the table resolves to nothing. */
const DAILY_CRON = "0 0 0 * * ?";

/**
 * Stands in for the rotation shell route.
 */
const ROUTE_PARENT = { snapshot: { params: {} } };

/** The config the edit page loads: daily schedule, idle, automatic. */
function loadedConfig(overrides: Partial<RotationConfig> = {}): RotationConfigDetail {
  return rotationConfigDetail({
    config: rotationConfig({
      id: configId("cfg-1"),
      accountIdentity: "admin@example.com",
      scheduleCron: DAILY_CRON,
      ...overrides,
    }),
  });
}

type SetupOptions = {
  configId?: RotationConfigId;
  existingConfig?: RotationConfigDetail | null;
  /** Route query params, for the create page's `?targetSystemId=` handoff. */
  queryParams?: Record<string, string>;
  /** The target systems the picker sees; defaults to one active target. */
  targetSystems?: TargetSystem[];
  /** The `:tab` segment the edit page is opened on. */
  tab?: string;
  /** Render the page's own markup instead of the stub, for the specs that read the DOM. */
  template?: "real";
  /** Fails the org-wide read the create form's pickers are built from. */
  listConfigsRejects?: boolean;
  /** Fails the target-system read, which reports on `loadError$` instead of rejecting. */
  targetSystemsLoadFails?: boolean;
  /** Fails the read of the config the edit page's URL names. */
  getConfigRejects?: boolean;
};

function setup(options: SetupOptions = {}) {
  const {
    configId,
    existingConfig,
    queryParams,
    targetSystems,
    tab = "configuration",
    template,
    listConfigsRejects = false,
    targetSystemsLoadFails = false,
    getConfigRejects = false,
  } = options;

  const target = targetSystem();

  const rotationSdk: jest.Mocked<
    Pick<
      RotationSdkService,
      | "listConfigs"
      | "getConfig"
      | "createConfig"
      | "updateConfig"
      | "deleteConfig"
      | "presetForCron"
      | "cronForPreset"
      | "isLikelyQuartzCron"
    >
  > = {
    listConfigs: listConfigsRejects
      ? jest.fn().mockRejectedValue(new Error("boom"))
      : jest.fn().mockResolvedValue([]),
    getConfig: getConfigRejects
      ? jest.fn().mockRejectedValue(new Error("boom"))
      : jest.fn().mockResolvedValue(existingConfig ?? loadedConfig()),
    createConfig: jest.fn().mockResolvedValue(loadedConfig()),
    updateConfig: jest.fn().mockResolvedValue(loadedConfig()),
    deleteConfig: jest.fn().mockResolvedValue(undefined),
    presetForCron: jest.fn(async (cron: string | null) =>
      cron === DAILY_CRON ? QuartzSchedulePreset.Daily : QuartzSchedulePreset.None,
    ),
    cronForPreset: jest.fn(async (preset: QuartzSchedulePreset) =>
      preset === QuartzSchedulePreset.Daily ? DAILY_CRON : null,
    ),
    isLikelyQuartzCron: jest.fn().mockResolvedValue(true),
  };

  const dialogService = { openSimpleDialog: jest.fn().mockResolvedValue(true) };

  const targetSystemsLoadError = new BehaviorSubject<unknown | null>(null);
  const targetSystemsService = {
    systems$: new BehaviorSubject(targetSystems ?? [target]),
    loadError$: targetSystemsLoadError,
    load: jest.fn(async () => {
      targetSystemsLoadError.next(targetSystemsLoadFails ? new Error("boom") : null);
    }),
  };

  const orgCiphersService = {
    ciphers$: new BehaviorSubject([] as CipherView[]),
    cipherNameById$: new BehaviorSubject(new Map<string, string>()),
    loading$: new BehaviorSubject(false),
    load: jest.fn().mockResolvedValue(undefined),
  };

  const toastService = { showToast: jest.fn() };

  if (template === "real") {
    TestBed.overrideComponent(RotationConfigEditComponent, {
      remove: { imports: [TabsModule] },
      add: { schemas: [NO_ERRORS_SCHEMA] },
    });
  } else {
    TestBed.overrideComponent(RotationConfigEditComponent, {
      set: { template: "<div>stub</div>", imports: [] },
    });
  }

  // Overrides component-level providers so the real implementations are never instantiated;
  // component-level providers shadow module-level mocks.
  TestBed.overrideProvider(OrgCiphersService, { useValue: orgCiphersService });
  TestBed.overrideProvider(TargetSystemsService, { useValue: targetSystemsService });

  const routeParams = {
    organizationId: ORGANIZATION_ID,
    ...(configId ? { configId, tab } : {}),
  };

  TestBed.configureTestingModule({
    imports: [RotationConfigEditComponent, ReactiveFormsModule, NoopAnimationsModule],
    providers: [
      provideRouter([{ path: "**", children: [] }]),
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            params: routeParams,
            queryParams: queryParams ?? {},
          },
          paramMap: of(convertToParamMap(routeParams)),
          parent: ROUTE_PARENT,
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

/** An edit page rendered from its own template, settled, for the specs that read the DOM. */
async function renderPage(
  options: SetupOptions = {},
): Promise<ComponentFixture<RotationConfigEditComponent>> {
  const { fixture } = setup({ configId: configId("cfg-1"), template: "real", ...options });
  await fixture.whenStable();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

/** One of the action row's buttons, by the id the template gives it. */
function actionButton(
  fixture: ComponentFixture<RotationConfigEditComponent>,
  name: "save" | "delete",
): HTMLButtonElement | null {
  return fixture.nativeElement.querySelector(`#rotation-config-edit_button_${name}`);
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

  it("sends the credential, the target and the settings the operator picked", async () => {
    const { component, rotationSdk, fixture } = setup();
    await fixture.whenStable();

    component.createForm.setValue({
      cipherId: CIPHER_ID,
      targetSystemId: TARGET_SYSTEM_ID,
      accountIdentity: "admin@example.com",
      terminateSessions: true,
      scheduleCron: DAILY_CRON,
      rotateOnAccessEnd: true,
    });

    await component.submitCreate();

    expect(rotationSdk.createConfig).toHaveBeenCalledWith(ORG_ID, {
      cipherId: CIPHER_ID,
      targetSystemId: TARGET_SYSTEM_ID,
      accountIdentity: "admin@example.com",
      terminateSessions: true,
      scheduleCron: DAILY_CRON,
      rotateOnAccessEnd: true,
    });
  });

  it("reports a refused create and stays on the form", async () => {
    const { component, rotationSdk, fixture, toastService } = setup();
    await fixture.whenStable();
    rotationSdk.createConfig.mockRejectedValue(new Error("boom"));
    const nav = jest.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);

    component.createForm.setValue({
      cipherId: CIPHER_ID,
      targetSystemId: TARGET_SYSTEM_ID,
      accountIdentity: "admin@example.com",
      terminateSessions: false,
      scheduleCron: null,
      rotateOnAccessEnd: false,
    });
    await component.submitCreate();

    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error" }),
    );
    expect(nav).not.toHaveBeenCalled();
  });

  it("clears session termination when the picked target cannot terminate", async () => {
    const manual = targetSystem({
      id: sysId("sys-manual"),
      method: "manual",
      kind: null,
      supportsSessionTermination: false,
    } as Partial<TargetSystem>);
    const { component, rotationSdk, fixture } = setup({ targetSystems: [targetSystem(), manual] });
    await fixture.whenStable();

    component.createForm.controls.cipherId.setValue(CIPHER_ID);
    component.createForm.controls.accountIdentity.setValue("admin@example.com");
    component.createForm.controls.targetSystemId.setValue(TARGET_SYSTEM_ID);
    component.createForm.controls.terminateSessions.setValue(true);

    component.createForm.controls.targetSystemId.setValue(String(manual.id));

    expect(component.createForm.controls.terminateSessions.value).toBe(false);
    expect(component.createForm.controls.terminateSessions.disabled).toBe(true);

    await component.submitCreate();

    expect(rotationSdk.createConfig).toHaveBeenCalledWith(
      ORG_ID,
      expect.objectContaining({ terminateSessions: false }),
    );
  });

  it("offers session termination again for a target that supports it", async () => {
    const manual = targetSystem({
      id: sysId("sys-manual"),
      method: "manual",
      kind: null,
      supportsSessionTermination: false,
    } as Partial<TargetSystem>);
    const { component, fixture } = setup({ targetSystems: [targetSystem(), manual] });
    await fixture.whenStable();

    component.createForm.controls.targetSystemId.setValue(String(manual.id));
    component.createForm.controls.targetSystemId.setValue(TARGET_SYSTEM_ID);

    expect(component.createForm.controls.terminateSessions.disabled).toBe(false);
  });
});

describe("RotationConfigEditComponent — target-system handoff", () => {
  it("preselects the target named by ?targetSystemId", async () => {
    const { component, fixture } = setup({
      queryParams: { targetSystemId: TARGET_SYSTEM_ID },
    });
    await fixture.whenStable();

    expect(component.createForm.controls.targetSystemId.value).toBe(TARGET_SYSTEM_ID);
  });

  it("leaves the picker unset when ?targetSystemId names no loaded target", async () => {
    const { component, fixture } = setup({
      queryParams: { targetSystemId: sysId("sys-gone") },
    });
    await fixture.whenStable();

    expect(component.createForm.controls.targetSystemId.value).toBe("");
  });

  it("leaves the picker unset when the named target is disabled", async () => {
    const { component, fixture } = setup({
      queryParams: { targetSystemId: TARGET_SYSTEM_ID },
      targetSystems: [targetSystem({ status: "disabled" } as Partial<TargetSystem>)],
    });
    await fixture.whenStable();

    expect(component.createForm.controls.targetSystemId.value).toBe("");
  });

  it("reports no active target systems when the org has none", async () => {
    const { component, fixture } = setup({ targetSystems: [] });
    await fixture.whenStable();

    expect(component.hasActiveTargetSystems()).toBe(false);
  });

  it("reports no active target systems when every target is disabled", async () => {
    const { component, fixture } = setup({
      targetSystems: [targetSystem({ status: "disabled" } as Partial<TargetSystem>)],
    });
    await fixture.whenStable();

    expect(component.hasActiveTargetSystems()).toBe(false);
  });

  it("does not treat a preselected target as unsaved input", async () => {
    const { component, fixture, dialogService } = setup({
      queryParams: { targetSystemId: TARGET_SYSTEM_ID },
    });
    await fixture.whenStable();

    await expect(component.confirmDiscard()).resolves.toBe(true);
    expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
  });

  describe("load error state", () => {
    /** A create page rendered from its own template, settled, whose supporting reads failed. */
    async function renderFailedCreate() {
      const api = setup({ template: "real", listConfigsRejects: true });
      await api.fixture.whenStable();
      api.fixture.detectChanges();
      return api;
    }

    it("reports the failure instead of a form whose pickers cannot be filled", async () => {
      const { fixture } = await renderFailedCreate();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector("pam-rotation-load-error")).not.toBeNull();
      expect(el.textContent).toContain("pamRotationListLoadErrorTitle");
      expect(el.textContent).not.toContain("pamRotationConfigNoActiveTargetSystems");
      expect(el.querySelector('[data-testid="rotation-config-edit-loading"]')).toBeNull();
    });

    it("reports a failed target-system read rather than an empty picker", async () => {
      const api = setup({ template: "real", targetSystemsLoadFails: true, targetSystems: [] });
      await api.fixture.whenStable();
      api.fixture.detectChanges();

      const el = api.fixture.nativeElement as HTMLElement;
      expect(el.querySelector("pam-rotation-load-error")).not.toBeNull();
      expect(el.textContent).not.toContain("pamRotationConfigNoActiveTargetSystems");
    });

    it("does not announce a failed load as loaded", async () => {
      const { fixture } = await renderFailedCreate();

      expect(
        (fixture.nativeElement as HTMLElement)
          .querySelector('[data-testid="rotation-loading-status"]')!
          .textContent?.trim(),
      ).toBe("");
    });

    it("re-reads from the error state, and shows the form once the reads land", async () => {
      const { fixture, component, rotationSdk } = await renderFailedCreate();
      rotationSdk.listConfigs.mockResolvedValue([]);

      (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLButtonElement>("#rotation-load-error_button_retry")!
        .click();
      await fixture.whenStable();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component.loadError()).toBeNull();
      expect(fixture.nativeElement.querySelector("pam-rotation-load-error")).toBeNull();
      expect(
        fixture.nativeElement.querySelector("#rotation-config-edit_select_cipher"),
      ).not.toBeNull();
    });
  });

  it("navigates to the target-system create page marked to return here", async () => {
    const { component, fixture } = setup();
    await fixture.whenStable();
    const router = TestBed.inject(Router);
    const nav = jest.spyOn(router, "navigate").mockResolvedValue(true);

    await component.createTargetSystem();

    expect(nav).toHaveBeenCalledWith(
      ["target-systems", "new"],
      expect.objectContaining({
        relativeTo: ROUTE_PARENT,
        queryParams: { then: "managed-credential" },
      }),
    );
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
   * The server takes the schedule and the account in one write.
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

  /**
   * Every field on the Configuration tab is part of `editForm`.
   */
  it("holds a changed schedule and account back until Save", async () => {
    const { component, fixture, rotationSdk } = setup({ configId: configId("cfg-1") });
    await fixture.whenStable();

    component.settingsForm.controls.rotateOnAccessEnd.setValue(true);
    component.accountForm.controls.terminateSessions.setValue(true);
    await fixture.whenStable();

    expect(rotationSdk.updateConfig).not.toHaveBeenCalled();

    await component.submitEdit();

    expect(rotationSdk.updateConfig).toHaveBeenCalledWith(
      ORG_ID,
      configId("cfg-1"),
      expect.objectContaining({ rotateOnAccessEnd: true, terminateSessions: true }),
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

  describe("load error state", () => {
    /** An edit page rendered from its own template, settled, whose config read failed. */
    async function renderFailedEdit() {
      const api = setup({ configId: configId("cfg-1"), template: "real", getConfigRejects: true });
      const nav = jest.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);
      await api.fixture.whenStable();
      api.fixture.detectChanges();
      return { ...api, nav };
    }

    it("stays on the page and reports the failure rather than bouncing to the list", async () => {
      const { fixture, toastService, nav } = await renderFailedEdit();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector("pam-rotation-load-error")).not.toBeNull();
      expect(el.textContent).toContain("pamRotationListLoadErrorTitle");
      expect(el.querySelector('[data-testid="rotation-config-edit-loading"]')).toBeNull();
      expect(nav).not.toHaveBeenCalled();
      expect(toastService.showToast).not.toHaveBeenCalled();
    });

    it("does not announce a failed read as loaded", async () => {
      const { fixture } = await renderFailedEdit();

      expect(
        (fixture.nativeElement as HTMLElement)
          .querySelector('[data-testid="rotation-loading-status"]')!
          .textContent?.trim(),
      ).toBe("");
    });

    it("re-reads the config from the error state, and shows it once it lands", async () => {
      const { fixture, component, rotationSdk } = await renderFailedEdit();
      rotationSdk.getConfig.mockResolvedValue(loadedConfig());

      (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLButtonElement>("#rotation-load-error_button_retry")!
        .click();
      await fixture.whenStable();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(rotationSdk.getConfig).toHaveBeenCalledTimes(2);
      expect(component.loadError()).toBeNull();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector("pam-rotation-load-error")).toBeNull();
      expect(el.querySelector("#rotation-config-edit_input_account-identity-edit")).not.toBeNull();
    });

    it("renders the config when the read lands first time", async () => {
      const fixture = await renderPage();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector("pam-rotation-load-error")).toBeNull();
      expect(el.querySelector("#rotation-config-edit_input_account-identity-edit")).not.toBeNull();
    });
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

  it("does not remove the rotation config when confirmation is canceled", async () => {
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

  /**
   * The three catch blocks are all that stand between a refused write and a silent no-op.
   */
  describe("a refused write", () => {
    it("reports a refused save and leaves the page unsaved", async () => {
      const { component, fixture, rotationSdk, dialogService, toastService } = setup({
        configId: configId("cfg-1"),
      });
      await fixture.whenStable();
      rotationSdk.updateConfig.mockRejectedValue(new Error("boom"));
      component.accountForm.controls.accountIdentity.setValue("svc_rotation");

      await component.submitEdit();

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
      await component.confirmDiscard();
      expect(dialogService.openSimpleDialog).toHaveBeenCalled();
    });

    it("reports a refused removal and stays on the page", async () => {
      const { component, fixture, rotationSdk, dialogService, toastService } = setup({
        configId: configId("cfg-1"),
      });
      await fixture.whenStable();
      dialogService.openSimpleDialog.mockResolvedValue(true);
      rotationSdk.deleteConfig.mockRejectedValue(new Error("in flight"));
      const nav = jest.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);

      await component.removeRotation();

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
      expect(nav).not.toHaveBeenCalled();
    });
  });

  describe("cancel", () => {
    it("leaves by the list route once the discard is confirmed, and does not ask again", async () => {
      const { component, fixture, dialogService } = setup({ configId: configId("cfg-1") });
      await fixture.whenStable();
      component.accountForm.controls.accountIdentity.setValue("svc_rotation");
      dialogService.openSimpleDialog.mockResolvedValue(true);
      const nav = jest.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);

      await component.cancel();

      expect(nav).toHaveBeenCalledWith([
        "/organizations",
        ORG_ID,
        "pam",
        "rotation",
        "managed-credentials",
      ]);
      await expect(component.confirmDiscard()).resolves.toBe(true);
      expect(dialogService.openSimpleDialog).toHaveBeenCalledTimes(1);
    });

    it("stays on the page when the discard is declined", async () => {
      const { component, fixture, dialogService } = setup({ configId: configId("cfg-1") });
      await fixture.whenStable();
      component.accountForm.controls.accountIdentity.setValue("svc_rotation");
      dialogService.openSimpleDialog.mockResolvedValue(false);
      const nav = jest.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);

      await component.cancel();

      expect(nav).not.toHaveBeenCalled();
    });
  });
});

describe("RotationConfigEditComponent — discard guard", () => {
  const CREATE_DIALOG = {
    title: { key: "pamRotationConfigDiscardTitle" },
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

  function runGuard(component: RotationConfigEditComponent): Promise<boolean> {
    return rotationConfigEditDiscardGuard(
      component,
      null as never,
      null as never,
      null as never,
    ) as Promise<boolean>;
  }

  it("leaves an untouched create form without asking", async () => {
    const { component, fixture, dialogService } = setup();
    await fixture.whenStable();

    await expect(runGuard(component)).resolves.toBe(true);
    expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
  });

  /**
   * `savedValue` is only filled once `initialize()` settles, so until then it holds no snapshot and
   * the value comparison alone would treat the form's own defaults as unsaved input. There is
   * nothing to discard yet; leaving must be free.
   */
  describe("while the page is still loading", () => {
    it("leaves an edit page mid-load without asking", async () => {
      const { component, fixture, dialogService } = setup({ configId: configId("cfg-1") });

      expect(component.loading()).toBe(true);
      await expect(runGuard(component)).resolves.toBe(true);
      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();

      await fixture.whenStable();
    });

    it("leaves a create page mid-load without asking", async () => {
      const { component, fixture, dialogService } = setup();

      expect(component.loading()).toBe(true);
      await expect(runGuard(component)).resolves.toBe(true);
      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();

      await fixture.whenStable();
    });

    /** The short-circuit must lift with the load, not suppress the prompt for the page's life. */
    it("asks again once the load has settled and the operator has edited", async () => {
      const { component, fixture, dialogService } = setup({ configId: configId("cfg-1") });

      await expect(runGuard(component)).resolves.toBe(true);

      await fixture.whenStable();
      component.accountForm.controls.accountIdentity.setValue("svc_rotation");

      await expect(runGuard(component)).resolves.toBe(true);
      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(EDIT_DIALOG);
    });
  });

  it("leaves a create form the schedule editor only re-emitted into without asking", async () => {
    const { component, fixture, dialogService } = setup();
    await fixture.whenStable();
    component.createForm.controls.scheduleCron.setValue(null);
    component.createForm.controls.scheduleCron.markAsDirty();

    await expect(runGuard(component)).resolves.toBe(true);
    expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
  });

  it("leaves an edit form the schedule editor only re-emitted into without asking", async () => {
    const { component, fixture, dialogService } = setup({ configId: configId("cfg-1") });
    await fixture.whenStable();
    component.settingsForm.controls.scheduleCron.setValue("0 0 0 * * ?");
    component.settingsForm.controls.scheduleCron.markAsDirty();

    await expect(runGuard(component)).resolves.toBe(true);
    expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
  });

  it("asks about a changed schedule", async () => {
    const { component, fixture, dialogService } = setup({ configId: configId("cfg-1") });
    await fixture.whenStable();
    component.settingsForm.controls.scheduleCron.setValue("0 0 */4 * * ?");

    await expect(runGuard(component)).resolves.toBe(true);
    expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(EDIT_DIALOG);
  });

  it("asks about an abandoned new managed credential", async () => {
    const { component, fixture, dialogService } = setup();
    await fixture.whenStable();
    component.createForm.controls.accountIdentity.setValue("admin@example.com");

    await expect(runGuard(component)).resolves.toBe(true);
    expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(CREATE_DIALOG);
  });

  it("asks about unsaved edits made in either card", async () => {
    const { component, fixture, dialogService } = setup({ configId: configId("cfg-1") });
    await fixture.whenStable();
    component.accountForm.controls.accountIdentity.setValue("svc_rotation");

    await expect(runGuard(component)).resolves.toBe(true);
    expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(EDIT_DIALOG);
  });

  it("stays on the page when the operator keeps editing", async () => {
    const { component, fixture, dialogService } = setup({ configId: configId("cfg-1") });
    await fixture.whenStable();
    dialogService.openSimpleDialog.mockResolvedValue(false);
    component.accountForm.controls.accountIdentity.setValue("svc_rotation");

    await expect(runGuard(component)).resolves.toBe(false);
  });

  it("does not ask after a successful save", async () => {
    const { component, fixture, dialogService } = setup({ configId: configId("cfg-1") });
    await fixture.whenStable();
    component.accountForm.controls.accountIdentity.setValue("svc_rotation");

    await component.submitEdit();

    await expect(runGuard(component)).resolves.toBe(true);
    expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
  });

  it("does not ask again after the credential is removed", async () => {
    const { component, fixture, dialogService } = setup({ configId: configId("cfg-1") });
    await fixture.whenStable();
    component.accountForm.controls.accountIdentity.setValue("svc_rotation");

    await component.removeRotation();

    await expect(runGuard(component)).resolves.toBe(true);
    expect(dialogService.openSimpleDialog).toHaveBeenCalledTimes(1);
  });
});

describe("RotationConfigEditComponent — tabs", () => {
  it("opens on Configuration by default", async () => {
    const { component, fixture } = setup({ configId: configId("cfg-1") });
    await fixture.whenStable();

    expect(component.activeTab()).toBe("configuration");
  });

  it("reads the open tab from the route", async () => {
    const { component, fixture } = setup({ configId: configId("cfg-1"), tab: "history" });
    await fixture.whenStable();

    expect(component.activeTab()).toBe("history");
  });

  it("falls back to Configuration for a tab segment it does not know", async () => {
    const { component, fixture } = setup({ configId: configId("cfg-1"), tab: "nonsense" });
    await fixture.whenStable();

    expect(component.activeTab()).toBe("configuration");
  });

  it("routes each tab to a URL of its own", async () => {
    const { component, fixture } = setup({ configId: configId("cfg-1") });
    await fixture.whenStable();

    const base = ["/organizations", ORG_ID, "pam", "rotation", "managed-credentials"];
    expect(component.configurationTabRoute).toEqual([...base, configId("cfg-1"), "configuration"]);
    expect(component.historyTabRoute).toEqual([...base, configId("cfg-1"), "history"]);
  });

  it("leaves for the list by its absolute route, which the extra tab segment would break", async () => {
    const { component, fixture } = setup({ configId: configId("cfg-1"), tab: "history" });
    await fixture.whenStable();
    const nav = jest.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);

    await component.removeRotation();

    expect(nav).toHaveBeenCalledWith([
      "/organizations",
      ORG_ID,
      "pam",
      "rotation",
      "managed-credentials",
    ]);
  });
});

/**
 * The two tab links the page renders are only as good as the route table behind them, and that
 * table is a sibling of the shell rather than part of it, so nothing the page renders would catch
 * a missing `:tab` layer. Resolved against the real table, with its pages stubbed out.
 */
describe("RotationConfigEditComponent — tab routes", () => {
  @Component({
    template: "",
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
  })
  class StubComponent {}

  // Route-level providers and guards go with the pages they belong to, so what is left under test
  // is the path vocabulary.
  const pathsOnly = (config: Routes): Routes =>
    config.map((route) => ({
      ...route,
      providers: undefined,
      canDeactivate: undefined,
      ...(route.component ? { component: StubComponent } : {}),
      ...(route.children ? { children: pathsOnly(route.children) } : {}),
    }));

  const CONFIG_ID = String(configId("cfg-1"));
  const ROTATION_URL = `/organizations/${ORG_ID}/pam/rotation`;

  /** The link the page builds for one of its tabs, as an absolute router link. */
  const tabLink = (...rest: string[]) =>
    rotationLink(ORG_ID, ROTATION_TABS.managedCredentials, CONFIG_ID, ...rest);

  const tabUrl = (tab: string) =>
    `${ROTATION_URL}/${ROTATION_TABS.managedCredentials}/${CONFIG_ID}/${tab}`;

  let router: Router;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: "organizations/:organizationId/pam/rotation",
            children: pathsOnly(rotationRoutes),
          },
        ]),
      ],
    });
    router = TestBed.inject(Router);
    await RouterTestingHarness.create();
  });

  it("resolves the Configuration tab link", async () => {
    expect(await router.navigate(tabLink("configuration"))).toBe(true);
    expect(router.url).toBe(tabUrl("configuration"));
  });

  it("resolves the History tab link", async () => {
    expect(await router.navigate(tabLink("history"))).toBe(true);
    expect(router.url).toBe(tabUrl("history"));
  });

  it("sends an edit URL with no tab segment to Configuration", async () => {
    await router.navigate(tabLink());

    expect(router.url).toBe(tabUrl("configuration"));
  });

  /** An unknown segment is the page's to interpret, as `activeTab` does, rather than a dead URL. */
  it("resolves a tab segment the page does not know", async () => {
    expect(await router.navigate(tabLink("nonsense"))).toBe(true);
  });

  it("leaves the create page on its own literal path", async () => {
    await router.navigate(rotationLink(ORG_ID, ROTATION_TABS.managedCredentials, "new"));

    expect(router.url).toBe(`${ROTATION_URL}/${ROTATION_TABS.managedCredentials}/new`);
  });
});

describe("RotationConfigEditComponent — action row", () => {
  it("puts Save and Delete in one row, Save first", async () => {
    const fixture = await renderPage();

    const save = actionButton(fixture, "save")!;
    const remove = actionButton(fixture, "delete")!;

    expect(save).not.toBeNull();
    expect(remove).not.toBeNull();
    expect(remove.parentElement).toBe(save.parentElement);
    expect(save.parentElement!.firstElementChild).toBe(save);
    expect(save.parentElement!.lastElementChild).toBe(remove);
  });

  it("pushes Delete to the far end of the row", async () => {
    const fixture = await renderPage();

    expect(actionButton(fixture, "delete")!.classList.contains("tw-ms-auto")).toBe(true);
  });

  it("leaves the removal in the form rather than a card of its own", async () => {
    const fixture = await renderPage();
    const remove = actionButton(fixture, "delete")!;

    expect(remove.closest("form")).not.toBeNull();
    expect(remove.closest("bit-card")).toBeNull();
  });

  it("offers neither Save nor Delete on the History tab", async () => {
    const fixture = await renderPage({ tab: "history" });

    expect(fixture.nativeElement.querySelector("form")).toBeNull();
    expect(actionButton(fixture, "save")).toBeNull();
    expect(actionButton(fixture, "delete")).toBeNull();
  });

  it("disables Delete and says why while a rotation job is in flight", async () => {
    const fixture = await renderPage({ existingConfig: loadedConfig({ hasActiveJob: true }) });

    const remove = fixture.debugElement.query(By.css("#rotation-config-edit_button_delete"));
    expect(remove.componentInstance.disabled()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain(
      "pamRotationConfigRemoveLockedContentConnector",
    );
  });

  it("keeps Delete live while no job is running", async () => {
    const fixture = await renderPage();

    const remove = fixture.debugElement.query(By.css("#rotation-config-edit_button_delete"));
    expect(remove.componentInstance.disabled()).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain(
      "pamRotationConfigRemoveLockedContentConnector",
    );
  });
});

describe("RotationConfigEditComponent — loading skeleton", () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ["nextTick", "queueMicrotask", "setImmediate"] });
  });

  afterEach(() => jest.useRealTimers());

  /**
   * Runs the placeholder's clock on.
   */
  function advance(fixture: ComponentFixture<RotationConfigEditComponent>, ms: number): void {
    fixture.detectChanges();
    jest.advanceTimersByTime(ms);
    fixture.detectChanges();
  }

  /** The page mid-load: `setup` renders before the config read resolves. */
  function renderLoading(options: SetupOptions = {}) {
    const { fixture } = setup({ configId: configId("cfg-1"), template: "real", ...options });
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  /** The page mid-load with its placeholder already drawn. */
  function renderSkeleton(options: SetupOptions = {}) {
    const rendered = renderLoading(options);
    advance(rendered.fixture, 1000);
    return rendered;
  }

  async function settle(fixture: ComponentFixture<RotationConfigEditComponent>) {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it("stands skeleton fields in for the form, inside the real card furniture", () => {
    const { el } = renderSkeleton();
    const loading = el.querySelector('[data-testid="rotation-config-edit-loading"]');

    expect(el.querySelector("bit-spinner")).toBeNull();
    expect(loading).not.toBeNull();
    expect(loading!.querySelector("bit-skeleton")).not.toBeNull();
    expect(loading!.textContent).toContain("pamRotationConfigDetailsHeading");
    expect(loading!.textContent).toContain("pamRotationConfigAccountHeading");
    expect(el.querySelector("form")).toBeNull();
  });

  it("keeps the placeholder itself out of the accessibility tree", () => {
    const { el } = renderLoading();

    expect(
      el.querySelector('[data-testid="rotation-config-edit-loading"]')!.getAttribute("aria-hidden"),
    ).toBe("true");
  });

  it("mirrors the history table instead when the history tab is the one loading", () => {
    const { el } = renderSkeleton({ tab: "history" });
    const loading = el.querySelector('[data-testid="rotation-config-edit-loading"]');

    expect(loading!.querySelector("app-rotation-history-skeleton")).not.toBeNull();
    expect(loading!.textContent).toContain("pamRotationHistoryColumnResult");
    expect(loading!.textContent).not.toContain("pamRotationConfigAccountHeading");
  });

  it("shows the create page's own fields when there is no config to read", () => {
    const { fixture } = setup({ template: "real" });
    advance(fixture, 1000);
    const el = fixture.nativeElement as HTMLElement;
    const loading = el.querySelector('[data-testid="rotation-config-edit-loading"]');

    expect(loading).not.toBeNull();
    expect(loading!.textContent).toContain("pamRotationConfigCreateHeading");
    expect(loading!.textContent).not.toContain("pamRotationConfigDetailsHeading");
  });

  it("announces the load from a live region, then the arrival", async () => {
    const { fixture, el } = renderSkeleton();

    const status = el.querySelector('[data-testid="rotation-loading-status"]');
    expect(status!.getAttribute("role")).toBe("status");
    expect(status!.getAttribute("aria-live")).toBe("polite");
    expect(status!.textContent).toContain("loading");

    await settle(fixture);
    advance(fixture, 1000);

    expect(el.querySelector('[data-testid="rotation-loading-status"]')!.textContent).toContain(
      "pamRotationPageLoaded",
    );
  });

  it("replaces the skeleton with the real form once the config lands", async () => {
    const { fixture, el } = renderSkeleton();

    await settle(fixture);
    advance(fixture, 1000);

    expect(el.querySelector('[data-testid="rotation-config-edit-loading"]')).toBeNull();
    expect(el.querySelector("bit-skeleton")).toBeNull();
    expect(el.querySelector("form")).not.toBeNull();
  });

  it("renders the page's own chrome, not a blank area, before the delay is up", () => {
    const { fixture, el } = renderLoading();
    advance(fixture, 999);

    expect(el.querySelector('[data-testid="rotation-config-edit-loading"]')).not.toBeNull();
    expect(el.querySelector("bit-skeleton")).toBeNull();
    expect(el.querySelector("pam-detail-breadcrumb")).not.toBeNull();
  });

  it("never draws the placeholder for a config that arrives inside the delay", async () => {
    const { fixture, el } = renderLoading();
    advance(fixture, 500);

    await settle(fixture);
    advance(fixture, 1000);

    expect(el.querySelector("bit-skeleton")).toBeNull();
    expect(el.querySelector('[data-testid="rotation-config-edit-loading"]')).toBeNull();
    expect(el.querySelector("form")).not.toBeNull();
  });

  it("holds the placeholder its minimum time once it is up, so it cannot blink", async () => {
    const { fixture, el } = renderSkeleton();
    expect(el.querySelector("bit-skeleton")).not.toBeNull();

    await settle(fixture);
    advance(fixture, 300);

    expect(el.querySelector("bit-skeleton")).not.toBeNull();

    advance(fixture, 700);

    expect(el.querySelector("bit-skeleton")).toBeNull();
    expect(el.querySelector("form")).not.toBeNull();
  });

  it("announces the load at once, not on the placeholder's clock", () => {
    const { el } = renderLoading();

    expect(el.querySelector('[data-testid="rotation-loading-status"]')!.textContent).toContain(
      "loading",
    );
    expect(el.querySelector("bit-skeleton")).toBeNull();
  });
});
