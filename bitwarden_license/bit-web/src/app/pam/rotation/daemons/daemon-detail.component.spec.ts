import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router, provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";

import {
  PamApiService,
  RotationDaemonDetailsResponse,
  TargetSystemResponse,
} from "@bitwarden/bit-pam";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";

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

async function setup(pamApi: ReturnType<typeof mock<PamApiService>>, daemonId = "daemon-1") {
  TestBed.overrideComponent(DaemonDetailComponent, { set: { template: "", imports: [] } });
  await TestBed.configureTestingModule({
    imports: [DaemonDetailComponent],
    providers: [
      provideRouter([]),
      { provide: PamApiService, useValue: pamApi },
      { provide: I18nService, useValue: i18nFake },
      { provide: ToastService, useValue: mock<ToastService>() },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { params: { organizationId: "org-1", daemonId } } },
      },
    ],
  }).compileComponents();
}

describe("DaemonDetailComponent", () => {
  let fixture: ComponentFixture<DaemonDetailComponent>;
  let pamApi: ReturnType<typeof mock<PamApiService>>;

  beforeEach(() => {
    pamApi = mock<PamApiService>();
    pamApi.listTargetSystems.mockResolvedValue(makeListResponse([makeSystem()]));
  });

  it("loads the daemon on init", async () => {
    pamApi.getRotationDaemon.mockResolvedValue(makeDaemon());
    await setup(pamApi);
    fixture = TestBed.createComponent(DaemonDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(pamApi.getRotationDaemon).toHaveBeenCalledWith("org-1", "daemon-1");
    const comp = fixture.componentInstance as unknown as { titleText: () => string };
    expect(comp.titleText()).toBe("On-prem daemon");
  });

  it("resolves assignment ids to target-system names", async () => {
    pamApi.getRotationDaemon.mockResolvedValue(makeDaemon());
    await setup(pamApi);
    fixture = TestBed.createComponent(DaemonDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const comp = fixture.componentInstance as unknown as { assignmentNames: () => string[] };
    expect(comp.assignmentNames()).toEqual(["Prod Entra"]);
  });

  it("toasts and navigates back when the daemon is not found", async () => {
    pamApi.getRotationDaemon.mockRejectedValue(new Error("not found"));
    await setup(pamApi, "missing");
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
