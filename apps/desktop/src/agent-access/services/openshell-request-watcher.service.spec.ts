import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { AgentAccessOpenShellApproveRequestDialogComponent } from "../components/agent-access-openshell-approve-request-dialog.component";
import { OpenShellRequest } from "../models/openshell-requests";

import { OpenShellRequestWatcherService } from "./openshell-request-watcher.service";
import { OpenShellRequestsCountService } from "./openshell-requests-count.service";

const ID = "927d2e27-780a-4efb-ba16-b8fc1cd0fe32";

function request(overrides: Partial<OpenShellRequest> = {}): OpenShellRequest {
  return {
    id: ID,
    status: "pending",
    rule: "r",
    endpoints: [{ host: "httpbin.org", port: 443, access: "" }],
    programs: ["/usr/bin/curl"],
    rationale: "",
    flagged: false,
    flagNote: "",
    hits: 1,
    firstSeen: "",
    lastSeen: "",
    ...overrides,
  };
}

describe("OpenShellRequestWatcherService", () => {
  let ipcMock: Record<string, jest.Mock>;
  let originalIpc: unknown;
  let pending: OpenShellRequest[];
  let open: jest.SpyInstance;
  let active$: BehaviorSubject<boolean>;
  let service: OpenShellRequestWatcherService;

  beforeEach(() => {
    jest.useFakeTimers();
    pending = [request()];
    ipcMock = {
      listOpenShellSandboxes: jest.fn().mockResolvedValue({
        ok: true,
        data: [
          { name: "bw-live", phase: "Ready" },
          { name: "idle", phase: "Stopped" },
        ],
      }),
      listOpenShellRequests: jest
        .fn()
        .mockImplementation(async () => ({ ok: true, data: pending })),
      approveOpenShellRequest: jest.fn().mockResolvedValue({ ok: true, data: undefined }),
      rejectOpenShellRequest: jest.fn().mockResolvedValue({ ok: true, data: undefined }),
      listOpenShellProfiles: jest.fn().mockResolvedValue({ ok: true, data: [] }),
    };
    originalIpc = (global as any).ipc;
    (global as any).ipc = { agentAccess: ipcMock };
    open = jest
      .spyOn(AgentAccessOpenShellApproveRequestDialogComponent, "open")
      .mockReturnValue({ closed: of({ decision: "approve" }) } as any);
    TestBed.configureTestingModule({
      providers: [
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: I18nService, useValue: mock<I18nService>() },
        OpenShellRequestsCountService,
      ],
    });
    service = TestBed.inject(OpenShellRequestWatcherService);
    active$ = new BehaviorSubject(true);
  });

  afterEach(() => {
    service.ngOnDestroy();
    (global as any).ipc = originalIpc;
    jest.useRealTimers();
    jest.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  const tick = async (ms: number) => {
    await jest.advanceTimersByTimeAsync(ms);
  };

  it("pops the approval dialog for a pending request in a running sandbox and acts on it", async () => {
    service.start(active$);
    await tick(0);

    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        sandboxName: "bw-live",
        request: expect.objectContaining({ id: ID }),
      }),
    );
    expect(ipcMock.approveOpenShellRequest).toHaveBeenCalledWith({
      sandboxName: "bw-live",
      chunkId: ID,
    });
  });

  it("does not look at stopped sandboxes", async () => {
    service.start(active$);
    await tick(0);

    expect(ipcMock.listOpenShellRequests).toHaveBeenCalledTimes(2); // read + re-read, bw-live only
    expect(
      ipcMock.listOpenShellRequests.mock.calls.every(([arg]) => arg.sandboxName === "bw-live"),
    ).toBe(true);
  });

  it("shows each request once, even when it is dismissed and still pending", async () => {
    open.mockReturnValue({ closed: of(undefined) } as any);
    service.start(active$);
    await tick(0);
    await tick(15_000);
    await tick(15_000);

    expect(open).toHaveBeenCalledTimes(1);
    expect(ipcMock.approveOpenShellRequest).not.toHaveBeenCalled();
    expect(ipcMock.rejectOpenShellRequest).not.toHaveBeenCalled();
  });

  it("denies with only the id when the user denies", async () => {
    open.mockReturnValue({ closed: of({ decision: "deny" }) } as any);
    service.start(active$);
    await tick(0);

    expect(ipcMock.rejectOpenShellRequest).toHaveBeenCalledWith({
      sandboxName: "bw-live",
      chunkId: ID,
    });
  });

  it("does nothing while inactive (locked or the feature is off)", async () => {
    active$.next(false);
    service.start(active$);
    await tick(30_000);

    expect(ipcMock.listOpenShellSandboxes).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it("stays quiet when the gateway cannot be read", async () => {
    ipcMock.listOpenShellSandboxes.mockResolvedValue({ ok: false, error: "gatewayUnreachable" });
    service.start(active$);
    await tick(0);

    expect(open).not.toHaveBeenCalled();
  });
});
