import { DatePipe } from "@angular/common";
import { LOCALE_ID } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import {
  DialogService,
  SelectItemView,
  ToastService,
  TooltipDirective,
} from "@bitwarden/components";
import type { CipherId } from "@bitwarden/sdk-internal";

import { OrgCiphersService } from "../org-ciphers.service";
import { AccessConnectorStatus, TargetSystemKind } from "../rotation";
import type {
  AccessConnector,
  AccessConnectorDetail,
  RotationConfig,
  TargetSystem,
  TargetSystemId,
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
} from "../testing/rotation-builders";

import {
  DaemonAssignment,
  DaemonDetailComponent,
  daemonDetailDiscardGuard,
} from "./daemon-detail.component";

/** Echoes the key, with the qualified-name key rendered so its two halves stay readable. */
const i18nFake: Pick<I18nService, "t" | "translate"> = {
  t: (id: string, p1?: string | number, p2?: string | number) =>
    id === "pamTargetSystemNameWithDetail" ? `${p1} (${p2})` : id,
  translate: (id: string) => id,
};

/** The component's protected surface, as the tests drive it. */
type DetailApi = {
  titleText: () => string;
  activeTab: () => string;
  enabled: () => boolean;
  stagedActive: () => boolean;
  formGroup: {
    dirty: boolean;
    controls: {
      active: { setValue: (value: boolean) => void; markAsDirty: () => void; value: boolean };
      assignedTargetSystemIds: { value: TargetSystemId[] };
    };
  };
  assignments: () => DaemonAssignment[];
  assignOptions: () => SelectItemView[];
  noEligibleTargetSystems: () => boolean;
  assignTargets: (selected: SelectItemView[]) => Promise<readonly string[]>;
  unassignTarget: (assignment: DaemonAssignment) => Promise<boolean>;
  submit: () => Promise<void>;
  deleteDaemon: () => Promise<void>;
  confirmDiscard: () => Promise<boolean>;
  daemon: () => AccessConnectorDetail | null;
};

function makeDaemon(overrides: Partial<AccessConnector> = {}): AccessConnectorDetail {
  return accessConnectorDetail({
    connector: accessConnector({
      id: connectorId("daemon-1"),
      name: "On-prem daemon",
      assignedTargetSystemIds: [sysId("ts-1")],
      ...overrides,
    }),
  });
}

function makeSystem(): TargetSystem {
  return targetSystem({ id: sysId("ts-1"), name: "Prod Entra" });
}

function makeOtherSystem(): TargetSystem {
  return targetSystem({ id: sysId("ts-2"), name: "Prod MSSQL", kind: TargetSystemKind.Mssql });
}

/** A second target sharing the first's name, differing only in its integration. */
function makeSameNamedSystem(): TargetSystem {
  return targetSystem({
    id: sysId("ts-2"),
    name: "Prod Entra",
    kind: TargetSystemKind.CustomScript,
  });
}

function pick(system: TargetSystem): SelectItemView {
  return { id: String(system.id), listName: system.name, labelName: system.name };
}

function daemonProviders(
  rotationSdk: ReturnType<typeof mock<RotationSdkService>>,
  daemonId = connectorId("daemon-1"),
  dialogService: ReturnType<typeof mock<DialogService>> = mock<DialogService>(),
  tab = "configuration",
) {
  const params = { organizationId: ORGANIZATION_ID, daemonId, tab };
  return [
    provideRouter([]),
    { provide: RotationSdkService, useValue: rotationSdk },
    { provide: I18nService, useValue: i18nFake },
    { provide: ToastService, useValue: mock<ToastService>() },
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

async function setup(
  rotationSdk: ReturnType<typeof mock<RotationSdkService>>,
  daemonId = connectorId("daemon-1"),
  dialogService: ReturnType<typeof mock<DialogService>> = mock<DialogService>(),
  {
    renderTemplate = false,
    tab = "configuration",
    cipherNames,
  }: {
    renderTemplate?: boolean;
    tab?: string;
    cipherNames?: Map<CipherId, string>;
  } = {},
) {
  if (!renderTemplate) {
    TestBed.overrideComponent(DaemonDetailComponent, { set: { template: "", imports: [] } });
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
    imports: [DaemonDetailComponent, NoopAnimationsModule],
    providers: daemonProviders(rotationSdk, daemonId, dialogService, tab),
  }).compileComponents();
}

function fieldText(rendered: ComponentFixture<DaemonDetailComponent>, testId: string): string {
  const el = (rendered.nativeElement as HTMLElement).querySelector(`[data-testid="${testId}"]`);
  return el?.textContent?.trim() ?? "";
}

/** The pending state of one listed assignment, by id. */
function pendingOf(comp: DetailApi, system: TargetSystem): string | null | undefined {
  return comp.assignments().find((a) => a.targetSystemId === system.id)?.pending;
}

/** Flips the Active checkbox the way its value accessor does: a new value, and a dirty control. */
function stageActive(comp: DetailApi, active: boolean): void {
  comp.formGroup.controls.active.setValue(active);
  comp.formGroup.controls.active.markAsDirty();
}

describe("DaemonDetailComponent", () => {
  let fixture: ComponentFixture<DaemonDetailComponent>;
  let rotationSdk: ReturnType<typeof mock<RotationSdkService>>;

  /** Creates the component and settles the two loads the page kicks off in its constructor. */
  async function createComponent(): Promise<DetailApi> {
    fixture = TestBed.createComponent(DaemonDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.componentInstance as unknown as DetailApi;
  }

  function runGuard(comp: DetailApi): Promise<boolean> {
    return daemonDetailDiscardGuard(
      comp as unknown as DaemonDetailComponent,
      null as never,
      null as never,
      null as never,
    ) as Promise<boolean>;
  }

  beforeEach(() => {
    rotationSdk = mock<RotationSdkService>();
    rotationSdk.listTargetSystems.mockResolvedValue([makeSystem()]);
  });

  afterEach(() => TestBed.resetTestingModule());

  it("loads the daemon on init", async () => {
    rotationSdk.getConnector.mockResolvedValue(makeDaemon());
    await setup(rotationSdk);
    const comp = await createComponent();

    expect(rotationSdk.getConnector).toHaveBeenCalledWith(ORGANIZATION_ID, connectorId("daemon-1"));
    expect(comp.titleText()).toBe("On-prem daemon");
  });

  it("seeds the form from the loaded connector, so nothing starts staged", async () => {
    rotationSdk.getConnector.mockResolvedValue(makeDaemon());
    await setup(rotationSdk);
    const comp = await createComponent();

    expect(comp.stagedActive()).toBe(true);
    expect(comp.formGroup.controls.assignedTargetSystemIds.value).toEqual([sysId("ts-1")]);
    expect(comp.formGroup.dirty).toBe(false);
    expect(pendingOf(comp, makeSystem())).toBeNull();
  });

  it("resolves assignment ids to target-system names", async () => {
    rotationSdk.getConnector.mockResolvedValue(makeDaemon());
    await setup(rotationSdk);
    const comp = await createComponent();

    expect(comp.assignments()).toEqual([
      {
        id: String(sysId("ts-1")),
        targetSystemId: sysId("ts-1"),
        name: "Prod Entra",
        qualifierKey: "pamTargetSystemTypeEntra",
        qualified: "Prod Entra (pamTargetSystemTypeEntra)",
        label: "Prod Entra (pamTargetSystemTypeEntra)",
        pending: null,
      },
    ]);
  });

  it("tells two same-named assignments apart by their integration", async () => {
    rotationSdk.getConnector.mockResolvedValue(
      makeDaemon({ assignedTargetSystemIds: [sysId("ts-1"), sysId("ts-2")] }),
    );
    rotationSdk.listTargetSystems.mockResolvedValue([makeSystem(), makeSameNamedSystem()]);
    await setup(rotationSdk);
    const comp = await createComponent();

    expect(comp.assignments().map((a) => a.qualified)).toEqual([
      "Prod Entra (pamTargetSystemTypeEntra)",
      "Prod Entra (pamTargetSystemTypeCustomScript)",
    ]);
  });

  it("offers only the unassigned active automatic targets in the picker", async () => {
    rotationSdk.getConnector.mockResolvedValue(makeDaemon());
    rotationSdk.listTargetSystems.mockResolvedValue([makeSystem(), makeOtherSystem()]);
    await setup(rotationSdk);
    const comp = await createComponent();

    expect(comp.assignOptions()).toEqual([
      {
        id: String(sysId("ts-2")),
        listName: "Prod MSSQL (pamTargetSystemTypeMssql)",
        labelName: "Prod MSSQL (pamTargetSystemTypeMssql)",
      },
    ]);
  });

  describe("load error state", () => {
    it("stays on the page and reports the failure rather than bouncing to the list", async () => {
      rotationSdk.getConnector.mockRejectedValue(new Error("boom"));
      await setup(rotationSdk, connectorId("missing"), mock<DialogService>(), {
        renderTemplate: true,
      });
      const nav = jest.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);

      await createComponent();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector("pam-rotation-load-error")).not.toBeNull();
      expect(el.textContent).toContain("pamRotationListLoadErrorTitle");
      expect(el.querySelector('[data-testid="daemon-detail-loading"]')).toBeNull();
      expect(nav).not.toHaveBeenCalled();
    });

    it("does not announce a failed read as loaded", async () => {
      rotationSdk.getConnector.mockRejectedValue(new Error("boom"));
      await setup(rotationSdk, connectorId("missing"), mock<DialogService>(), {
        renderTemplate: true,
      });

      await createComponent();

      expect(
        (fixture.nativeElement as HTMLElement)
          .querySelector('[data-testid="rotation-loading-status"]')!
          .textContent?.trim(),
      ).toBe("");
    });

    it("re-reads the connector from the error state, and shows it once it lands", async () => {
      rotationSdk.getConnector.mockRejectedValueOnce(new Error("boom"));
      await setup(rotationSdk, connectorId("daemon-1"), mock<DialogService>(), {
        renderTemplate: true,
      });

      await createComponent();
      rotationSdk.getConnector.mockResolvedValue(makeDaemon());

      (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLButtonElement>("#rotation-load-error_button_retry")!
        .click();
      await fixture.whenStable();
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector("pam-rotation-load-error")).toBeNull();
      expect(el.querySelector("#daemon-detail_checkbox_active")).not.toBeNull();
    });
  });

  describe("staging", () => {
    async function mount(daemon = makeDaemon()): Promise<DetailApi> {
      rotationSdk.getConnector.mockResolvedValue(daemon);
      rotationSdk.listTargetSystems.mockResolvedValue([makeSystem(), makeOtherSystem()]);
      await setup(rotationSdk);
      return await createComponent();
    }

    it("stages an assignment instead of writing it", async () => {
      const comp = await mount();

      await comp.assignTargets([pick(makeOtherSystem())]);

      expect(rotationSdk.assignTarget).not.toHaveBeenCalled();
      expect(pendingOf(comp, makeOtherSystem())).toBe("add");
      expect(comp.formGroup.dirty).toBe(true);
    });

    it("empties the picker of everything it staged", async () => {
      const comp = await mount();

      await expect(comp.assignTargets([pick(makeOtherSystem())])).resolves.toEqual([
        String(sysId("ts-2")),
      ]);
      expect(comp.assignOptions()).toEqual([]);
    });

    it("stages a removal instead of writing it, and keeps the row listed as pending", async () => {
      const comp = await mount();

      await expect(comp.unassignTarget(comp.assignments()[0])).resolves.toBe(true);

      expect(rotationSdk.unassignTarget).not.toHaveBeenCalled();
      expect(pendingOf(comp, makeSystem())).toBe("remove");
      expect(comp.formGroup.dirty).toBe(true);
    });

    it("does not confirm a removal that has not been written yet", async () => {
      const dialog = mock<DialogService>();
      rotationSdk.getConnector.mockResolvedValue(makeDaemon());
      await setup(rotationSdk, connectorId("daemon-1"), dialog);
      const comp = await createComponent();

      await comp.unassignTarget(comp.assignments()[0]);

      expect(dialog.openSimpleDialog).not.toHaveBeenCalled();
    });

    it("returns a target staged for removal to the picker, which is how the removal is undone", async () => {
      const comp = await mount();
      const row = comp.assignments()[0];

      await comp.unassignTarget(row);
      expect(comp.assignOptions().map((o) => o.id)).toContain(String(sysId("ts-1")));

      await comp.assignTargets([pick(makeSystem())]);

      expect(pendingOf(comp, makeSystem())).toBeNull();
    });

    it("reports no change for a target that is already staged for removal", async () => {
      const comp = await mount();
      const row = comp.assignments()[0];

      await comp.unassignTarget(row);

      await expect(comp.unassignTarget(row)).resolves.toBe(false);
      expect(pendingOf(comp, makeSystem())).toBe("remove");
    });

    it("does not stage an assignment while the connector is staged inactive", async () => {
      const comp = await mount();
      stageActive(comp, false);

      await expect(comp.assignTargets([pick(makeOtherSystem())])).resolves.toEqual([]);

      expect(comp.assignments()).toHaveLength(1);
    });

    it("drops a staged assignment when the connector is staged inactive after it", async () => {
      const comp = await mount();
      await comp.assignTargets([pick(makeOtherSystem())]);

      stageActive(comp, false);

      expect(pendingOf(comp, makeOtherSystem())).toBeUndefined();
      expect(comp.formGroup.controls.assignedTargetSystemIds.value).toEqual([sysId("ts-1")]);
    });

    it("keeps a staged removal when the connector is staged inactive after it", async () => {
      const comp = await mount();
      await comp.unassignTarget(comp.assignments()[0]);

      stageActive(comp, false);

      expect(pendingOf(comp, makeSystem())).toBe("remove");
    });

    it("stages a status change without writing it", async () => {
      const comp = await mount();

      stageActive(comp, false);

      expect(rotationSdk.disableConnector).not.toHaveBeenCalled();
      expect(comp.enabled()).toBe(true);
      expect(comp.stagedActive()).toBe(false);
      expect(comp.formGroup.dirty).toBe(true);
    });
  });

  describe("saving", () => {
    let dialog: ReturnType<typeof mock<DialogService>>;

    async function mount(daemon = makeDaemon()): Promise<DetailApi> {
      dialog = mock<DialogService>();
      dialog.openSimpleDialog.mockResolvedValue(true);
      rotationSdk.getConnector.mockResolvedValue(daemon);
      rotationSdk.listTargetSystems.mockResolvedValue([makeSystem(), makeOtherSystem()]);
      rotationSdk.assignTarget.mockResolvedValue(undefined);
      rotationSdk.unassignTarget.mockResolvedValue(undefined);
      rotationSdk.enableConnector.mockResolvedValue(undefined);
      rotationSdk.disableConnector.mockResolvedValue(undefined);
      await setup(rotationSdk, connectorId("daemon-1"), dialog);
      return await createComponent();
    }

    it("writes nothing while the page is untouched", async () => {
      const comp = await mount();

      await comp.submit();

      expect(rotationSdk.assignTarget).not.toHaveBeenCalled();
      expect(rotationSdk.unassignTarget).not.toHaveBeenCalled();
      expect(rotationSdk.enableConnector).not.toHaveBeenCalled();
      expect(rotationSdk.disableConnector).not.toHaveBeenCalled();
    });

    it("issues the assign and unassign calls the staged diff names", async () => {
      const comp = await mount();
      await comp.assignTargets([pick(makeOtherSystem())]);
      await comp.unassignTarget(comp.assignments()[0]);

      await comp.submit();

      expect(rotationSdk.assignTarget).toHaveBeenCalledWith(
        ORGANIZATION_ID,
        connectorId("daemon-1"),
        sysId("ts-2"),
      );
      expect(rotationSdk.unassignTarget).toHaveBeenCalledWith(
        ORGANIZATION_ID,
        connectorId("daemon-1"),
        sysId("ts-1"),
      );
      expect(comp.assignments().map((a) => a.id)).toEqual([sysId("ts-2")]);
      expect(comp.assignments().every((a) => a.pending == null)).toBe(true);
      expect(comp.formGroup.dirty).toBe(false);
      expect(TestBed.inject(ToastService).showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    });

    it("activates before the assignment writes, so the server can accept them", async () => {
      const calls: string[] = [];
      const comp = await mount(makeDaemon({ status: AccessConnectorStatus.Disabled }));
      rotationSdk.enableConnector.mockImplementation(async () => {
        calls.push("enable");
      });
      rotationSdk.assignTarget.mockImplementation(async () => {
        calls.push("assign");
      });
      stageActive(comp, true);
      await comp.assignTargets([pick(makeOtherSystem())]);

      await comp.submit();

      expect(calls).toEqual(["enable", "assign"]);
    });

    it("deactivates after the assignment writes, for the same reason", async () => {
      const calls: string[] = [];
      const comp = await mount();
      rotationSdk.disableConnector.mockImplementation(async () => {
        calls.push("disable");
      });
      rotationSdk.unassignTarget.mockImplementation(async () => {
        calls.push("unassign");
      });
      await comp.unassignTarget(comp.assignments()[0]);
      stageActive(comp, false);

      await comp.submit();

      expect(calls).toEqual(["unassign", "disable"]);
    });

    it("confirms a deactivation at save time rather than when the box is cleared", async () => {
      const comp = await mount();

      stageActive(comp, false);
      expect(dialog.openSimpleDialog).not.toHaveBeenCalled();

      await comp.submit();

      expect(dialog.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({ key: "pamAccessConnectorDeactivateConfirmContent" }),
        }),
      );
      expect(rotationSdk.disableConnector).toHaveBeenCalled();
    });

    it("leaves everything staged when the deactivation is declined", async () => {
      const comp = await mount();
      dialog.openSimpleDialog.mockResolvedValue(false);
      await comp.unassignTarget(comp.assignments()[0]);
      stageActive(comp, false);

      await comp.submit();

      expect(rotationSdk.disableConnector).not.toHaveBeenCalled();
      expect(rotationSdk.unassignTarget).not.toHaveBeenCalled();
      expect(comp.formGroup.dirty).toBe(true);
      expect(pendingOf(comp, makeSystem())).toBe("remove");
    });

    it("does not confirm an activation", async () => {
      const comp = await mount(makeDaemon({ status: AccessConnectorStatus.Disabled }));
      stageActive(comp, true);

      await comp.submit();

      expect(dialog.openSimpleDialog).not.toHaveBeenCalled();
      expect(rotationSdk.enableConnector).toHaveBeenCalled();
      expect(comp.enabled()).toBe(true);
    });

    it("keeps what it could not write staged, and reports the failure", async () => {
      const comp = await mount();
      rotationSdk.assignTarget.mockRejectedValue(new Error("boom"));
      await comp.assignTargets([pick(makeOtherSystem())]);
      await comp.unassignTarget(comp.assignments()[0]);

      await comp.submit();

      expect(rotationSdk.unassignTarget).not.toHaveBeenCalled();
      expect(pendingOf(comp, makeOtherSystem())).toBe("add");
      expect(pendingOf(comp, makeSystem())).toBe("remove");
      expect(comp.formGroup.dirty).toBe(true);
      expect(TestBed.inject(ToastService).showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
    });

    it("keeps the writes that did land, so a retry only carries the rest", async () => {
      const comp = await mount(makeDaemon({ assignedTargetSystemIds: [] }));
      rotationSdk.assignTarget
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("boom"));
      await comp.assignTargets([pick(makeSystem()), pick(makeOtherSystem())]);

      await comp.submit();

      expect(pendingOf(comp, makeSystem())).toBeNull();
      expect(pendingOf(comp, makeOtherSystem())).toBe("add");
    });

    it("stops before the assignment writes when the activation fails", async () => {
      const comp = await mount(makeDaemon({ status: AccessConnectorStatus.Disabled }));
      rotationSdk.enableConnector.mockRejectedValue(new Error("offline"));
      stageActive(comp, true);
      await comp.assignTargets([pick(makeOtherSystem())]);

      await comp.submit();

      expect(rotationSdk.assignTarget).not.toHaveBeenCalled();
      expect(comp.enabled()).toBe(false);
      expect(comp.formGroup.dirty).toBe(true);
    });

    it("keeps the connector's metadata when a status write rebuilds it", async () => {
      const seeded = accessConnector().creationDate;
      const comp = await mount();
      stageActive(comp, false);

      await comp.submit();

      expect(comp.daemon()?.connector.creationDate).toBe(seeded);
      expect(comp.daemon()?.connector.lastHeartbeatAt).toBe(seeded);
    });
  });

  describe("unsaved changes", () => {
    let dialog: ReturnType<typeof mock<DialogService>>;

    async function mount(): Promise<DetailApi> {
      dialog = mock<DialogService>();
      dialog.openSimpleDialog.mockResolvedValue(true);
      rotationSdk.getConnector.mockResolvedValue(makeDaemon());
      rotationSdk.listTargetSystems.mockResolvedValue([makeSystem(), makeOtherSystem()]);
      rotationSdk.assignTarget.mockResolvedValue(undefined);
      rotationSdk.deleteConnector.mockResolvedValue(undefined);
      await setup(rotationSdk, connectorId("daemon-1"), dialog);
      return await createComponent();
    }

    it("lets an untouched page go without asking", async () => {
      const comp = await mount();

      await expect(runGuard(comp)).resolves.toBe(true);
      expect(dialog.openSimpleDialog).not.toHaveBeenCalled();
    });

    it("asks before a staged assignment is thrown away", async () => {
      const comp = await mount();
      await comp.assignTargets([pick(makeOtherSystem())]);

      await expect(runGuard(comp)).resolves.toBe(true);
      expect(dialog.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({ title: { key: "discardEditsTitle" } }),
      );
    });

    it("asks before a staged removal is thrown away", async () => {
      const comp = await mount();
      await comp.unassignTarget(comp.assignments()[0]);

      await runGuard(comp);

      expect(dialog.openSimpleDialog).toHaveBeenCalled();
    });

    it("asks before a staged status change is thrown away", async () => {
      const comp = await mount();
      stageActive(comp, false);

      await runGuard(comp);

      expect(dialog.openSimpleDialog).toHaveBeenCalled();
    });

    it("keeps the operator on the page when the discard is declined", async () => {
      const comp = await mount();
      dialog.openSimpleDialog.mockResolvedValue(false);
      await comp.assignTargets([pick(makeOtherSystem())]);

      await expect(runGuard(comp)).resolves.toBe(false);
    });

    it("stops asking once the staged changes are saved", async () => {
      const comp = await mount();
      await comp.assignTargets([pick(makeOtherSystem())]);
      await comp.submit();

      await expect(runGuard(comp)).resolves.toBe(true);
      expect(dialog.openSimpleDialog).not.toHaveBeenCalledWith(
        expect.objectContaining({ title: { key: "discardEditsTitle" } }),
      );
    });

    it("does not ask a second time on the exit a deletion already agreed to", async () => {
      const comp = await mount();
      jest.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);
      await comp.assignTargets([pick(makeOtherSystem())]);

      await comp.deleteDaemon();

      expect(rotationSdk.deleteConnector).toHaveBeenCalled();
      await expect(runGuard(comp)).resolves.toBe(true);
    });
  });

  it("deletes the daemon after confirmation and navigates back", async () => {
    rotationSdk.getConnector.mockResolvedValue(makeDaemon());
    rotationSdk.deleteConnector.mockResolvedValue(undefined);
    const dialog = mock<DialogService>();
    dialog.openSimpleDialog.mockResolvedValue(true);
    await setup(rotationSdk, connectorId("daemon-1"), dialog);
    const router = TestBed.inject(Router);
    const nav = jest.spyOn(router, "navigate").mockResolvedValue(true);
    const comp = await createComponent();

    await comp.deleteDaemon();

    expect(rotationSdk.deleteConnector).toHaveBeenCalledWith(
      ORGANIZATION_ID,
      connectorId("daemon-1"),
    );
    expect(nav).toHaveBeenCalled();
  });

  describe("rendered assignment section", () => {
    const query = (selector: string) => fixture.nativeElement.querySelector(selector);

    async function render(daemon = makeDaemon()): Promise<DetailApi> {
      rotationSdk.getConnector.mockResolvedValue(daemon);
      await setup(rotationSdk, connectorId("daemon-1"), mock<DialogService>(), {
        renderTemplate: true,
      });
      return await createComponent();
    }

    it("hands the section to the shared picker and lists each assignment as a row", async () => {
      rotationSdk.listTargetSystems.mockResolvedValue([makeSystem(), makeOtherSystem()]);
      await render();

      expect(query("pam-assignment-picker")).toBeTruthy();
      expect(query("#daemon-detail_multi-select_options")).toBeTruthy();
      const rows = fixture.nativeElement.querySelectorAll("tbody tr");
      expect(rows).toHaveLength(1);
      expect(rows[0].textContent).toContain("Prod Entra");
    });

    it("gives each remove control an accessible name that names the target system", async () => {
      rotationSdk.getConnector.mockResolvedValue(
        makeDaemon({ assignedTargetSystemIds: [sysId("ts-1"), sysId("ts-2")] }),
      );
      rotationSdk.listTargetSystems.mockResolvedValue([makeSystem(), makeSameNamedSystem()]);
      await setup(rotationSdk, connectorId("daemon-1"), mock<DialogService>(), {
        renderTemplate: true,
      });
      await createComponent();

      expect(
        query(`#daemon-detail_button_unassign-${sysId("ts-1")}`).getAttribute("aria-label"),
      ).toBe("pamAccessConnectorUnassign");
      const kinds = Array.from(
        fixture.nativeElement.querySelectorAll("tbody tr td:nth-child(2)"),
      ).map((cell) => (cell as HTMLElement).textContent?.trim());
      expect(kinds).toEqual(["pamTargetSystemTypeEntra", "pamTargetSystemTypeCustomScript"]);
    });

    it("shows the empty row when nothing is assigned", async () => {
      await render(makeDaemon({ assignedTargetSystemIds: [] }));

      expect(fixture.nativeElement.textContent).toContain("pamAccessConnectorAssignmentsEmpty");
    });

    it("marks a staged assignment as pending rather than as saved", async () => {
      rotationSdk.listTargetSystems.mockResolvedValue([makeSystem(), makeOtherSystem()]);
      const comp = await render(makeDaemon({ assignedTargetSystemIds: [] }));

      await comp.assignTargets([pick(makeOtherSystem())]);
      fixture.detectChanges();

      const row = fixture.nativeElement.querySelector("tbody tr");
      expect(row.textContent).toContain("pamRotationAssignmentPendingAssign");
      expect(row.querySelector(".tw-line-through")).toBeNull();
    });

    it("strikes a staged removal through and says it is pending", async () => {
      const comp = await render();

      await comp.unassignTarget(comp.assignments()[0]);
      fixture.detectChanges();

      const row = fixture.nativeElement.querySelector("tbody tr");
      expect(row.textContent).toContain("pamRotationAssignmentPendingUnassign");
      expect(row.querySelector(".tw-line-through")?.textContent?.trim()).toBe("Prod Entra");
    });

    it("keeps Assign aria-disabled with its tooltip while the connector is staged inactive", async () => {
      rotationSdk.listTargetSystems.mockResolvedValue([makeSystem(), makeOtherSystem()]);
      await render(makeDaemon({ status: AccessConnectorStatus.Disabled }));

      const assign = query("#daemon-detail_button_assign");
      expect(assign).toBeTruthy();
      expect(assign.getAttribute("aria-disabled")).toBe("true");
      expect(assign.getAttribute("aria-describedby")).toBeTruthy();
    });

    it("links to Target systems when the org has none to assign", async () => {
      rotationSdk.listTargetSystems.mockResolvedValue([]);
      await render(makeDaemon({ assignedTargetSystemIds: [] }));

      expect(query("#daemon-detail_anchor_go-to").getAttribute("href")).toBe(
        `/organizations/${ORGANIZATION_ID}/pam/rotation/target-systems`,
      );
    });

    it("leaves the Target systems link out while eligible targets exist", async () => {
      await render(makeDaemon({ assignedTargetSystemIds: [] }));

      expect(query("#daemon-detail_anchor_go-to")).toBeNull();
    });
  });

  describe("assignment hint", () => {
    const hintText = () =>
      (fixture.nativeElement as HTMLElement).querySelector("pam-assignment-picker bit-hint")
        ?.textContent;

    async function render(daemon: AccessConnectorDetail): Promise<void> {
      rotationSdk.getConnector.mockResolvedValue(daemon);
      await setup(rotationSdk, connectorId("daemon-1"), mock<DialogService>(), {
        renderTemplate: true,
      });
      await createComponent();
    }

    it("explains what can be assigned while eligible targets remain", async () => {
      await render(makeDaemon({ assignedTargetSystemIds: [] }));

      expect(hintText()).toContain("pamAccessConnectorAssignSelectHint");
    });

    it("says everything eligible is already assigned rather than that none exist", async () => {
      await render(makeDaemon());

      expect(hintText()).toContain("pamAccessConnectorAssignNoOptions");
    });

    it("says none exist when the org has no active automatic target system", async () => {
      rotationSdk.listTargetSystems.mockResolvedValue([]);
      await render(makeDaemon({ assignedTargetSystemIds: [] }));

      expect(hintText()).toContain("pamAccessConnectorAssignNoTargetSystems");
    });

    it("reports the load failure rather than claiming the org has no target systems", async () => {
      rotationSdk.listTargetSystems.mockRejectedValue(new Error("offline"));
      await render(makeDaemon({ assignedTargetSystemIds: [] }));

      expect(hintText()).toContain("pamAccessConnectorTargetSystemsLoadError");
    });

    it("leaves a staged-inactive connector to Assign's tooltip, and drops the hint", async () => {
      rotationSdk.listTargetSystems.mockResolvedValue([makeSystem(), makeOtherSystem()]);
      await render(makeDaemon({ status: AccessConnectorStatus.Disabled }));

      const tooltip = fixture.debugElement
        .query(By.css("#daemon-detail_button_assign"))
        .injector.get(TooltipDirective);

      expect(hintText()).toBeUndefined();
      expect(tooltip.tooltipContent()).toBe("pamAccessConnectorAssignTargetDisabled");
      expect(tooltip.addTooltipToDescribedby()).toBe(true);
    });

    it("keeps the Active checkbox's own hint, which says what deactivating releases", async () => {
      rotationSdk.listTargetSystems.mockResolvedValue([makeSystem(), makeOtherSystem()]);
      await render(makeDaemon({ status: AccessConnectorStatus.Disabled }));

      const status = (fixture.nativeElement as HTMLElement).querySelector("bit-form-control")!;

      expect(status.textContent).toContain("pamAccessConnectorActiveHint");
    });
  });

  describe("tabs", () => {
    const query = (selector: string) => fixture.nativeElement.querySelector(selector);

    it("offers a Configuration tab and a History tab, each with a route of its own", async () => {
      rotationSdk.getConnector.mockResolvedValue(makeDaemon());
      await setup(rotationSdk, connectorId("daemon-1"), mock<DialogService>(), {
        renderTemplate: true,
      });
      await createComponent();

      const links = Array.from(
        fixture.nativeElement.querySelectorAll("bit-tab-link"),
      ) as HTMLElement[];
      expect(links.map((el) => el.textContent?.trim())).toEqual([
        "pamAccessConnectorTabConfiguration",
        "pamAccessConnectorTabHistory",
      ]);
      const base = `/organizations/${ORGANIZATION_ID}/pam/rotation/access-connectors/${connectorId("daemon-1")}`;
      expect(links.map((el) => el.querySelector("a")?.getAttribute("href"))).toEqual([
        `${base}/configuration`,
        `${base}/history`,
      ]);
    });

    it("reads the open tab from the route", async () => {
      rotationSdk.getConnector.mockResolvedValue(makeDaemon());
      await setup(rotationSdk, connectorId("daemon-1"), mock<DialogService>(), { tab: "history" });
      const comp = await createComponent();

      expect(comp.activeTab()).toBe("history");
    });

    it("falls back to Configuration for a tab segment it does not know", async () => {
      rotationSdk.getConnector.mockResolvedValue(makeDaemon());
      await setup(rotationSdk, connectorId("daemon-1"), mock<DialogService>(), { tab: "nonsense" });
      const comp = await createComponent();

      expect(comp.activeTab()).toBe("configuration");
    });

    it("keeps the details card and the assignment picker on the Configuration tab", async () => {
      rotationSdk.getConnector.mockResolvedValue(makeDaemon());
      await setup(rotationSdk, connectorId("daemon-1"), mock<DialogService>(), {
        renderTemplate: true,
      });
      await createComponent();

      expect(query('[data-testid="connector-last-seen"]')).toBeTruthy();
      expect(query("pam-assignment-picker")).toBeTruthy();
      expect(query("app-rotation-history")).toBeNull();
    });

    it("renders the Configuration tab while the credential-name reads are still in flight", async () => {
      let settleConfigs!: (configs: RotationConfig[]) => void;
      rotationSdk.getConnector.mockResolvedValue(
        accessConnectorDetail({
          connector: accessConnector({ id: connectorId("daemon-1") }),
          jobs: [rotationJob()],
        }),
      );
      rotationSdk.listConfigs.mockReturnValue(
        new Promise<RotationConfig[]>((resolve) => (settleConfigs = resolve)),
      );
      await setup(rotationSdk, connectorId("daemon-1"), mock<DialogService>(), {
        renderTemplate: true,
        cipherNames: new Map(),
      });
      await createComponent();

      expect(query("pam-assignment-picker")).toBeTruthy();
      settleConfigs([]);
    });

    it("puts the history table on the History tab, naming each job's managed credential", async () => {
      rotationSdk.getConnector.mockResolvedValue(
        accessConnectorDetail({
          connector: accessConnector({ id: connectorId("daemon-1") }),
          jobs: [rotationJob()],
        }),
      );
      rotationSdk.listConfigs.mockResolvedValue([]);
      await setup(rotationSdk, connectorId("daemon-1"), mock<DialogService>(), {
        renderTemplate: true,
        tab: "history",
      });
      await createComponent();

      expect(query("app-rotation-history")).toBeTruthy();
      expect(query("pam-assignment-picker")).toBeNull();
      expect(fixture.nativeElement.textContent).toContain("pamRotationConfigColumnCredential");
    });

    /** The Credential column is the one place a connector's jobs are named by what they rotate. */
    it("names each job by the credential it rotated", async () => {
      rotationSdk.getConnector.mockResolvedValue(
        accessConnectorDetail({
          connector: accessConnector({ id: connectorId("daemon-1") }),
          jobs: [rotationJob({ rotationConfigId: configId("cfg-1") })],
        }),
      );
      rotationSdk.listConfigs.mockResolvedValue([
        rotationConfig({ id: configId("cfg-1"), cipherId: CIPHER_ID }),
      ]);
      await setup(rotationSdk, connectorId("daemon-1"), mock<DialogService>(), {
        renderTemplate: true,
        tab: "history",
        cipherNames: new Map([[CIPHER_ID, "Prod service account"]]),
      });
      await createComponent();

      expect(fixture.nativeElement.textContent).toContain("Prod service account");
    });

    it("falls back to the rotation config id when no name resolved", async () => {
      rotationSdk.getConnector.mockResolvedValue(
        accessConnectorDetail({
          connector: accessConnector({ id: connectorId("daemon-1") }),
          jobs: [rotationJob({ rotationConfigId: configId("cfg-1") })],
        }),
      );
      rotationSdk.listConfigs.mockResolvedValue([
        rotationConfig({ id: configId("cfg-1"), cipherId: CIPHER_ID }),
      ]);
      await setup(rotationSdk, connectorId("daemon-1"), mock<DialogService>(), {
        renderTemplate: true,
        tab: "history",
        cipherNames: new Map(),
      });
      await createComponent();

      expect(fixture.nativeElement.textContent).toContain(String(configId("cfg-1")));
    });

    it("names the tab and the section it opens with the same word", async () => {
      rotationSdk.getConnector.mockResolvedValue(makeDaemon());
      await setup(rotationSdk, connectorId("daemon-1"), mock<DialogService>(), {
        renderTemplate: true,
        tab: "history",
      });
      await createComponent();

      const tabLabel = (
        Array.from(fixture.nativeElement.querySelectorAll("bit-tab-link")) as HTMLElement[]
      )[1].textContent?.trim();
      expect(query("h2").textContent.trim()).toBe(tabLabel);
    });
  });

  describe("details card creation metadata", () => {
    /** The timestamp `rotation-builders` seeds both `creationDate` and `lastHeartbeatAt` with. */
    const seeded = accessConnector().creationDate;

    /** Formatted through the same pipe the template uses. */
    function expectedMedium(): string {
      return new DatePipe(TestBed.inject(LOCALE_ID)).transform(seeded, "medium") ?? "";
    }

    async function renderDetail(daemon: AccessConnectorDetail) {
      rotationSdk.getConnector.mockResolvedValue(daemon);
      await setup(rotationSdk, connectorId("daemon-1"), mock<DialogService>(), {
        renderTemplate: true,
      });
      await createComponent();
      return fixture;
    }

    it("renders the creation date", async () => {
      const rendered = await renderDetail(makeDaemon());

      expect(fieldText(rendered, "connector-created")).toBe(expectedMedium());
    });

    it("renders the last heartbeat as the last seen time", async () => {
      const rendered = await renderDetail(makeDaemon());

      expect(fieldText(rendered, "connector-last-seen")).toBe(expectedMedium());
    });

    it("renders 'Never' for a connector that has not checked in yet", async () => {
      const rendered = await renderDetail(makeDaemon({ lastHeartbeatAt: undefined }));

      expect(fieldText(rendered, "connector-last-seen")).toBe("never");
    });

    it("still renders the creation date when the connector has never been seen", async () => {
      const rendered = await renderDetail(makeDaemon({ lastHeartbeatAt: undefined }));

      expect(fieldText(rendered, "connector-created")).toBe(expectedMedium());
    });
  });

  describe("action row (rendered)", () => {
    async function render(
      daemon: AccessConnectorDetail,
      tab = "configuration",
    ): Promise<HTMLElement> {
      rotationSdk.getConnector.mockResolvedValue(daemon);
      await setup(rotationSdk, connectorId("daemon-1"), mock<DialogService>(), {
        renderTemplate: true,
        tab,
      });
      await createComponent();
      return fixture.nativeElement as HTMLElement;
    }

    function actionRow(el: HTMLElement): HTMLElement {
      return el.querySelector("#daemon-detail_button_save")?.parentElement as HTMLElement;
    }

    it("leaves the page header with its title and breadcrumbs only", async () => {
      const el = await render(makeDaemon());

      const header = el.querySelector("bit-header") as HTMLElement;
      expect(header).toBeTruthy();
      expect(header.querySelector("#daemon-detail_checkbox_active")).toBeNull();
      expect(header.querySelector("#daemon-detail_button_delete")).toBeNull();
    });

    it("puts Save and Delete in one row, Save first", async () => {
      const el = await render(makeDaemon());

      const row = actionRow(el);
      expect(Array.from(row.querySelectorAll("button")).map((b) => b.id)).toEqual([
        "daemon-detail_button_save",
        "daemon-detail_button_delete",
      ]);
    });

    it("submits the form from Save and pushes Delete to the far end", async () => {
      const el = await render(makeDaemon());

      expect(el.querySelector("#daemon-detail_button_save")?.getAttribute("type")).toBe("submit");
      expect(
        el.querySelector("#daemon-detail_button_delete")?.classList.contains("tw-ms-auto"),
      ).toBe(true);
    });

    it("is the only action row on the page, with no card of its own for the deletion", async () => {
      const el = await render(makeDaemon());

      expect(el.querySelectorAll("#daemon-detail_button_delete")).toHaveLength(1);
      expect(actionRow(el).closest("bit-card")).toBeNull();
      expect(el.textContent).not.toContain("pamAccessConnectorDeleteConfirmContent");
    });

    it("states the status as a form field in a card rather than an action-row button", async () => {
      const el = await render(makeDaemon());

      expect(actionRow(el).querySelector("#daemon-detail_checkbox_active")).toBeNull();
      const checkbox = el.querySelector("#daemon-detail_checkbox_active") as HTMLInputElement;
      expect(checkbox).toBeTruthy();
      expect(checkbox.closest("bit-card")).toBeTruthy();
      expect(el.textContent).toContain("pamAccessConnectorActiveHint");
    });

    it("offers both Save and Delete on the Configuration tab", async () => {
      const el = await render(makeDaemon(), "configuration");

      expect(el.querySelector("form")).not.toBeNull();
      expect(el.querySelector("#daemon-detail_button_save")).not.toBeNull();
      expect(el.querySelector("#daemon-detail_button_delete")).not.toBeNull();
    });

    it("offers neither Save nor Delete on the History tab", async () => {
      const el = await render(makeDaemon(), "history");

      expect(el.querySelector("form")).toBeNull();
      expect(el.querySelector("#daemon-detail_button_save")).toBeNull();
      expect(el.querySelector("#daemon-detail_button_delete")).toBeNull();
    });
  });

  describe("status card", () => {
    async function renderCheckbox(daemon: AccessConnectorDetail): Promise<HTMLInputElement> {
      rotationSdk.getConnector.mockResolvedValue(daemon);
      await setup(rotationSdk, connectorId("daemon-1"), mock<DialogService>(), {
        renderTemplate: true,
      });
      await createComponent();
      await fixture.whenStable();
      fixture.detectChanges();
      return (fixture.nativeElement as HTMLElement).querySelector(
        "#daemon-detail_checkbox_active",
      ) as HTMLInputElement;
    }

    it("checks the box for an active connector", async () => {
      const checkbox = await renderCheckbox(makeDaemon());

      expect(checkbox.checked).toBe(true);
    });

    it("clears the box for an inactive connector", async () => {
      const checkbox = await renderCheckbox(makeDaemon({ status: AccessConnectorStatus.Disabled }));

      expect(checkbox.checked).toBe(false);
    });

    it("stages the flip without writing it or moving the saved-status badge", async () => {
      const checkbox = await renderCheckbox(makeDaemon());
      const comp = fixture.componentInstance as unknown as DetailApi;

      checkbox.click();
      fixture.detectChanges();

      expect(rotationSdk.disableConnector).not.toHaveBeenCalled();
      expect(comp.stagedActive()).toBe(false);
      expect(comp.formGroup.dirty).toBe(true);
      expect(
        (fixture.nativeElement as HTMLElement).querySelector("#daemon-detail_badge_status")
          ?.textContent,
      ).toContain("pamAccessConnectorStatusActive");
    });
  });

  describe("loading skeleton", () => {
    const query = (selector: string) => fixture.nativeElement.querySelector(selector);

    afterEach(() => jest.useRealTimers());

    /** Runs the placeholder's clock on. */
    function advance(ms: number): void {
      fixture.detectChanges();
      jest.advanceTimersByTime(ms);
      fixture.detectChanges();
    }

    /** Renders the page with its load still in flight. */
    async function renderLoading(tab = "configuration") {
      rotationSdk.getConnector.mockResolvedValue(makeDaemon());
      rotationSdk.listTargetSystems.mockResolvedValue([makeSystem()]);
      jest.useFakeTimers({ doNotFake: ["nextTick", "queueMicrotask", "setImmediate"] });
      await setup(rotationSdk, connectorId("daemon-1"), mock<DialogService>(), {
        renderTemplate: true,
        tab,
      });
      fixture = TestBed.createComponent(DaemonDetailComponent);
      fixture.detectChanges();
    }

    /** Renders the page mid-load with its placeholder already drawn. */
    async function renderSkeleton(tab = "configuration") {
      await renderLoading(tab);
      advance(1000);
    }

    async function settle() {
      await fixture.whenStable();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    }

    it("stands skeleton cards in for the configuration form, in real furniture", async () => {
      await renderSkeleton();

      const loading = query('[data-testid="daemon-detail-loading"]');
      expect(query("bit-spinner")).toBeNull();
      expect(loading).not.toBeNull();
      expect(loading.querySelector("bit-skeleton")).not.toBeNull();
      expect(loading.textContent).toContain("pamAccessConnectorDetailsHeading");
      expect(query("form")).toBeNull();
    });

    it("keeps the placeholder itself out of the accessibility tree", async () => {
      await renderLoading();

      expect(query('[data-testid="daemon-detail-loading"]').getAttribute("aria-hidden")).toBe(
        "true",
      );
    });

    it("mirrors the history table instead when the history tab is the one loading", async () => {
      await renderSkeleton("history");

      const loading = query('[data-testid="daemon-detail-loading"]');
      expect(loading.querySelector("app-rotation-history-skeleton")).not.toBeNull();
      expect(loading.textContent).toContain("pamRotationHistoryColumnResult");
      expect(loading.textContent).not.toContain("pamAccessConnectorDetailsHeading");
    });

    it("announces the load from a live region, then the arrival", async () => {
      await renderSkeleton();

      const status = query('[data-testid="rotation-loading-status"]');
      expect(status.getAttribute("role")).toBe("status");
      expect(status.getAttribute("aria-live")).toBe("polite");
      expect(status.textContent).toContain("loading");

      await settle();
      advance(1000);

      expect(query('[data-testid="rotation-loading-status"]').textContent).toContain(
        "pamRotationPageLoaded",
      );
    });

    it("replaces the skeleton with the real form once the connector lands", async () => {
      await renderSkeleton();
      await settle();
      advance(1000);

      expect(query('[data-testid="daemon-detail-loading"]')).toBeNull();
      expect(query("bit-skeleton")).toBeNull();
      expect(query("form")).not.toBeNull();
      expect(query("#daemon-detail_checkbox_active")).not.toBeNull();
    });

    it("renders the page's own chrome, not a blank area, before the delay is up", async () => {
      await renderLoading();
      advance(999);

      expect(query('[data-testid="daemon-detail-loading"]')).not.toBeNull();
      expect(query("bit-skeleton")).toBeNull();
      expect(query("pam-detail-breadcrumb")).not.toBeNull();
    });

    it("never draws the placeholder for a connector that arrives inside the delay", async () => {
      await renderLoading();
      advance(500);
      await settle();
      advance(1000);

      expect(query("bit-skeleton")).toBeNull();
      expect(query('[data-testid="daemon-detail-loading"]')).toBeNull();
      expect(query("#daemon-detail_checkbox_active")).not.toBeNull();
    });

    it("holds the placeholder its minimum time once it is up, so it cannot blink", async () => {
      await renderSkeleton();
      expect(query("bit-skeleton")).not.toBeNull();

      await settle();
      advance(300);

      expect(query("bit-skeleton")).not.toBeNull();

      advance(700);

      expect(query("bit-skeleton")).toBeNull();
      expect(query("#daemon-detail_checkbox_active")).not.toBeNull();
    });

    it("announces the load at once, not on the placeholder's clock", async () => {
      await renderLoading();

      expect(query('[data-testid="rotation-loading-status"]').textContent).toContain("loading");
      expect(query("bit-skeleton")).toBeNull();
    });
  });
});
