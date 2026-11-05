import { DomPortalOutlet, TemplatePortal } from "@angular/cdk/portal";
import { LOCALE_ID } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { formatTimestamp } from "@bitwarden/bit-pam";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import {
  DialogService,
  LayoutFooterService,
  SelectItemView,
  ToastService,
} from "@bitwarden/components";
import type { CipherId } from "@bitwarden/sdk-internal";

import { leaveThroughGuard } from "../../testing/unsaved-changes";
import { OrgCiphersService } from "../org-ciphers.service";
import { AccessConnectorStatus, TargetSystemKind, TargetSystemStatus } from "../rotation";
import type {
  AccessConnector,
  AccessConnectorDetail,
  RotationConfigView,
  TargetSystemView,
} from "../rotation";
import { RotationSdkService } from "../rotation-sdk.service";
import {
  CIPHER_ID,
  ORGANIZATION_ID,
  accessConnector,
  accessConnectorDetail,
  configId,
  connectorId,
  rotationConfig,
  rotationJob,
  sysId,
  targetSystem,
  targetSystemSealedFields,
} from "../testing/rotation-builders";

import {
  AccessConnectorAssignment,
  AccessConnectorCallout,
  AccessConnectorDetailComponent,
} from "./access-connector-detail.component";

/** Echoes the key, with the qualified-name key rendered so its two halves stay readable. */
const i18nFake: Pick<I18nService, "t" | "translate"> = {
  t: (id: string, p1?: string | number, p2?: string | number) =>
    id === "pamTargetSystemNameWithDetail" ? `${p1} (${p2})` : id,
  translate: (id: string) => id,
};

type DetailApi = {
  titleText: () => string;
  activeTab: () => string;
  enabled: () => boolean;
  statusBadge: () => { labelKey: string; variant: string; icon: string } | null;
  callout: () => AccessConnectorCallout;
  assignments: () => AccessConnectorAssignment[];
  selectOptions: () => SelectItemView[];
  selectedItems: () => SelectItemView[];
  pickerHintKey: () => string;
  showFooter: () => boolean;
  onSelectionChanged: (items: SelectItemView[] | null) => void;
  unassignTarget: (assignment: AccessConnectorAssignment) => void;
  discardEdits: () => void;
  submit: () => Promise<void>;
  activate: () => Promise<void>;
  deactivate: () => Promise<void>;
  deleteAccessConnector: () => Promise<void>;
  unsavedChanges: () => boolean;
  accessConnector: () => AccessConnectorDetail | null;
};

const CONNECTOR_ID = connectorId("access-connector-1");

function makeAccessConnector(overrides: Partial<AccessConnector> = {}): AccessConnectorDetail {
  return accessConnectorDetail({
    connector: accessConnector({
      id: CONNECTOR_ID,
      name: "East datacenter",
      assignedTargetSystemIds: [sysId("ts-1")],
      ...overrides,
    }),
  });
}

function makeSystem(): TargetSystemView {
  return targetSystem({ id: sysId("ts-1"), name: "Prod Entra" });
}

function makeOtherSystem(): TargetSystemView {
  return targetSystem({
    id: sysId("ts-2"),
    name: "Prod scripted host",
    sealed: targetSystemSealedFields({ kind: TargetSystemKind.CustomScript }),
  });
}

/** A second target sharing the first's name, differing only in its integration. */
function makeSameNamedSystem(): TargetSystemView {
  return targetSystem({
    id: sysId("ts-2"),
    name: "Prod Entra",
    sealed: targetSystemSealedFields({ kind: TargetSystemKind.CustomScript }),
  });
}

function item(system: TargetSystemView): SelectItemView {
  return { id: String(system.id), listName: system.name, labelName: system.name };
}

function providers(
  rotationSdk: ReturnType<typeof mock<RotationSdkService>>,
  dialogService: ReturnType<typeof mock<DialogService>>,
  toastService: ReturnType<typeof mock<ToastService>>,
  tab: string,
) {
  const params = { organizationId: ORGANIZATION_ID, accessConnectorId: CONNECTOR_ID, tab };
  return [
    provideRouter([]),
    { provide: RotationSdkService, useValue: rotationSdk },
    { provide: I18nService, useValue: i18nFake },
    { provide: ToastService, useValue: toastService },
    { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
    { provide: DialogService, useValue: dialogService },
    { provide: AccountService, useValue: mock<AccountService>() },
    { provide: OrganizationService, useValue: mock<OrganizationService>() },
    { provide: CipherService, useValue: mock<CipherService>() },
    {
      provide: ActivatedRoute,
      useValue: { snapshot: { params }, paramMap: of(convertToParamMap(params)) },
    },
  ];
}

describe("AccessConnectorDetailComponent", () => {
  let fixture: ComponentFixture<AccessConnectorDetailComponent>;
  let rotationSdk: ReturnType<typeof mock<RotationSdkService>>;
  let dialog: ReturnType<typeof mock<DialogService>>;
  let toastService: ReturnType<typeof mock<ToastService>>;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const query = <T extends Element = HTMLElement>(selector: string): T | null =>
    el().querySelector<T>(selector);

  async function setup({
    renderTemplate = false,
    tab = "configuration",
    cipherNames,
  }: { renderTemplate?: boolean; tab?: string; cipherNames?: Map<CipherId, string> } = {}) {
    if (!renderTemplate) {
      TestBed.overrideComponent(AccessConnectorDetailComponent, {
        set: { template: "", imports: [] },
      });
    }
    if (cipherNames != null) {
      TestBed.overrideProvider(OrgCiphersService, {
        useValue: {
          ciphers$: of([]),
          cipherNameById$: of(cipherNames),
          loading$: of(false),
          load: jest.fn().mockResolvedValue(undefined),
        },
      });
    }
    await TestBed.configureTestingModule({
      imports: [AccessConnectorDetailComponent, NoopAnimationsModule],
      providers: providers(rotationSdk, dialog, toastService, tab),
    }).compileComponents();
  }

  /** Creates the component and settles the loads its constructor starts. */
  async function createComponent(): Promise<DetailApi> {
    fixture = TestBed.createComponent(AccessConnectorDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.componentInstance as unknown as DetailApi;
  }

  async function mount(
    detail = makeAccessConnector(),
    options: { renderTemplate?: boolean; tab?: string; cipherNames?: Map<CipherId, string> } = {},
  ): Promise<DetailApi> {
    rotationSdk.getConnector.mockResolvedValue(detail);
    await setup(options);
    return await createComponent();
  }

  beforeEach(() => {
    rotationSdk = mock<RotationSdkService>();
    rotationSdk.listTargetSystems.mockResolvedValue([makeSystem()]);
    rotationSdk.listConnectors.mockResolvedValue([]);
    dialog = mock<DialogService>();
    dialog.openSimpleDialog.mockResolvedValue(true);
    toastService = mock<ToastService>();
  });

  afterEach(() => TestBed.resetTestingModule());

  it("loads the access connector on init", async () => {
    const comp = await mount();

    expect(rotationSdk.getConnector).toHaveBeenCalledWith(ORGANIZATION_ID, CONNECTOR_ID);
    expect(comp.titleText()).toBe("East datacenter");
  });

  it("stages the saved assignments, so nothing starts unsaved", async () => {
    const comp = await mount();

    expect(comp.assignments().map((a) => a.targetSystemId)).toEqual([sysId("ts-1")]);
    expect(comp.unsavedChanges()).toBe(false);
    expect(comp.showFooter()).toBe(false);
  });

  it("resolves assignment ids to target-system names, types and ids", async () => {
    const comp = await mount();

    expect(comp.assignments()).toEqual([
      {
        id: String(sysId("ts-1")),
        targetSystemId: sysId("ts-1"),
        idText: uuidAsString(sysId("ts-1")),
        name: "Prod Entra",
        label: "Prod Entra (pamTargetSystemTypeEntra)",
        typeKey: "pamTargetSystemTypeEntra",
        statusBadge: expect.objectContaining({ labelKey: "pamTargetSystemStatusActive" }),
      },
    ]);
  });

  it("tells two same-named assignments apart by their integration", async () => {
    rotationSdk.listTargetSystems.mockResolvedValue([makeSystem(), makeSameNamedSystem()]);
    const comp = await mount(
      makeAccessConnector({ assignedTargetSystemIds: [sysId("ts-1"), sysId("ts-2")] }),
    );

    expect(comp.assignments().map((a) => a.label)).toEqual([
      "Prod Entra (pamTargetSystemTypeEntra)",
      "Prod Entra (pamTargetSystemTypeCustomScript)",
    ]);
  });

  describe("load error state", () => {
    it("stays on the page and reports the failure rather than bouncing to the list", async () => {
      rotationSdk.getConnector.mockRejectedValue(new Error("boom"));
      await setup({ renderTemplate: true });
      const nav = jest.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);

      await createComponent();

      expect(query("pam-rotation-load-error")).not.toBeNull();
      expect(el().textContent).toContain("pamRotationListLoadErrorTitle");
      expect(query('[data-testid="access-connector-detail-loading"]')).toBeNull();
      expect(nav).not.toHaveBeenCalled();
    });

    it("does not announce a failed read as loaded", async () => {
      rotationSdk.getConnector.mockRejectedValue(new Error("boom"));
      await setup({ renderTemplate: true });

      await createComponent();

      expect(query('[data-testid="rotation-loading-status"]')!.textContent?.trim()).toBe("");
    });

    it("re-reads the connector from the error state, and shows it once it lands", async () => {
      rotationSdk.getConnector.mockRejectedValueOnce(new Error("boom"));
      await setup({ renderTemplate: true });

      await createComponent();
      rotationSdk.getConnector.mockResolvedValue(makeAccessConnector());

      query<HTMLButtonElement>("#rotation-load-error_button_retry")!.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(query("pam-rotation-load-error")).toBeNull();
      expect(query("#access-connector-detail_multi-select_target-systems")).not.toBeNull();
    });
  });

  describe("header status", () => {
    it("says Connected for an active, connected connector", async () => {
      const comp = await mount();

      expect(comp.statusBadge()).toEqual(
        expect.objectContaining({ labelKey: "pamAccessConnectorConnected", variant: "success" }),
      );
    });

    it("says Disconnected for an active connector that isn't connected", async () => {
      const comp = await mount(makeAccessConnector({ isConnected: false }));

      expect(comp.statusBadge()).toEqual(
        expect.objectContaining({ labelKey: "pamAccessConnectorDisconnected", variant: "warning" }),
      );
    });

    it("says Inactive for a deactivated connector, even while it stays connected", async () => {
      const comp = await mount(makeAccessConnector({ status: AccessConnectorStatus.Disabled }));

      expect(comp.statusBadge()).toEqual(expect.objectContaining({ labelKey: "inactive" }));
    });

    it("renders the badge beside the title", async () => {
      await mount(makeAccessConnector(), { renderTemplate: true });

      expect(query("#access-connector-detail_badge_status")!.textContent?.trim()).toBe(
        "pamAccessConnectorConnected",
      );
    });
  });

  describe("callouts", () => {
    it("shows none while connected", async () => {
      const comp = await mount(makeAccessConnector(), { renderTemplate: true });

      expect(comp.callout()).toBeNull();
      expect(query("bit-callout")).toBeNull();
    });

    it("says why a connector seen before has dropped off", async () => {
      await mount(makeAccessConnector({ isConnected: false }), { renderTemplate: true });

      expect(query("#access-connector-detail_callout_disconnected")!.textContent).toContain(
        "pamAccessConnectorDisconnectedCallout",
      );
    });

    it("asks to finish setting up a connector that has never connected", async () => {
      await mount(makeAccessConnector({ isConnected: false, lastHeartbeatAt: undefined }), {
        renderTemplate: true,
      });

      expect(query("#access-connector-detail_callout_never-connected")!.textContent).toContain(
        "pamAccessConnectorNeverConnectedCallout",
      );
    });

    it("shows none for an inactive connector, which the header already explains", async () => {
      const comp = await mount(
        makeAccessConnector({ status: AccessConnectorStatus.Disabled, isConnected: false }),
      );

      expect(comp.callout()).toBeNull();
    });
  });

  describe("header actions", () => {
    const menuItems = (): string[] =>
      Array.from(document.querySelectorAll<HTMLElement>("[bitMenuItem]")).map(
        (button) => button.id,
      );

    function openMenu(): void {
      query<HTMLButtonElement>("#access-connector-detail_button_more")!.click();
      fixture.detectChanges();
    }

    it("offers only the More menu for an active connector, with Deactivate and Delete", async () => {
      await mount(makeAccessConnector(), { renderTemplate: true });

      expect(query("#access-connector-detail_button_activate")).toBeNull();
      openMenu();
      expect(menuItems()).toEqual([
        "access-connector-detail_button_deactivate",
        "access-connector-detail_button_delete",
      ]);
    });

    it("offers Activate beside the More menu for an inactive connector, which holds Delete", async () => {
      await mount(makeAccessConnector({ status: AccessConnectorStatus.Disabled }), {
        renderTemplate: true,
      });

      expect(query("#access-connector-detail_button_activate")).not.toBeNull();
      openMenu();
      expect(menuItems()).toEqual(["access-connector-detail_button_delete"]);
    });

    it("marks Delete as destructive", async () => {
      await mount(makeAccessConnector(), { renderTemplate: true });
      openMenu();

      expect(document.querySelector("#access-connector-detail_button_delete")!.className).toContain(
        "danger",
      );
    });

    it("offers no actions on the Rotation history tab", async () => {
      await mount(makeAccessConnector({ status: AccessConnectorStatus.Disabled }), {
        renderTemplate: true,
        tab: "history",
      });

      expect(query("#access-connector-detail_button_activate")).toBeNull();
      expect(query("#access-connector-detail_button_more")).toBeNull();
    });
  });

  describe("activating and deactivating", () => {
    it("activates at once and says so", async () => {
      rotationSdk.enableConnector.mockResolvedValue(undefined);
      const comp = await mount(makeAccessConnector({ status: AccessConnectorStatus.Disabled }));

      await comp.activate();

      expect(rotationSdk.enableConnector).toHaveBeenCalledWith(ORGANIZATION_ID, CONNECTOR_ID);
      expect(comp.enabled()).toBe(true);
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "pamAccessConnectorActivated",
      });
    });

    it("deactivates once confirmed, and stays on the page", async () => {
      rotationSdk.disableConnector.mockResolvedValue(undefined);
      const comp = await mount();
      const nav = jest.spyOn(TestBed.inject(Router), "navigate");

      await comp.deactivate();

      expect(dialog.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({ title: { key: "pamAccessConnectorDeactivateDialogTitle" } }),
      );
      expect(rotationSdk.disableConnector).toHaveBeenCalledWith(ORGANIZATION_ID, CONNECTOR_ID);
      expect(comp.enabled()).toBe(false);
      expect(comp.statusBadge()).toEqual(expect.objectContaining({ labelKey: "inactive" }));
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "pamAccessConnectorDeactivated",
      });
      expect(nav).not.toHaveBeenCalled();
    });

    it("leaves the connector active when the deactivation is declined", async () => {
      dialog.openSimpleDialog.mockResolvedValue(false);
      const comp = await mount();

      await comp.deactivate();

      expect(rotationSdk.disableConnector).not.toHaveBeenCalled();
      expect(comp.enabled()).toBe(true);
    });

    it("reports a failed deactivation and keeps the connector active", async () => {
      rotationSdk.disableConnector.mockRejectedValue(new Error("boom"));
      const comp = await mount();

      await comp.deactivate();

      expect(comp.enabled()).toBe(true);
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "pamAccessConnectorDeactivateFailed",
      });
    });

    it("drops staged additions on deactivating, since only an active connector takes them", async () => {
      rotationSdk.listTargetSystems.mockResolvedValue([makeSystem(), makeOtherSystem()]);
      rotationSdk.disableConnector.mockResolvedValue(undefined);
      const comp = await mount();
      comp.onSelectionChanged([item(makeSystem()), item(makeOtherSystem())]);

      await comp.deactivate();

      expect(comp.assignments().map((a) => a.targetSystemId)).toEqual([sysId("ts-1")]);
      expect(comp.unsavedChanges()).toBe(false);
    });

    it("updates the assigned targets' status as the connector's own status changes", async () => {
      rotationSdk.listConnectors.mockResolvedValue([
        accessConnector({ id: CONNECTOR_ID, assignedTargetSystemIds: [sysId("ts-1")] }),
      ]);
      rotationSdk.disableConnector.mockResolvedValue(undefined);
      const comp = await mount();
      await fixture.whenStable();
      expect(comp.assignments()[0].statusBadge?.labelKey).toBe("pamTargetSystemStatusActive");

      await comp.deactivate();

      expect(comp.assignments()[0].statusBadge?.labelKey).toBe("pamTargetSystemStatusNotConnected");
    });
  });

  describe("deleting", () => {
    it("deletes once confirmed and returns to the list", async () => {
      rotationSdk.deleteConnector.mockResolvedValue(undefined);
      const comp = await mount();
      const nav = jest.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);

      await comp.deleteAccessConnector();

      expect(dialog.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({ title: { key: "pamAccessConnectorDeleteDialogTitle" } }),
      );
      expect(rotationSdk.deleteConnector).toHaveBeenCalledWith(ORGANIZATION_ID, CONNECTOR_ID);
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "pamAccessConnectorDeleted",
      });
      expect(nav).toHaveBeenCalledWith([
        "/organizations",
        ORGANIZATION_ID,
        "pam",
        "rotation",
        "access-connectors",
      ]);
    });

    it("deletes nothing when declined", async () => {
      dialog.openSimpleDialog.mockResolvedValue(false);
      const comp = await mount();

      await comp.deleteAccessConnector();

      expect(rotationSdk.deleteConnector).not.toHaveBeenCalled();
    });

    it("reports a failed deletion and stays", async () => {
      rotationSdk.deleteConnector.mockRejectedValue(new Error("boom"));
      const comp = await mount();
      const nav = jest.spyOn(TestBed.inject(Router), "navigate");

      await comp.deleteAccessConnector();

      expect(nav).not.toHaveBeenCalled();
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "pamAccessConnectorDeleteFailed",
      });
    });
  });

  describe("target system picker", () => {
    it("offers every automatic target system, with what is staged shown as chosen", async () => {
      rotationSdk.listTargetSystems.mockResolvedValue([makeSystem(), makeOtherSystem()]);
      const comp = await mount();

      expect(comp.selectOptions().map((option) => option.id)).toEqual([
        String(sysId("ts-1")),
        String(sysId("ts-2")),
      ]);
      expect(comp.selectedItems().map((option) => option.id)).toEqual([String(sysId("ts-1"))]);
    });

    it("keeps an assigned target that is no longer automatic among the options", async () => {
      rotationSdk.listTargetSystems.mockResolvedValue([
        targetSystem({ id: sysId("ts-1"), name: "Prod Entra", method: "manual" as never }),
      ]);
      const comp = await mount();

      expect(comp.selectedItems().map((option) => option.id)).toEqual([String(sysId("ts-1"))]);
    });

    it("offers an inactive connector only what it holds, and says why", async () => {
      rotationSdk.listTargetSystems.mockResolvedValue([makeSystem(), makeOtherSystem()]);
      const comp = await mount(makeAccessConnector({ status: AccessConnectorStatus.Disabled }));

      expect(comp.selectOptions().map((option) => option.id)).toEqual([String(sysId("ts-1"))]);
      expect(comp.pickerHintKey()).toBe("pamAccessConnectorAssignTargetSystemsDisabled");
    });

    it("explains what can be assigned on an active connector", async () => {
      const comp = await mount();

      expect(comp.pickerHintKey()).toBe("pamAccessConnectorTargetSystemsHint");
    });

    it("reports a failed target system read in the hint", async () => {
      rotationSdk.listTargetSystems.mockRejectedValue(new Error("boom"));
      const comp = await mount();

      expect(comp.pickerHintKey()).toBe("pamAccessConnectorTargetSystemsLoadError");
    });

    it("stages a pick without writing it, and shows Save and Cancel", async () => {
      rotationSdk.listTargetSystems.mockResolvedValue([makeSystem(), makeOtherSystem()]);
      const comp = await mount();

      comp.onSelectionChanged([item(makeSystem()), item(makeOtherSystem())]);

      expect(rotationSdk.assignTarget).not.toHaveBeenCalled();
      expect(comp.assignments().map((a) => a.targetSystemId)).toEqual([
        sysId("ts-1"),
        sysId("ts-2"),
      ]);
      expect(comp.unsavedChanges()).toBe(true);
      expect(comp.showFooter()).toBe(true);
    });

    it("stages a removal from the table without writing it", async () => {
      const comp = await mount();

      comp.unassignTarget(comp.assignments()[0]);

      expect(rotationSdk.unassignTarget).not.toHaveBeenCalled();
      expect(comp.assignments()).toEqual([]);
      expect(comp.selectedItems()).toEqual([]);
      expect(comp.unsavedChanges()).toBe(true);
    });

    it("treats removing and re-adding a target as no change", async () => {
      const comp = await mount();

      comp.onSelectionChanged([]);
      comp.onSelectionChanged([item(makeSystem())]);

      expect(comp.unsavedChanges()).toBe(false);
    });

    it("puts back what was saved on Cancel", async () => {
      rotationSdk.listTargetSystems.mockResolvedValue([makeSystem(), makeOtherSystem()]);
      const comp = await mount();
      comp.onSelectionChanged([item(makeOtherSystem())]);

      comp.discardEdits();

      expect(comp.assignments().map((a) => a.targetSystemId)).toEqual([sysId("ts-1")]);
      expect(comp.showFooter()).toBe(false);
    });

    it("never shows Save and Cancel on the Rotation history tab", async () => {
      const comp = await mount(makeAccessConnector(), { tab: "history" });

      comp.onSelectionChanged([]);

      expect(comp.showFooter()).toBe(false);
    });
  });

  describe("target system status", () => {
    it("says Not connected for a target no connected, active connector serves", async () => {
      rotationSdk.listConnectors.mockResolvedValue([
        accessConnector({
          id: CONNECTOR_ID,
          isConnected: false,
          assignedTargetSystemIds: [sysId("ts-1")],
        }),
      ]);
      const comp = await mount(makeAccessConnector({ isConnected: false }));
      await fixture.whenStable();

      expect(comp.assignments()[0].statusBadge?.labelKey).toBe("pamTargetSystemStatusNotConnected");
    });

    it("says Active for a target another connected connector serves", async () => {
      rotationSdk.listConnectors.mockResolvedValue([
        accessConnector({
          id: CONNECTOR_ID,
          isConnected: false,
          assignedTargetSystemIds: [sysId("ts-1")],
        }),
        accessConnector({
          id: connectorId("other"),
          assignedTargetSystemIds: [sysId("ts-1")],
        }),
      ]);
      const comp = await mount(makeAccessConnector({ isConnected: false }));
      await fixture.whenStable();

      expect(comp.assignments()[0].statusBadge?.labelKey).toBe("pamTargetSystemStatusActive");
    });

    it("says Inactive for a deactivated target system", async () => {
      rotationSdk.listTargetSystems.mockResolvedValue([
        targetSystem({ id: sysId("ts-1"), status: TargetSystemStatus.Disabled }),
      ]);
      const comp = await mount();

      expect(comp.assignments()[0].statusBadge?.labelKey).toBe("pamTargetSystemStatusInactive");
    });

    it("never claims Not connected when the connector list could not be read", async () => {
      rotationSdk.listConnectors.mockRejectedValue(new Error("boom"));
      const comp = await mount(makeAccessConnector({ isConnected: false }));
      await fixture.whenStable();

      expect(comp.assignments()[0].statusBadge?.labelKey).toBe("pamTargetSystemStatusActive");
    });
  });

  describe("saving", () => {
    it("writes the assign and unassign calls the staged diff names, then returns to the list", async () => {
      rotationSdk.listTargetSystems.mockResolvedValue([makeSystem(), makeOtherSystem()]);
      rotationSdk.assignTarget.mockResolvedValue(undefined);
      rotationSdk.unassignTarget.mockResolvedValue(undefined);
      const comp = await mount();
      const nav = jest.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);
      comp.onSelectionChanged([item(makeOtherSystem())]);

      await comp.submit();

      expect(rotationSdk.assignTarget).toHaveBeenCalledWith(
        ORGANIZATION_ID,
        CONNECTOR_ID,
        sysId("ts-2"),
      );
      expect(rotationSdk.unassignTarget).toHaveBeenCalledWith(
        ORGANIZATION_ID,
        CONNECTOR_ID,
        sysId("ts-1"),
      );
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "pamAccessConnectorSaved",
      });
      expect(nav).toHaveBeenCalledWith([
        "/organizations",
        ORGANIZATION_ID,
        "pam",
        "rotation",
        "access-connectors",
      ]);
      expect(comp.unsavedChanges()).toBe(false);
    });

    it("keeps what it could not write staged, keeps the writes that landed, and stays", async () => {
      rotationSdk.listTargetSystems.mockResolvedValue([makeSystem(), makeOtherSystem()]);
      rotationSdk.assignTarget.mockResolvedValue(undefined);
      rotationSdk.unassignTarget.mockRejectedValue(new Error("boom"));
      const comp = await mount();
      const nav = jest.spyOn(TestBed.inject(Router), "navigate");
      comp.onSelectionChanged([item(makeOtherSystem())]);

      await comp.submit();

      expect(comp.accessConnector()!.connector.assignedTargetSystemIds).toEqual([
        sysId("ts-1"),
        sysId("ts-2"),
      ]);
      expect(comp.unsavedChanges()).toBe(true);
      expect(nav).not.toHaveBeenCalled();
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "pamAccessConnectorSaveFailed",
      });
    });

    it("states a failed save on the Configuration tab until the next attempt", async () => {
      rotationSdk.listTargetSystems.mockResolvedValue([makeSystem(), makeOtherSystem()]);
      rotationSdk.assignTarget.mockRejectedValueOnce(new Error("boom"));
      const comp = await mount(makeAccessConnector(), { renderTemplate: true });
      comp.onSelectionChanged([item(makeSystem()), item(makeOtherSystem())]);

      await comp.submit();
      fixture.detectChanges();

      expect(query("#access-connector-detail_callout_save-failed")!.textContent).toContain(
        "pamAccessConnectorSaveFailedCallout",
      );

      rotationSdk.assignTarget.mockReturnValue(new Promise(() => {}));
      void comp.submit();
      fixture.detectChanges();

      expect(query("#access-connector-detail_callout_save-failed")).toBeNull();
    });

    it("shows the server's reason when the SDK refuses a write", async () => {
      rotationSdk.listTargetSystems.mockResolvedValue([makeSystem(), makeOtherSystem()]);
      rotationSdk.assignTarget.mockRejectedValue(
        Object.assign(
          new Error(
            'error in response: status code 400 Bad Request: {"object":"error",' +
              '"message":"Target system is not automatic."}',
          ),
          { name: "RotationError", variant: "Api" },
        ),
      );
      const comp = await mount();
      comp.onSelectionChanged([item(makeSystem()), item(makeOtherSystem())]);

      await comp.submit();

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "Target system is not automatic.",
      });
    });

    it("pins Save and Cancel to the layout footer, and saves from there", async () => {
      rotationSdk.listTargetSystems.mockResolvedValue([makeSystem(), makeOtherSystem()]);
      rotationSdk.assignTarget.mockResolvedValue(undefined);
      const comp = await mount(makeAccessConnector(), { renderTemplate: true });
      jest.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);
      const footerPortal = () => TestBed.inject(LayoutFooterService).portal();
      expect(footerPortal()).toBeUndefined();

      comp.onSelectionChanged([item(makeSystem()), item(makeOtherSystem())]);
      fixture.detectChanges();
      TestBed.flushEffects();

      const host = document.createElement("div");
      document.body.appendChild(host);
      const outlet = new DomPortalOutlet(host);
      outlet.attach(footerPortal() as TemplatePortal);
      expect(host.querySelector("#access-connector-detail_button_cancel")).toBeTruthy();
      host.querySelector<HTMLButtonElement>("#access-connector-detail_button_save")!.click();
      await fixture.whenStable();
      outlet.dispose();
      host.remove();

      expect(rotationSdk.assignTarget).toHaveBeenCalledWith(
        ORGANIZATION_ID,
        CONNECTOR_ID,
        sysId("ts-2"),
      );
    });
  });

  describe("unsaved changes", () => {
    it("lets an untouched page go without asking", async () => {
      const comp = await mount();

      await expect(leaveThroughGuard(comp)).resolves.toBe(true);
      expect(dialog.openSimpleDialog).not.toHaveBeenCalled();
    });

    it("asks before a staged change is thrown away", async () => {
      const comp = await mount();
      comp.unassignTarget(comp.assignments()[0]);

      await expect(leaveThroughGuard(comp)).resolves.toBe(true);
      expect(dialog.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({ title: { key: "discardEditsTitle" } }),
      );
    });

    it("keeps the operator on the page when the discard is declined", async () => {
      const comp = await mount();
      dialog.openSimpleDialog.mockResolvedValue(false);
      comp.unassignTarget(comp.assignments()[0]);

      await expect(leaveThroughGuard(comp)).resolves.toBe(false);
    });

    it("does not ask a second time on the exit a deletion already agreed to", async () => {
      rotationSdk.deleteConnector.mockResolvedValue(undefined);
      const comp = await mount();
      jest.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);
      comp.unassignTarget(comp.assignments()[0]);

      await comp.deleteAccessConnector();

      expect(comp.unsavedChanges()).toBe(false);
    });
  });

  describe("rendered configuration", () => {
    const bodyRows = (): HTMLElement[] => [
      ...el().querySelectorAll<HTMLElement>('[data-testid="access-connector-assignments"] bit-row'),
    ];
    const columnTexts = (index: number): (string | undefined)[] =>
      bodyRows().map((row) => row.querySelectorAll("bit-cell")[index]?.textContent?.trim());

    it("shows last seen as a relative time", async () => {
      const heartbeat = new Date(Date.now() - 5 * 60_000).toISOString();
      await mount(makeAccessConnector({ lastHeartbeatAt: heartbeat }), { renderTemplate: true });

      expect(query('[data-testid="connector-last-seen"]')!.textContent).toContain(
        "pamRotationRelativeMinutesAgo",
      );
    });

    it("titles the sections Details and Rotation", async () => {
      await mount(makeAccessConnector(), { renderTemplate: true });

      expect(Array.from(el().querySelectorAll("h2")).map((h) => h.textContent?.trim())).toEqual([
        "pamAccessConnectorDetailsHeading",
        "pamAccessConnectorRotationHeading",
      ]);
    });

    it("lists each assignment's name, type, status and id", async () => {
      await mount(makeAccessConnector(), { renderTemplate: true });

      expect(bodyRows()).toHaveLength(1);
      expect(columnTexts(0)).toEqual(["Prod Entra"]);
      expect(columnTexts(1)).toEqual(["pamTargetSystemTypeEntra"]);
      expect(columnTexts(2)).toEqual(["pamTargetSystemStatusActive"]);
      expect(columnTexts(3)).toEqual([uuidAsString(sysId("ts-1"))]);
    });

    it("copies a target's id whole", async () => {
      await mount(makeAccessConnector(), { renderTemplate: true });

      query<HTMLButtonElement>(
        `#access-connector-detail_button_copy-target-id-${sysId("ts-1")}`,
      )!.click();

      expect(TestBed.inject(PlatformUtilsService).copyToClipboard).toHaveBeenCalledWith(
        uuidAsString(sysId("ts-1")),
      );
    });

    it("names the target system on its remove control, and stages the removal", async () => {
      await mount(makeAccessConnector(), { renderTemplate: true });
      const remove = query<HTMLButtonElement>(
        `#access-connector-detail_button_unassign-${sysId("ts-1")}`,
      )!;

      expect(remove.getAttribute("aria-label")).toBe("pamAccessConnectorUnassign");
      remove.click();
      fixture.detectChanges();

      expect(bodyRows()).toHaveLength(0);
      expect(rotationSdk.unassignTarget).not.toHaveBeenCalled();
    });

    it("leaves the table out when nothing is assigned", async () => {
      await mount(makeAccessConnector({ assignedTargetSystemIds: [] }), { renderTemplate: true });

      expect(query('[data-testid="access-connector-assignments"]')).toBeNull();
      expect(query("#access-connector-detail_multi-select_target-systems")!.textContent).toContain(
        "pamAccessConnectorTargetSystemsPlaceholder",
      );
    });
  });

  describe("tabs", () => {
    it("offers a Configuration tab and a Rotation history tab, each with a route", async () => {
      await mount(makeAccessConnector(), { renderTemplate: true });

      const links = Array.from(el().querySelectorAll<HTMLElement>("bit-tab-link"));
      expect(links.map((link) => link.textContent?.trim())).toEqual([
        "pamAccessConnectorTabConfiguration",
        "pamAccessConnectorTabRotationHistory",
      ]);
      const base = `/organizations/${ORGANIZATION_ID}/pam/rotation/access-connectors/${CONNECTOR_ID}`;
      expect(links.map((link) => link.querySelector("a")?.getAttribute("href"))).toEqual([
        `${base}/configuration`,
        `${base}/history`,
      ]);
    });

    it("reads the open tab from the route", async () => {
      const comp = await mount(makeAccessConnector(), { tab: "history" });

      expect(comp.activeTab()).toBe("history");
    });

    it("falls back to Configuration for a tab segment it does not know", async () => {
      const comp = await mount(makeAccessConnector(), { tab: "nonsense" });

      expect(comp.activeTab()).toBe("configuration");
    });

    it("renders the Configuration tab while the credential-name reads are still in flight", async () => {
      let settleConfigs!: (configs: RotationConfigView[]) => void;
      rotationSdk.listConfigs.mockReturnValue(
        new Promise<RotationConfigView[]>((resolve) => (settleConfigs = resolve)),
      );
      await mount(
        accessConnectorDetail({
          connector: accessConnector({ id: CONNECTOR_ID }),
          jobs: [rotationJob()],
        }),
        { renderTemplate: true, cipherNames: new Map() },
      );

      expect(query("#access-connector-detail_multi-select_target-systems")).toBeTruthy();
      settleConfigs([]);
    });

    it("puts only the history table on the Rotation history tab", async () => {
      rotationSdk.listConfigs.mockResolvedValue([]);
      await mount(
        accessConnectorDetail({
          connector: accessConnector({ id: CONNECTOR_ID }),
          jobs: [rotationJob()],
        }),
        { renderTemplate: true, tab: "history" },
      );

      expect(query("app-rotation-history")).toBeTruthy();
      expect(query("#access-connector-detail_multi-select_target-systems")).toBeNull();
      expect(query("h2")).toBeNull();
    });

    it("names each job by the credential it rotated", async () => {
      rotationSdk.listConfigs.mockResolvedValue([
        rotationConfig({ id: configId("cfg-1"), cipherId: CIPHER_ID }),
      ]);
      await mount(
        accessConnectorDetail({
          connector: accessConnector({ id: CONNECTOR_ID }),
          jobs: [rotationJob({ rotationConfigId: configId("cfg-1") })],
        }),
        {
          renderTemplate: true,
          tab: "history",
          cipherNames: new Map([[CIPHER_ID, "Prod service account"]]),
        },
      );

      expect(el().textContent).toContain("Prod service account");
    });

    it("falls back to the rotation config id when no name resolved", async () => {
      rotationSdk.listConfigs.mockResolvedValue([
        rotationConfig({ id: configId("cfg-1"), cipherId: CIPHER_ID }),
      ]);
      await mount(
        accessConnectorDetail({
          connector: accessConnector({ id: CONNECTOR_ID }),
          jobs: [rotationJob({ rotationConfigId: configId("cfg-1") })],
        }),
        { renderTemplate: true, tab: "history", cipherNames: new Map() },
      );

      expect(el().textContent).toContain(String(configId("cfg-1")));
    });
  });

  describe("details card", () => {
    /** The timestamp `rotation-builders` seeds both `creationDate` and `lastHeartbeatAt` with. */
    const seeded = accessConnector().creationDate;

    const fieldText = (testId: string): string =>
      query(`[data-testid="${testId}"]`)?.textContent?.trim() ?? "";

    it("renders the creation date", async () => {
      await mount(makeAccessConnector(), { renderTemplate: true });

      expect(fieldText("connector-created")).toBe(
        formatTimestamp(TestBed.inject(LOCALE_ID), Date.parse(seeded)),
      );
    });

    it("falls back to the timestamp when the heartbeat is 400 days old", async () => {
      const old = new Date(Date.now() - 400 * 24 * 60 * 60_000).toISOString();
      await mount(makeAccessConnector({ lastHeartbeatAt: old }), { renderTemplate: true });

      expect(fieldText("connector-last-seen")).toBe(
        formatTimestamp(TestBed.inject(LOCALE_ID), Date.parse(old)),
      );
    });

    it("renders 'Never' for an unparseable heartbeat", async () => {
      await mount(makeAccessConnector({ lastHeartbeatAt: "not-a-date" }), {
        renderTemplate: true,
      });

      expect(fieldText("connector-last-seen")).toBe("never");
    });

    it("renders 'Never' for a connector that has not checked in yet", async () => {
      await mount(makeAccessConnector({ lastHeartbeatAt: undefined }), { renderTemplate: true });

      expect(fieldText("connector-last-seen")).toBe("never");
    });
  });

  describe("loading skeleton", () => {
    async function renderLoading(tab = "configuration") {
      rotationSdk.getConnector.mockResolvedValue(makeAccessConnector());
      await setup({ renderTemplate: true, tab });
      fixture = TestBed.createComponent(AccessConnectorDetailComponent);
      fixture.detectChanges();
    }

    async function settle() {
      await fixture.whenStable();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    }

    it("stands skeleton cards in for the Details and Rotation sections", async () => {
      await renderLoading();

      const loading = query('[data-testid="access-connector-detail-loading"]')!;
      expect(query("bit-spinner")).toBeNull();
      expect(loading.querySelector("bit-skeleton")).not.toBeNull();
      expect(loading.textContent).toContain("pamAccessConnectorDetailsHeading");
      expect(loading.textContent).toContain("pamAccessConnectorRotationHeading");
      expect(loading.getAttribute("aria-hidden")).toBe("true");
      expect(query("pam-detail-breadcrumb")).not.toBeNull();
    });

    it("mirrors the history table instead when the history tab is the one loading", async () => {
      await renderLoading("history");

      const loading = query('[data-testid="access-connector-detail-loading"]')!;
      expect(loading.querySelector("app-rotation-history-skeleton")).not.toBeNull();
      expect(loading.textContent).not.toContain("pamAccessConnectorDetailsHeading");
    });

    it("announces the load from a live region, then the arrival", async () => {
      await renderLoading();

      const status = query('[data-testid="rotation-loading-status"]')!;
      expect(status.getAttribute("role")).toBe("status");
      expect(status.textContent).toContain("loading");

      await settle();

      expect(query('[data-testid="rotation-loading-status"]')!.textContent).toContain(
        "pamRotationPageLoaded",
      );
    });

    it("replaces the skeleton with the page once the connector lands", async () => {
      await renderLoading();
      await settle();

      expect(query('[data-testid="access-connector-detail-loading"]')).toBeNull();
      expect(query("#access-connector-detail_multi-select_target-systems")).not.toBeNull();
    });
  });
});
