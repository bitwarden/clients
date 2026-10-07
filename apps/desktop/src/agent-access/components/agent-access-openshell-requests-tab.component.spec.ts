import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { ActivatedRoute, convertToParamMap } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService } from "@bitwarden/components";

import { OpenShellRequest } from "../models/openshell-requests";
import { OpenShellRequestsCountService } from "../services/openshell-requests-count.service";

import {
  AgentAccessOpenShellApproveRequestDecision,
  AgentAccessOpenShellApproveRequestDialogComponent,
} from "./agent-access-openshell-approve-request-dialog.component";
import { AgentAccessOpenShellPermissionDialogComponent } from "./agent-access-openshell-permission-dialog.component";
import {
  AgentAccessOpenShellRequestsTabComponent,
  openShellRequestProgramName,
  openShellRequestTarget,
} from "./agent-access-openshell-requests-tab.component";

const ID = "927d2e27-780a-4efb-ba16-b8fc1cd0fe32";
const ID2 = "a27d2e27-780a-4efb-ba16-b8fc1cd0fe33";

function request(overrides: Partial<OpenShellRequest> = {}): OpenShellRequest {
  return {
    id: ID,
    status: "pending",
    rule: "allow_api_stripe_com_443",
    endpoints: [{ host: "api.stripe.com", port: 443, access: "read-only" }],
    programs: ["/usr/bin/curl"],
    rationale: "Charge a card",
    flagged: false,
    flagNote: "",
    hits: 3,
    firstSeen: "",
    lastSeen: "",
    ...overrides,
  };
}

describe("AgentAccessOpenShellRequestsTabComponent", () => {
  let agentAccessIpc: Record<string, jest.Mock>;
  let originalIpc: unknown;
  let dialogService: ReturnType<typeof mock<DialogService>>;
  let byStatus: Record<string, OpenShellRequest[]>;

  beforeAll(() => {
    // jsdom has no ResizeObserver; the toggle group measures itself with one.
    (global as any).ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  beforeEach(() => {
    byStatus = { pending: [request()], approved: [], rejected: [] };
    agentAccessIpc = {
      listOpenShellRequests: jest
        .fn()
        .mockImplementation(async ({ status }: { status: string }) => ({
          ok: true,
          data: byStatus[status] ?? [],
        })),
      approveOpenShellRequest: jest.fn().mockResolvedValue({ ok: true, data: undefined }),
      rejectOpenShellRequest: jest.fn().mockResolvedValue({ ok: true, data: undefined }),
      listOpenShellProfiles: jest.fn().mockResolvedValue({ ok: true, data: [{ id: "github" }] }),
    };
    originalIpc = (global as any).ipc;
    (global as any).ipc = { agentAccess: agentAccessIpc };
    dialogService = mock<DialogService>();
  });

  afterEach(() => {
    (global as any).ipc = originalIpc;
    jest.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  async function render(): Promise<ComponentFixture<AgentAccessOpenShellRequestsTabComponent>> {
    const i18n = mock<I18nService>();
    i18n.t.mockImplementation((key: string, ...args: unknown[]) => [key, ...args].join("|"));
    const paramMap = new BehaviorSubject(convertToParamMap({ name: "alpha" }));
    TestBed.configureTestingModule({
      imports: [AgentAccessOpenShellRequestsTabComponent, NoopAnimationsModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { parent: { paramMap, snapshot: { paramMap: paramMap.value } } },
        },
        { provide: I18nService, useValue: i18n },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: DialogService, useValue: dialogService },
      ],
    });
    const fixture = TestBed.createComponent(AgentAccessOpenShellRequestsTabComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const el = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;
  const q = (f: ComponentFixture<unknown>, testId: string) =>
    el(f).querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const all = (f: ComponentFixture<unknown>, testId: string) =>
    Array.from(el(f).querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`));
  const click = async (f: ComponentFixture<unknown>, testId: string, index = 0) => {
    all(f, testId)[index].click();
    await f.whenStable();
    f.detectChanges();
  };

  /** Clicks Review and answers the approval popup with `decision`. */
  const decide = async (
    f: ComponentFixture<unknown>,
    decision: AgentAccessOpenShellApproveRequestDecision | undefined,
  ) => {
    const open = jest
      .spyOn(AgentAccessOpenShellApproveRequestDialogComponent, "open")
      .mockReturnValue({ closed: of(decision ? { decision } : undefined) } as any);
    await click(f, "openshell-request-review");
    return open;
  };

  describe("helpers", () => {
    it("names the program by its file name and hides the default port", () => {
      expect(openShellRequestProgramName("/usr/bin/curl")).toBe("curl");
      expect(openShellRequestProgramName("curl")).toBe("curl");
      expect(openShellRequestTarget({ host: "a.com", port: 443, access: "" })).toBe("a.com");
      expect(openShellRequestTarget({ host: "a.com", port: 8080, access: "" })).toBe("a.com:8080");
    });
  });

  it("reads the pending requests for this sandbox and shows one in plain words", async () => {
    const fixture = await render();

    expect(agentAccessIpc.listOpenShellRequests).toHaveBeenCalledWith({
      sandboxName: "alpha",
      status: "pending",
    });
    expect(all(fixture, "openshell-request")).toHaveLength(1);
    expect(q(fixture, "openshell-request-summary").textContent).toContain(
      "agentAccessOsReqSummaryWithProgram|api.stripe.com|curl",
    );
    expect(q(fixture, "openshell-request-reason").textContent).toContain("Charge a card");
    expect(q(fixture, "openshell-request-flagged")).toBeNull();
    expect(q(fixture, "openshell-request-review")).not.toBeNull();
    // The decision buttons live in the popup, not on the card.
    expect(q(fixture, "openshell-request-approve")).toBeNull();
    expect(q(fixture, "openshell-request-deny")).toBeNull();
  });

  it("has no approve-all control", async () => {
    byStatus.pending = [request(), request({ id: ID2 })];
    const fixture = await render();
    expect(el(fixture).textContent).not.toMatch(/approveAll|approve-all|ApproveAll/i);
    expect(all(fixture, "openshell-request-review")).toHaveLength(2);
  });

  it("publishes the pending count for the tab badge", async () => {
    await render();
    expect(TestBed.inject(OpenShellRequestsCountService).pendingFor("alpha")).toBe(1);
  });

  it("shows the empty state", async () => {
    byStatus.pending = [];
    const fixture = await render();
    expect(q(fixture, "openshell-requests-empty").textContent).toContain("agentAccessOsReqEmpty");
    expect(TestBed.inject(OpenShellRequestsCountService).pendingFor("alpha")).toBe(0);
  });

  it("shows a failure with retry, and never an empty state for it", async () => {
    agentAccessIpc.listOpenShellRequests.mockResolvedValue({
      ok: false,
      error: "gatewayUnreachable",
      message: "connection refused",
    });
    const fixture = await render();
    expect(q(fixture, "openshell-requests-error").textContent).toContain(
      "agentAccessOsPageErrorGatewayUnreachable",
    );
    expect(q(fixture, "openshell-requests-error").textContent).toContain("connection refused");
    expect(q(fixture, "openshell-requests-empty")).toBeNull();
  });

  it("renders gateway text as text, never as markup", async () => {
    byStatus.pending = [
      request({
        rationale: '<img src=x onerror="alert(1)"><b>bold</b>',
        endpoints: [{ host: "<script>x</script>", port: 443, access: "" }],
        programs: ["/usr/bin/<i>curl</i>"],
      }),
    ];
    const fixture = await render();
    expect(el(fixture).querySelector("img")).toBeNull();
    expect(el(fixture).querySelector("script")).toBeNull();
    expect(q(fixture, "openshell-request").querySelector("b")).toBeNull();
    expect(q(fixture, "openshell-request-reason").textContent).toContain("<img src=x");
  });

  describe("approve", () => {
    it("approves an unflagged request without a confirmation, then re-reads", async () => {
      const fixture = await render();
      byStatus.pending = [];

      await decide(fixture, "approve");

      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      expect(agentAccessIpc.approveOpenShellRequest).toHaveBeenCalledWith({
        sandboxName: "alpha",
        chunkId: ID,
      });
      expect(all(fixture, "openshell-request")).toHaveLength(0);
    });

    it("needs an extra explicit confirmation for a flagged request, and sends it", async () => {
      byStatus.pending = [request({ flagged: true, flagNote: "reaches a metadata address" })];
      dialogService.openSimpleDialog.mockResolvedValue(true);
      const fixture = await render();
      expect(q(fixture, "openshell-request-flagged")).not.toBeNull();

      await decide(fixture, "approve");

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({ type: "warning" }),
      );
      expect(agentAccessIpc.approveOpenShellRequest).toHaveBeenCalledWith({
        sandboxName: "alpha",
        chunkId: ID,
        confirmFlagged: true,
      });
    });

    it("does nothing when the flagged confirmation is declined", async () => {
      byStatus.pending = [request({ flagged: true })];
      dialogService.openSimpleDialog.mockResolvedValue(false);
      const fixture = await render();

      await decide(fixture, "approve");

      expect(agentAccessIpc.approveOpenShellRequest).not.toHaveBeenCalled();
    });

    it("shows the scrubbed message when approving fails and keeps the request", async () => {
      agentAccessIpc.approveOpenShellRequest.mockResolvedValue({
        ok: false,
        error: "failed",
        message: "gateway said no",
      });
      const fixture = await render();

      await decide(fixture, "approve");

      expect(q(fixture, "openshell-requests-action-error").textContent).toContain(
        "gateway said no",
      );
      expect(all(fixture, "openshell-request")).toHaveLength(1);
    });
  });

  it("opens the approval popup for the request and decides nothing when it is dismissed", async () => {
    const fixture = await render();

    const open = await decide(fixture, undefined);

    expect(open).toHaveBeenCalledWith(
      dialogService,
      expect.objectContaining({
        sandboxName: "alpha",
        request: expect.objectContaining({ id: ID }),
      }),
    );
    expect(agentAccessIpc.approveOpenShellRequest).not.toHaveBeenCalled();
    expect(agentAccessIpc.rejectOpenShellRequest).not.toHaveBeenCalled();
  });

  it("denies a request with only its id", async () => {
    const fixture = await render();
    byStatus.pending = [];

    await decide(fixture, "deny");

    expect(agentAccessIpc.rejectOpenShellRequest).toHaveBeenCalledWith({
      sandboxName: "alpha",
      chunkId: ID,
    });
    expect(all(fixture, "openshell-request")).toHaveLength(0);
  });

  it("opens the permission dialog prefilled with host, port and program", async () => {
    byStatus.pending = [
      request({
        endpoints: [{ host: "api.stripe.com", port: 8443, access: "" }],
        programs: ["/usr/bin/curl", "/usr/bin/wget"],
      }),
    ];
    const open = jest
      .spyOn(AgentAccessOpenShellPermissionDialogComponent, "open")
      .mockReturnValue({ closed: of(false) } as any);
    const fixture = await render();

    await decide(fixture, "createPermission");

    expect(open).toHaveBeenCalledWith(dialogService, {
      existingIds: ["github"],
      prefill: { host: "api.stripe.com", port: 8443, program: "/usr/bin/curl" },
    });
    expect(agentAccessIpc.approveOpenShellRequest).not.toHaveBeenCalled();
  });

  it("omits the program from the prefill when none was reported", async () => {
    byStatus.pending = [request({ programs: [] })];
    const open = jest
      .spyOn(AgentAccessOpenShellPermissionDialogComponent, "open")
      .mockReturnValue({ closed: of(false) } as any);
    const fixture = await render();

    await decide(fixture, "createPermission");

    expect(open.mock.calls[0][1].prefill).toEqual({ host: "api.stripe.com", port: 443 });
  });

  describe("history", () => {
    it("shows approved and rejected requests without action buttons", async () => {
      byStatus.approved = [request({ id: ID, status: "approved" })];
      byStatus.rejected = [request({ id: ID2, status: "rejected" })];
      const fixture = await render();

      await comp(fixture).setView("history");
      fixture.detectChanges();

      expect(agentAccessIpc.listOpenShellRequests).toHaveBeenCalledWith({
        sandboxName: "alpha",
        status: "approved",
      });
      expect(agentAccessIpc.listOpenShellRequests).toHaveBeenCalledWith({
        sandboxName: "alpha",
        status: "rejected",
      });
      expect(all(fixture, "openshell-request")).toHaveLength(2);
      expect(all(fixture, "openshell-request-status").map((s) => s.textContent.trim())).toEqual([
        expect.stringContaining("agentAccessOsReqStatusApproved"),
        expect.stringContaining("agentAccessOsReqStatusRejected"),
      ]);
      expect(q(fixture, "openshell-request-review")).toBeNull();
    });

    it("keeps the pending count when viewing history", async () => {
      const fixture = await render();
      byStatus.approved = [request({ status: "approved" })];

      await comp(fixture).setView("history");

      expect(TestBed.inject(OpenShellRequestsCountService).pendingFor("alpha")).toBe(1);
    });
  });

  describe("polling", () => {
    /** Captures the refresh timer instead of waiting 10 real seconds. */
    function captureTimer() {
      const handlers: Array<() => void> = [];
      const delays: number[] = [];
      const real = global.setInterval;
      jest.spyOn(global, "setInterval").mockImplementation(((fn: () => void, ms: number) => {
        if (ms === 10_000) {
          handlers.push(fn);
          delays.push(ms);
          return 4242 as any;
        }
        return real(fn, ms);
      }) as any);
      const cleared = jest.spyOn(global, "clearInterval");
      return { handlers, delays, cleared };
    }
    const calls = () => agentAccessIpc.listOpenShellRequests.mock.calls.length;

    it("re-reads every 10 seconds while the tab is open and stops when it closes", async () => {
      const timer = captureTimer();
      const fixture = await render();
      expect(timer.delays).toEqual([10_000]);
      const before = calls();

      timer.handlers[0]();
      await fixture.whenStable();
      expect(calls()).toBe(before + 1);

      fixture.destroy();
      expect(timer.cleared).toHaveBeenCalledWith(4242);
    });

    it("picks up a new request without a reload", async () => {
      const timer = captureTimer();
      const fixture = await render();
      byStatus.pending = [request(), request({ id: ID2 })];

      timer.handlers[0]();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(all(fixture, "openshell-request")).toHaveLength(2);
      expect(TestBed.inject(OpenShellRequestsCountService).pendingFor("alpha")).toBe(2);
    });

    it("keeps showing the last list when a background refresh fails", async () => {
      const timer = captureTimer();
      const fixture = await render();
      agentAccessIpc.listOpenShellRequests.mockResolvedValue({ ok: false, error: "failed" });

      timer.handlers[0]();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(all(fixture, "openshell-request")).toHaveLength(1);
      expect(q(fixture, "openshell-requests-error")).toBeNull();
    });

    it("does not refresh while an action is running", async () => {
      const timer = captureTimer();
      const fixture = await render();
      comp(fixture).busyId.set(ID);
      const before = calls();

      timer.handlers[0]();
      await fixture.whenStable();

      expect(calls()).toBe(before);
    });
  });

  const comp = (f: ComponentFixture<unknown>) => f.componentInstance as any;
});
