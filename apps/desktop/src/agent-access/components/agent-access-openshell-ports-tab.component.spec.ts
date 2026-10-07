import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { ActivatedRoute, convertToParamMap } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { OpenShellForward } from "../models/openshell-ports";
import { AgentAccessOpenShellPortsCountService } from "../services/agent-access-openshell-ports-count.service";

import { AgentAccessOpenShellPortsTabComponent } from "./agent-access-openshell-ports-tab.component";

const forward = (port: number, bindAddress = "127.0.0.1"): OpenShellForward => ({
  sandboxName: "alpha",
  port,
  bindAddress,
  pid: null,
});

describe("AgentAccessOpenShellPortsTabComponent (§M8.20 rule 15)", () => {
  let agentAccessIpc: Record<string, jest.Mock>;
  let originalIpc: unknown;
  let platformUtils: ReturnType<typeof mock<PlatformUtilsService>>;
  let active: OpenShellForward[];
  let saved: { port: number; name: string }[];

  beforeAll(() => {
    (global as any).ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  beforeEach(() => {
    active = [];
    saved = [];
    agentAccessIpc = {
      listOpenShellForwards: jest.fn().mockImplementation(async () => ({ ok: true, data: active })),
      getOpenShellSavedPorts: jest.fn().mockImplementation(async () => ({ ok: true, data: saved })),
      setOpenShellSavedPorts: jest
        .fn()
        .mockImplementation(async ({ ports }: { ports: { port: number; name: string }[] }) => {
          saved = ports;
          return { ok: true, data: ports };
        }),
      startOpenShellForward: jest.fn().mockImplementation(async ({ port }: { port: number }) => {
        active = [...active, forward(port)];
        return { ok: true, data: undefined };
      }),
      stopOpenShellForward: jest.fn().mockImplementation(async ({ port }: { port: number }) => {
        active = active.filter((f) => f.port !== port);
        return { ok: true, data: undefined };
      }),
    };
    originalIpc = (global as any).ipc;
    (global as any).ipc = { agentAccess: agentAccessIpc };
    platformUtils = mock<PlatformUtilsService>();
  });

  afterEach(() => {
    (global as any).ipc = originalIpc;
    jest.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  async function render(): Promise<ComponentFixture<AgentAccessOpenShellPortsTabComponent>> {
    const i18n = mock<I18nService>();
    i18n.t.mockImplementation((key: string) => key);
    const paramMap = new BehaviorSubject(convertToParamMap({ name: "alpha" }));
    TestBed.configureTestingModule({
      imports: [AgentAccessOpenShellPortsTabComponent, NoopAnimationsModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { parent: { paramMap, snapshot: { paramMap: paramMap.value } } },
        },
        { provide: I18nService, useValue: i18n },
        { provide: PlatformUtilsService, useValue: platformUtils },
      ],
    });
    const fixture = TestBed.createComponent(AgentAccessOpenShellPortsTabComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const el = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;
  const q = (f: ComponentFixture<unknown>, selector: string) =>
    el(f).querySelector<HTMLElement>(selector);
  const rows = (f: ComponentFixture<unknown>) =>
    Array.from(el(f).querySelectorAll<HTMLElement>('[data-testid="openshell-ports-row"]'));
  const settle = async (f: ComponentFixture<unknown>) => {
    await f.whenStable();
    f.detectChanges();
  };
  const click = async (f: ComponentFixture<unknown>, selector: string) => {
    const target = q(f, selector);
    expect(target).not.toBeNull();
    target!.click();
    await settle(f);
  };
  async function typePort(f: ComponentFixture<unknown>, port: string, name = "") {
    const comp = f.componentInstance as any;
    comp.form.patchValue({ port, friendlyName: name });
    f.detectChanges();
  }
  const submit = async (f: ComponentFixture<unknown>) => {
    await click(f, "#agent-access-openshell-ports_button_start");
  };

  it("lists this sandbox's forwards and saved ports as one table", async () => {
    active = [forward(8080)];
    saved = [
      { port: 8080, name: "Web vault" },
      { port: 3000, name: "API" },
    ];
    const fixture = await render();
    expect(agentAccessIpc.listOpenShellForwards).toHaveBeenCalledWith({ sandboxName: "alpha" });
    expect(agentAccessIpc.getOpenShellSavedPorts).toHaveBeenCalledWith({ sandboxName: "alpha" });
    const [api, web] = rows(fixture);
    expect(api.textContent).toContain("3000");
    expect(api.textContent).toContain("agentAccessOsPortsInactive");
    expect(web.textContent).toContain("Web vault");
    expect(web.textContent).toContain("agentAccessOsPortsActive");
    expect(web.querySelector('[data-testid="openshell-ports-exposed"]')).toBeNull();
  });

  it("publishes the forward count for the tab bar", async () => {
    active = [forward(1), forward(2)];
    await render();
    expect(TestBed.inject(AgentAccessOpenShellPortsCountService).countFor("alpha")).toBe(2);
  });

  it("flags a forward that is not loopback-only", async () => {
    active = [forward(8080, "0.0.0.0")];
    const fixture = await render();
    expect(q(fixture, '[data-testid="openshell-ports-exposed"]')).not.toBeNull();
  });

  it("starts a forward with only the sandbox name and port, and remembers it when asked", async () => {
    const fixture = await render();
    await typePort(fixture, "8080", "Web vault");
    await submit(fixture);

    expect(agentAccessIpc.startOpenShellForward).toHaveBeenCalledWith({
      sandboxName: "alpha",
      port: 8080,
    });
    expect(agentAccessIpc.setOpenShellSavedPorts).toHaveBeenCalledWith({
      sandboxName: "alpha",
      ports: [{ port: 8080, name: "Web vault" }],
    });
    expect(rows(fixture)).toHaveLength(1);
    expect(rows(fixture)[0].textContent).toContain("agentAccessOsPortsActive");
  });

  it("does not remember the port when the save option is off", async () => {
    const fixture = await render();
    (fixture.componentInstance as any).form.patchValue({ save: false });
    await typePort(fixture, "9000");
    await submit(fixture);
    expect(agentAccessIpc.startOpenShellForward).toHaveBeenCalled();
    expect(agentAccessIpc.setOpenShellSavedPorts).not.toHaveBeenCalled();
  });

  it.each(["", "0", "65536", "80a", "-1", "1.5", " "])(
    "rejects the port %p without calling main",
    async (value) => {
      const fixture = await render();
      await typePort(fixture, value);
      await submit(fixture);
      expect(agentAccessIpc.startOpenShellForward).not.toHaveBeenCalled();
      expect(q(fixture, '[data-testid="openshell-ports-port-error"]')).not.toBeNull();
    },
  );

  it("shows the scrubbed failure from main and keeps nothing saved when the start failed", async () => {
    agentAccessIpc.startOpenShellForward.mockResolvedValue({
      ok: false,
      error: "alreadyExists",
      message: "address already in use",
    });
    const fixture = await render();
    await typePort(fixture, "8080");
    await submit(fixture);
    expect(q(fixture, '[data-testid="openshell-ports-action-error"]')!.textContent).toContain(
      "address already in use",
    );
    expect(agentAccessIpc.setOpenShellSavedPorts).not.toHaveBeenCalled();
  });

  it("stops a forward and re-reads what is forwarded", async () => {
    active = [forward(8080)];
    const fixture = await render();
    await click(fixture, '[data-testid="openshell-ports-stop"]');
    expect(agentAccessIpc.stopOpenShellForward).toHaveBeenCalledWith({
      sandboxName: "alpha",
      port: 8080,
    });
    expect(rows(fixture)).toHaveLength(0);
  });

  it("opens only http://localhost:<port> in the browser", async () => {
    active = [forward(8080)];
    const fixture = await render();
    await click(fixture, '[data-testid="openshell-ports-browser"]');
    expect(platformUtils.launchUri).toHaveBeenCalledTimes(1);
    expect(platformUtils.launchUri).toHaveBeenCalledWith("http://localhost:8080");
  });

  it("starts every saved port that is not running with Start all saved", async () => {
    active = [forward(8080)];
    saved = [
      { port: 8080, name: "" },
      { port: 3000, name: "" },
      { port: 4000, name: "" },
    ];
    const fixture = await render();
    await click(fixture, '[data-testid="openshell-ports-start-all"]');
    expect(agentAccessIpc.startOpenShellForward).toHaveBeenCalledTimes(2);
    expect(agentAccessIpc.startOpenShellForward).toHaveBeenCalledWith({
      sandboxName: "alpha",
      port: 3000,
    });
    expect(agentAccessIpc.startOpenShellForward).toHaveBeenCalledWith({
      sandboxName: "alpha",
      port: 4000,
    });
    expect(q(fixture, '[data-testid="openshell-ports-start-all"]')).toBeNull();
  });

  it("stops Start all saved at the first failure", async () => {
    saved = [
      { port: 3000, name: "" },
      { port: 4000, name: "" },
    ];
    agentAccessIpc.startOpenShellForward.mockResolvedValue({ ok: false, error: "failed" });
    const fixture = await render();
    await click(fixture, '[data-testid="openshell-ports-start-all"]');
    expect(agentAccessIpc.startOpenShellForward).toHaveBeenCalledTimes(1);
  });

  it("forgets a saved port", async () => {
    saved = [{ port: 3000, name: "API" }];
    const fixture = await render();
    await click(fixture, '[data-testid="openshell-ports-forget"]');
    expect(agentAccessIpc.setOpenShellSavedPorts).toHaveBeenCalledWith({
      sandboxName: "alpha",
      ports: [],
    });
  });

  it("remembers an active port that was not saved", async () => {
    active = [forward(8080)];
    const fixture = await render();
    await click(fixture, '[data-testid="openshell-ports-remember"]');
    expect(agentAccessIpc.setOpenShellSavedPorts).toHaveBeenCalledWith({
      sandboxName: "alpha",
      ports: [{ port: 8080, name: "" }],
    });
  });

  it("shows a gateway failure with a retry instead of an empty table", async () => {
    agentAccessIpc.listOpenShellForwards.mockResolvedValue({
      ok: false,
      error: "gatewayUnreachable",
      message: "connection refused",
    });
    const fixture = await render();
    const error = q(fixture, '[data-testid="openshell-ports-error"]');
    expect(error!.textContent).toContain("connection refused");
    expect(q(fixture, '[data-testid="openshell-ports-empty"]')).toBeNull();
  });

  it("shows an empty state", async () => {
    const fixture = await render();
    expect(q(fixture, '[data-testid="openshell-ports-empty"]')).not.toBeNull();
  });
});
