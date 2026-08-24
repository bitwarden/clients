import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router, provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";

import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { RotationDaemonDetailsResponse } from "../responses/rotation-daemon-details.response";
import { TargetSystemResponse } from "../responses/target-system.response";
import { RotationApiService } from "../rotation-api.service";

import { DaemonDetailComponent } from "./daemon-detail.component";

const i18nFake: Pick<I18nService, "t" | "translate"> = {
  t: (id: string) => id,
  translate: (id: string) => id,
};

function makeDaemon(overrides: Record<string, unknown> = {}): RotationDaemonDetailsResponse {
  return new RotationDaemonDetailsResponse({
    Id: "daemon-1",
    Name: "On-prem daemon",
    Status: 0,
    IsConnected: true,
    AssignedTargetSystemIds: ["ts-1"],
    Jobs: [],
    ...overrides,
  });
}

function makeSystem(): TargetSystemResponse {
  return new TargetSystemResponse({
    Id: "ts-1",
    Name: "Prod Entra",
    Method: 0,
    Kind: 0,
    Status: 0,
    PasswordPolicy: null,
    SupportsSessionTermination: true,
  });
}

function makeListResponse(data: TargetSystemResponse[]): ListResponse<TargetSystemResponse> {
  return { data, continuationToken: null } as unknown as ListResponse<TargetSystemResponse>;
}

async function setup(
  rotationApi: ReturnType<typeof mock<RotationApiService>>,
  daemonId = "daemon-1",
  dialogService: ReturnType<typeof mock<DialogService>> = mock<DialogService>(),
) {
  TestBed.overrideComponent(DaemonDetailComponent, { set: { template: "", imports: [] } });
  await TestBed.configureTestingModule({
    imports: [DaemonDetailComponent],
    providers: [
      provideRouter([]),
      { provide: RotationApiService, useValue: rotationApi },
      { provide: I18nService, useValue: i18nFake },
      { provide: ToastService, useValue: mock<ToastService>() },
      { provide: DialogService, useValue: dialogService },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { params: { organizationId: "org-1", daemonId } } },
      },
    ],
  }).compileComponents();
}

describe("DaemonDetailComponent", () => {
  let fixture: ComponentFixture<DaemonDetailComponent>;
  let rotationApi: ReturnType<typeof mock<RotationApiService>>;

  beforeEach(() => {
    rotationApi = mock<RotationApiService>();
    rotationApi.listTargetSystems.mockResolvedValue(makeListResponse([makeSystem()]));
  });

  it("loads the daemon on init", async () => {
    rotationApi.getRotationDaemon.mockResolvedValue(makeDaemon());
    await setup(rotationApi);
    fixture = TestBed.createComponent(DaemonDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(rotationApi.getRotationDaemon).toHaveBeenCalledWith("org-1", "daemon-1");
    const comp = fixture.componentInstance as unknown as { titleText: () => string };
    expect(comp.titleText()).toBe("On-prem daemon");
  });

  it("resolves assignment ids to target-system names", async () => {
    rotationApi.getRotationDaemon.mockResolvedValue(makeDaemon());
    await setup(rotationApi);
    fixture = TestBed.createComponent(DaemonDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const comp = fixture.componentInstance as unknown as { assignmentNames: () => string[] };
    expect(comp.assignmentNames()).toEqual(["Prod Entra"]);
  });

  it("disables the daemon after confirmation and patches status", async () => {
    rotationApi.getRotationDaemon.mockResolvedValue(makeDaemon());
    rotationApi.disableRotationDaemon.mockResolvedValue(undefined);
    const dialog = mock<DialogService>();
    dialog.openSimpleDialog.mockResolvedValue(true);
    await setup(rotationApi, "daemon-1", dialog);
    fixture = TestBed.createComponent(DaemonDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const comp = fixture.componentInstance as unknown as {
      disable: () => Promise<void>;
      enabled: () => boolean;
    };
    await comp.disable();

    expect(rotationApi.disableRotationDaemon).toHaveBeenCalledWith("org-1", "daemon-1");
    expect(comp.enabled()).toBe(false);
  });

  it("deletes the daemon after confirmation and navigates back", async () => {
    rotationApi.getRotationDaemon.mockResolvedValue(makeDaemon());
    rotationApi.deleteRotationDaemon.mockResolvedValue(undefined);
    const dialog = mock<DialogService>();
    dialog.openSimpleDialog.mockResolvedValue(true);
    await setup(rotationApi, "daemon-1", dialog);
    const router = TestBed.inject(Router);
    const nav = jest.spyOn(router, "navigate").mockResolvedValue(true);
    fixture = TestBed.createComponent(DaemonDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const comp = fixture.componentInstance as unknown as { deleteDaemon: () => Promise<void> };
    await comp.deleteDaemon();

    expect(rotationApi.deleteRotationDaemon).toHaveBeenCalledWith("org-1", "daemon-1");
    expect(nav).toHaveBeenCalled();
  });

  it("toasts and navigates back when the daemon is not found", async () => {
    rotationApi.getRotationDaemon.mockRejectedValue(new Error("not found"));
    await setup(rotationApi, "missing");
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
