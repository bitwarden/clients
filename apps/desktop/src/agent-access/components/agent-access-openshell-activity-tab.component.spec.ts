import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { ActivatedRoute, convertToParamMap } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { AgentAccessOpenShellActivityTabComponent } from "./agent-access-openshell-activity-tab.component";

const NOW = 1_800_000_000_000;
const event = (id: string, outcome: string, ageMs: number, extra = {}) => ({
  id,
  atMs: NOW - ageMs,
  agentName: "openshell-gateway",
  outcome,
  secretCount: 2,
  ...extra,
});

describe("AgentAccessOpenShellActivityTabComponent", () => {
  let agentAccessIpc: Record<string, jest.Mock>;
  let originalIpc: unknown;

  beforeAll(() => {
    // jsdom has no ResizeObserver; the toggle group measures itself with one.
    (global as any).ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  beforeEach(() => {
    jest.spyOn(Date, "now").mockReturnValue(NOW);
    agentAccessIpc = {
      listOpenShellSandboxes: jest.fn().mockResolvedValue({
        ok: true,
        data: [
          { name: "other", id: "sb-0" },
          { name: "alpha", id: "sb-1" },
        ],
      }),
      listOpenShellActivity: jest.fn().mockResolvedValue({
        ok: true,
        data: [
          event("1", "allowed", 120_000),
          event("2", "denied", 3_600_000 * 3),
          event("3", "notFound", 7_200_000, { agentName: null }),
        ],
      }),
    };
    originalIpc = (global as any).ipc;
    (global as any).ipc = { agentAccess: agentAccessIpc };
  });

  afterEach(() => {
    (global as any).ipc = originalIpc;
    jest.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  async function render(): Promise<ComponentFixture<AgentAccessOpenShellActivityTabComponent>> {
    const i18n = mock<I18nService>();
    i18n.t.mockImplementation((key: string, ...p: string[]) => [key, ...p].join("|"));
    const paramMap = new BehaviorSubject(convertToParamMap({ name: "alpha" }));
    TestBed.configureTestingModule({
      imports: [AgentAccessOpenShellActivityTabComponent, NoopAnimationsModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { parent: { paramMap, snapshot: { paramMap: paramMap.value } } },
        },
        { provide: I18nService, useValue: i18n },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
      ],
    });
    const fixture = TestBed.createComponent(AgentAccessOpenShellActivityTabComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const q = (f: ComponentFixture<unknown>, selector: string) =>
    (f.nativeElement as HTMLElement).querySelector<HTMLElement>(selector);
  const rows = (f: ComponentFixture<unknown>) =>
    Array.from(
      (f.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        '[data-testid="openshell-activity-row"]',
      ),
    );

  it("asks main for this sandbox's activity by its gateway id", async () => {
    await render();
    expect(agentAccessIpc.listOpenShellActivity).toHaveBeenCalledWith({ sandboxId: "sb-1" });
  });

  it("renders a plain-language row with outcome and relative time", async () => {
    const fixture = await render();
    expect(rows(fixture)).toHaveLength(3);
    expect(rows(fixture)[0].textContent).toContain(
      "agentAccessOsActRowAllowed|openshell-gateway|2",
    );
    expect(rows(fixture)[0].textContent).toContain("agentAccessOsActAllowed");
    expect(rows(fixture)[0].textContent).toContain("2 minutes ago");
    expect(rows(fixture)[1].textContent).toContain("agentAccessOsActRowDenied");
    expect(rows(fixture)[1].textContent).toContain("3 hours ago");
  });

  it("falls back to a generic subject when the program is unknown", async () => {
    const fixture = await render();
    expect(rows(fixture)[2].textContent).toContain(
      "agentAccessOsActRowNotFound|agentAccessOsActUnknownAgent",
    );
  });

  it("filters to allowed and to denied, and shows the filtered empty state", async () => {
    const fixture = await render();
    const comp = fixture.componentInstance as any;

    comp.setFilter("allowed");
    fixture.detectChanges();
    expect(rows(fixture)).toHaveLength(1);

    comp.setFilter("denied");
    fixture.detectChanges();
    expect(rows(fixture)).toHaveLength(1);
    expect(rows(fixture)[0].textContent).toContain("agentAccessOsActRowDenied");

    comp.events.set([event("1", "allowed", 1000)]);
    fixture.detectChanges();
    expect(rows(fixture)).toHaveLength(0);
    expect(q(fixture, '[data-testid="openshell-activity-empty"]').textContent).toContain(
      "agentAccessOsActEmptyFiltered",
    );
  });

  it("shows the empty state when there is no activity", async () => {
    agentAccessIpc.listOpenShellActivity.mockResolvedValue({ ok: true, data: [] });
    const fixture = await render();
    expect(q(fixture, '[data-testid="openshell-activity-empty"]').textContent).toContain(
      "agentAccessOsActEmpty",
    );
  });

  it("shows the error state with the scrubbed message when main fails", async () => {
    agentAccessIpc.listOpenShellActivity.mockResolvedValue({
      ok: false,
      error: "failed",
      message: "nope",
    });
    const fixture = await render();
    const error = q(fixture, '[data-testid="openshell-activity-error"]');
    expect(error.textContent).toContain("agentAccessOsCredErrorFailed");
    expect(error.textContent).toContain("nope");
    expect(rows(fixture)).toHaveLength(0);
  });

  it("shows the error state when the sandbox is not on the gateway or the IPC rejects", async () => {
    agentAccessIpc.listOpenShellSandboxes.mockResolvedValue({ ok: true, data: [] });
    let fixture = await render();
    expect(q(fixture, '[data-testid="openshell-activity-error"]')).not.toBeNull();
    expect(agentAccessIpc.listOpenShellActivity).not.toHaveBeenCalled();

    TestBed.resetTestingModule();
    agentAccessIpc.listOpenShellSandboxes.mockRejectedValue(new Error("x"));
    fixture = await render();
    expect(q(fixture, '[data-testid="openshell-activity-error"]')).not.toBeNull();
  });

  it("renders text only, never markup, from gateway-reported names", async () => {
    agentAccessIpc.listOpenShellActivity.mockResolvedValue({
      ok: true,
      data: [event("1", "allowed", 1000, { agentName: "<img src=x onerror=alert(1)>" })],
    });
    const fixture = await render();
    expect(fixture.nativeElement.querySelector("img")).toBeNull();
  });
});
