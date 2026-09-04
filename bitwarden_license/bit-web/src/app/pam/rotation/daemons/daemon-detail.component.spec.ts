import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { ActivatedRoute, Router, provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { DaemonStatus } from "../rotation";
import type { AccessConnector, AccessConnectorDetail, TargetSystem } from "../rotation";
import { RotationSdkService } from "../rotation-sdk.service";
import {
  ORGANIZATION_ID,
  accessConnector,
  accessConnectorDetail,
  connectorId,
  sysId,
  targetSystem,
} from "../testing/rotation-builders";

import type { AssignTargetDialogParams } from "./assign-target-dialog.component";
import { DaemonAssignment, DaemonDetailComponent } from "./daemon-detail.component";

const i18nFake: Pick<I18nService, "t" | "translate"> = {
  t: (id: string) => id,
  translate: (id: string) => id,
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
  return targetSystem({ id: sysId("ts-2"), name: "Prod MSSQL" });
}

async function setup(
  rotationSdk: ReturnType<typeof mock<RotationSdkService>>,
  daemonId = connectorId("daemon-1"),
  dialogService: ReturnType<typeof mock<DialogService>> = mock<DialogService>(),
) {
  TestBed.overrideComponent(DaemonDetailComponent, { set: { template: "", imports: [] } });
  await TestBed.configureTestingModule({
    imports: [DaemonDetailComponent],
    providers: [
      provideRouter([]),
      { provide: RotationSdkService, useValue: rotationSdk },
      { provide: I18nService, useValue: i18nFake },
      { provide: ToastService, useValue: mock<ToastService>() },
      { provide: DialogService, useValue: dialogService },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { params: { organizationId: ORGANIZATION_ID, daemonId } } },
      },
    ],
  }).compileComponents();
}

describe("DaemonDetailComponent", () => {
  let fixture: ComponentFixture<DaemonDetailComponent>;
  let rotationSdk: ReturnType<typeof mock<RotationSdkService>>;

  beforeEach(() => {
    rotationSdk = mock<RotationSdkService>();
    rotationSdk.listTargetSystems.mockResolvedValue([makeSystem()]);
  });

  it("loads the daemon on init", async () => {
    rotationSdk.getConnector.mockResolvedValue(makeDaemon());
    await setup(rotationSdk);
    fixture = TestBed.createComponent(DaemonDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(rotationSdk.getConnector).toHaveBeenCalledWith(ORGANIZATION_ID, connectorId("daemon-1"));
    const comp = fixture.componentInstance as unknown as { titleText: () => string };
    expect(comp.titleText()).toBe("On-prem daemon");
  });

  it("resolves assignment ids to target-system names", async () => {
    rotationSdk.getConnector.mockResolvedValue(makeDaemon());
    await setup(rotationSdk);
    fixture = TestBed.createComponent(DaemonDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const comp = fixture.componentInstance as unknown as {
      assignments: () => DaemonAssignment[];
    };
    expect(comp.assignments()).toEqual([{ id: sysId("ts-1"), name: "Prod Entra" }]);
  });

  it("assigns the selected target and patches assignments locally", async () => {
    rotationSdk.getConnector.mockResolvedValue(makeDaemon());
    rotationSdk.listTargetSystems.mockResolvedValue([makeSystem(), makeOtherSystem()]);
    rotationSdk.assignTarget.mockResolvedValue(undefined);
    const dialog = mock<DialogService>();
    dialog.open.mockReturnValue({ closed: of(sysId("ts-2")) } as never);
    await setup(rotationSdk, connectorId("daemon-1"), dialog);
    fixture = TestBed.createComponent(DaemonDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const comp = fixture.componentInstance as unknown as {
      assignTarget: () => Promise<void>;
      assignments: () => DaemonAssignment[];
    };
    await comp.assignTarget();

    expect(rotationSdk.assignTarget).toHaveBeenCalledWith(
      ORGANIZATION_ID,
      connectorId("daemon-1"),
      sysId("ts-2"),
    );
    expect(comp.assignments().map((a) => a.name)).toEqual(["Prod Entra", "Prod MSSQL"]);
  });

  it("offers only unassigned active automatic targets to the dialog", async () => {
    rotationSdk.getConnector.mockResolvedValue(makeDaemon());
    rotationSdk.listTargetSystems.mockResolvedValue([makeSystem(), makeOtherSystem()]);
    rotationSdk.assignTarget.mockResolvedValue(undefined);
    const dialog = mock<DialogService>();
    dialog.open.mockReturnValue({ closed: of(sysId("ts-2")) } as never);
    await setup(rotationSdk, connectorId("daemon-1"), dialog);
    fixture = TestBed.createComponent(DaemonDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const comp = fixture.componentInstance as unknown as { assignTarget: () => Promise<void> };
    await comp.assignTarget();

    const config = dialog.open.mock.calls[0][1] as unknown as {
      data: { options: TargetSystem[] };
    };
    expect(config.data.options.map((s) => s.id)).toEqual([sysId("ts-2")]);
  });

  describe("assignTarget", () => {
    let dialog: ReturnType<typeof mock<DialogService>>;

    async function openAssign(): Promise<void> {
      dialog = mock<DialogService>();
      dialog.open.mockReturnValue({ closed: of(undefined) } as never);
      await setup(rotationSdk, connectorId("daemon-1"), dialog);
      fixture = TestBed.createComponent(DaemonDetailComponent);
      fixture.detectChanges();
      await fixture.whenStable();

      const comp = fixture.componentInstance as unknown as { assignTarget: () => Promise<void> };
      await comp.assignTarget();
    }

    function dialogData(): AssignTargetDialogParams {
      return (dialog.open.mock.calls[0][1] as unknown as { data: AssignTargetDialogParams }).data;
    }

    it("flags that the org has no active automatic target system", async () => {
      rotationSdk.getConnector.mockResolvedValue(makeDaemon({ assignedTargetSystemIds: [] }));
      rotationSdk.listTargetSystems.mockResolvedValue([]);

      await openAssign();

      expect(dialogData().options).toEqual([]);
      expect(dialogData().noActiveAutomaticSystems).toBe(true);
    });

    it("does not flag when the only active system is already assigned to this daemon", async () => {
      rotationSdk.getConnector.mockResolvedValue(makeDaemon());
      rotationSdk.listTargetSystems.mockResolvedValue([makeSystem()]);

      await openAssign();

      expect(dialogData().options).toEqual([]);
      expect(dialogData().noActiveAutomaticSystems).toBe(false);
    });

    it("surfaces the error instead of opening the dialog when the target-systems load failed", async () => {
      rotationSdk.getConnector.mockResolvedValue(makeDaemon());
      rotationSdk.listTargetSystems.mockRejectedValue(new Error("boom"));

      await openAssign();

      expect(dialog.open).not.toHaveBeenCalled();
      expect(rotationSdk.assignTarget).not.toHaveBeenCalled();
      expect(TestBed.inject(ToastService).showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
    });
  });

  it("does not open the assign dialog while the daemon is disabled", async () => {
    rotationSdk.getConnector.mockResolvedValue(makeDaemon({ status: DaemonStatus.Disabled }));
    rotationSdk.listTargetSystems.mockResolvedValue([makeSystem(), makeOtherSystem()]);
    const dialog = mock<DialogService>();
    await setup(rotationSdk, connectorId("daemon-1"), dialog);
    fixture = TestBed.createComponent(DaemonDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const comp = fixture.componentInstance as unknown as { assignTarget: () => Promise<void> };
    await comp.assignTarget();

    expect(dialog.open).not.toHaveBeenCalled();
    expect(rotationSdk.assignTarget).not.toHaveBeenCalled();
  });

  it("keeps a newly assigned target when a removal overlaps the assign", async () => {
    let resolveAssign: (() => void) | undefined;
    const assigning = new Promise<void>((resolve) => {
      resolveAssign = resolve;
    });
    rotationSdk.getConnector.mockResolvedValue(makeDaemon());
    rotationSdk.listTargetSystems.mockResolvedValue([makeSystem(), makeOtherSystem()]);
    rotationSdk.assignTarget.mockReturnValue(assigning);
    rotationSdk.unassignTarget.mockResolvedValue(undefined);
    const dialog = mock<DialogService>();
    dialog.open.mockReturnValue({ closed: of(sysId("ts-2")) } as never);
    dialog.openSimpleDialog.mockResolvedValue(true);
    await setup(rotationSdk, connectorId("daemon-1"), dialog);
    fixture = TestBed.createComponent(DaemonDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const comp = fixture.componentInstance as unknown as {
      assignTarget: () => Promise<void>;
      unassign: (assignment: DaemonAssignment) => Promise<void>;
      assignments: () => DaemonAssignment[];
    };
    const assigned = comp.assignTarget();
    const removed = comp.unassign({ id: sysId("ts-1"), name: "Prod Entra" });
    resolveAssign?.();
    await assigned;
    await removed;

    expect(comp.assignments().map((a) => a.id)).toEqual([sysId("ts-2")]);
  });

  it("does not call assignTarget when the dialog is dismissed", async () => {
    rotationSdk.getConnector.mockResolvedValue(makeDaemon());
    rotationSdk.listTargetSystems.mockResolvedValue([makeSystem(), makeOtherSystem()]);
    const dialog = mock<DialogService>();
    dialog.open.mockReturnValue({ closed: of(undefined) } as never);
    await setup(rotationSdk, connectorId("daemon-1"), dialog);
    fixture = TestBed.createComponent(DaemonDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const comp = fixture.componentInstance as unknown as { assignTarget: () => Promise<void> };
    await comp.assignTarget();

    expect(rotationSdk.assignTarget).not.toHaveBeenCalled();
  });

  it("unassigns after confirmation and patches assignments locally", async () => {
    rotationSdk.getConnector.mockResolvedValue(makeDaemon());
    rotationSdk.unassignTarget.mockResolvedValue(undefined);
    const dialog = mock<DialogService>();
    dialog.openSimpleDialog.mockResolvedValue(true);
    await setup(rotationSdk, connectorId("daemon-1"), dialog);
    fixture = TestBed.createComponent(DaemonDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const comp = fixture.componentInstance as unknown as {
      unassign: (assignment: DaemonAssignment) => Promise<void>;
      assignments: () => DaemonAssignment[];
    };
    await comp.unassign({ id: sysId("ts-1"), name: "Prod Entra" });

    expect(rotationSdk.unassignTarget).toHaveBeenCalledWith(
      ORGANIZATION_ID,
      connectorId("daemon-1"),
      sysId("ts-1"),
    );
    expect(comp.assignments()).toEqual([]);
  });

  it("does not unassign when the confirmation is declined", async () => {
    rotationSdk.getConnector.mockResolvedValue(makeDaemon());
    const dialog = mock<DialogService>();
    dialog.openSimpleDialog.mockResolvedValue(false);
    await setup(rotationSdk, connectorId("daemon-1"), dialog);
    fixture = TestBed.createComponent(DaemonDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const comp = fixture.componentInstance as unknown as {
      unassign: (assignment: DaemonAssignment) => Promise<void>;
      assignments: () => DaemonAssignment[];
    };
    await comp.unassign({ id: sysId("ts-1"), name: "Prod Entra" });

    expect(rotationSdk.unassignTarget).not.toHaveBeenCalled();
    expect(comp.assignments()).toHaveLength(1);
  });

  it("disables the daemon after confirmation and patches status", async () => {
    rotationSdk.getConnector.mockResolvedValue(makeDaemon());
    rotationSdk.disableConnector.mockResolvedValue(undefined);
    const dialog = mock<DialogService>();
    dialog.openSimpleDialog.mockResolvedValue(true);
    await setup(rotationSdk, connectorId("daemon-1"), dialog);
    fixture = TestBed.createComponent(DaemonDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const comp = fixture.componentInstance as unknown as {
      disable: () => Promise<void>;
      enabled: () => boolean;
    };
    await comp.disable();

    expect(rotationSdk.disableConnector).toHaveBeenCalledWith(
      ORGANIZATION_ID,
      connectorId("daemon-1"),
    );
    expect(comp.enabled()).toBe(false);
  });

  it("deletes the daemon after confirmation and navigates back", async () => {
    rotationSdk.getConnector.mockResolvedValue(makeDaemon());
    rotationSdk.deleteConnector.mockResolvedValue(undefined);
    const dialog = mock<DialogService>();
    dialog.openSimpleDialog.mockResolvedValue(true);
    await setup(rotationSdk, connectorId("daemon-1"), dialog);
    const router = TestBed.inject(Router);
    const nav = jest.spyOn(router, "navigate").mockResolvedValue(true);
    fixture = TestBed.createComponent(DaemonDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const comp = fixture.componentInstance as unknown as { deleteDaemon: () => Promise<void> };
    await comp.deleteDaemon();

    expect(rotationSdk.deleteConnector).toHaveBeenCalledWith(
      ORGANIZATION_ID,
      connectorId("daemon-1"),
    );
    expect(nav).toHaveBeenCalled();
  });

  it("toasts and navigates back when the daemon is not found", async () => {
    rotationSdk.getConnector.mockRejectedValue(new Error("not found"));
    await setup(rotationSdk, connectorId("missing"));
    const router = TestBed.inject(Router);
    const nav = jest.spyOn(router, "navigate").mockResolvedValue(true);
    const toast = TestBed.inject(ToastService);

    fixture = TestBed.createComponent(DaemonDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(nav).toHaveBeenCalled();
    expect(toast.showToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
  });
});

// JSDOM has no ResizeObserver; bit-breadcrumbs renders through bitOverflowList, which constructs one.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(global as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;

// Mounts the real template (no override) so where the action row sits in the DOM is asserted
// against what renders — the one thing a template-stubbed spec cannot see.
describe("DaemonDetailComponent — action row (rendered)", () => {
  async function render(daemon: AccessConnectorDetail): Promise<HTMLElement> {
    const rotationSdk = mock<RotationSdkService>();
    rotationSdk.getConnector.mockResolvedValue(daemon);
    rotationSdk.listTargetSystems.mockResolvedValue([makeSystem()]);
    await TestBed.configureTestingModule({
      imports: [DaemonDetailComponent, NoopAnimationsModule],
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
              params: { organizationId: ORGANIZATION_ID, daemonId: connectorId("daemon-1") },
            },
          },
        },
      ],
    }).compileComponents();
    const fixture: ComponentFixture<DaemonDetailComponent> =
      TestBed.createComponent(DaemonDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it("leaves the page header with its title and breadcrumbs only", async () => {
    const el = await render(makeDaemon());

    const header = el.querySelector("bit-header") as HTMLElement;
    expect(header).toBeTruthy();
    expect(header.querySelector("#daemon-detail_button_disable")).toBeNull();
    expect(header.querySelector("#daemon-detail_button_enable")).toBeNull();
    expect(header.querySelector("#daemon-detail_button_delete")).toBeNull();
  });

  it("puts Disable and Delete in one row at the foot of the page content", async () => {
    const el = await render(makeDaemon());

    const row = el.querySelector(".tw-max-w-4xl")?.lastElementChild as HTMLElement;
    expect(Array.from(row.querySelectorAll("button")).map((b) => b.id)).toEqual([
      "daemon-detail_button_disable",
      "daemon-detail_button_delete",
    ]);
  });

  it("right-aligns Delete so it reads last", async () => {
    const el = await render(makeDaemon());

    const del = el.querySelector("#daemon-detail_button_delete") as HTMLElement;
    expect(del.className).toContain("tw-ms-auto");
  });

  it("offers Enable in the same row when the connector is disabled", async () => {
    const el = await render(makeDaemon({ status: DaemonStatus.Disabled }));

    const row = el.querySelector(".tw-max-w-4xl")?.lastElementChild as HTMLElement;
    expect(row.querySelector("#daemon-detail_button_enable")).toBeTruthy();
    expect(row.querySelector("#daemon-detail_button_disable")).toBeNull();
  });
});
