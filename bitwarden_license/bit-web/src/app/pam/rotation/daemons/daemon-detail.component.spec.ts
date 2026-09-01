import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router, provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, ToastService } from "@bitwarden/components";

import type { AccessConnectorDetailView, TargetSystemView } from "../rotation";
import { RotationSdkService } from "../rotation-sdk.service";
import {
  ORGANIZATION_ID,
  accessConnectorDetailView,
  connectorId,
  sysId,
  targetSystemView,
} from "../testing/rotation-builders";

import { DaemonDetailComponent } from "./daemon-detail.component";

const i18nFake: Pick<I18nService, "t" | "translate"> = {
  t: (id: string) => id,
  translate: (id: string) => id,
};

function makeDaemon(overrides: Partial<AccessConnectorDetailView> = {}): AccessConnectorDetailView {
  return accessConnectorDetailView({
    id: connectorId("daemon-1"),
    name: "On-prem daemon",
    assignedTargetSystemIds: [sysId("ts-1")],
    ...overrides,
  });
}

function makeSystem(): TargetSystemView {
  return targetSystemView({ id: sysId("ts-1"), name: "Prod Entra" });
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

    const comp = fixture.componentInstance as unknown as { assignmentNames: () => string[] };
    expect(comp.assignmentNames()).toEqual(["Prod Entra"]);
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
