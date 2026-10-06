import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { DeviceType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";

import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";
import {
  OpenShellApprovalLifetime,
  OpenShellDetectionResult,
  OpenShellSetupResult,
  OpenShellSetupStatus,
} from "../models/openshell";

import { AgentAccessOpenShellSectionComponent } from "./agent-access-openshell-section.component";

const detected: OpenShellDetectionResult = {
  present: true,
  platformSupported: true,
  cliPath: "/opt/homebrew/bin/openshell",
  gateways: [
    {
      name: "openshell",
      endpoint: "https://127.0.0.1:17670",
      authMode: "mtls",
      active: true,
      authSupported: true,
    },
    {
      name: "edge",
      endpoint: "https://gw.example.com",
      authMode: "cloudflare_jwt",
      active: false,
      authSupported: false,
    },
  ],
  gatewayConfigPathHint: "/opt/homebrew/var/openshell/gateway.toml",
};

const setupStatus: OpenShellSetupStatus = {
  configPath: "/opt/homebrew/var/openshell/gateway.toml",
  configured: false,
  canSetUp: true,
  restartMethod: "brew",
};

const setupDone: OpenShellSetupResult = {
  ok: true,
  configChanged: true,
  restarted: true,
  restartedAtMs: 1_000_000,
  restartMethod: "brew",
  backupPath: "/opt/homebrew/var/openshell/gateway.toml.bak-bitwarden-20261007080503",
};

const snippet = {
  gatewayToml: '[openshell.gateway]\ncredential_drivers = ["bitwarden"]',
  providerExample: "openshell provider create --name x",
  attachExample: "openshell sandbox provider attach a b",
  gatewayName: "openshell",
};

describe("AgentAccessOpenShellSectionComponent (§M8.9)", () => {
  let agentAccessEnabled$: BehaviorSubject<boolean>;
  let openShellEnabled$: BehaviorSubject<boolean>;
  let lifetime$: BehaviorSubject<OpenShellApprovalLifetime>;
  let settings: {
    agentAccessEnabled$: BehaviorSubject<boolean>;
    agentAccessOpenShellEnabled$: BehaviorSubject<boolean>;
    agentAccessOpenShellApprovalLifetime$: BehaviorSubject<OpenShellApprovalLifetime>;
    setAgentAccessOpenShellEnabled: jest.Mock;
    setAgentAccessOpenShellApprovalLifetime: jest.Mock;
  };
  let agentAccessIpc: Record<string, jest.Mock>;
  let originalIpc: unknown;

  beforeAll(() => {
    (global as any).IntersectionObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  beforeEach(() => {
    agentAccessEnabled$ = new BehaviorSubject(true);
    openShellEnabled$ = new BehaviorSubject(false);
    lifetime$ = new BehaviorSubject<OpenShellApprovalLifetime>({ mode: "ttl", ttlMinutes: 60 });
    settings = {
      agentAccessEnabled$,
      agentAccessOpenShellEnabled$: openShellEnabled$,
      agentAccessOpenShellApprovalLifetime$: lifetime$,
      setAgentAccessOpenShellEnabled: jest.fn(async (v: boolean) => openShellEnabled$.next(v)),
      setAgentAccessOpenShellApprovalLifetime: jest.fn(async (v: OpenShellApprovalLifetime) =>
        lifetime$.next(v),
      ),
    };
    // Every method the page could call. Only the three read-only OpenShell reads may be used.
    agentAccessIpc = {
      detectOpenShell: jest.fn().mockResolvedValue(detected),
      getOpenShellSnippet: jest.fn().mockResolvedValue(snippet),
      getOpenShellDriverLastSeen: jest.fn().mockResolvedValue(null),
      getOpenShellSetupStatus: jest.fn().mockResolvedValue(setupStatus),
      runOpenShellSetup: jest.fn().mockResolvedValue(setupDone),
      removeOpenShellSetup: jest.fn().mockResolvedValue({ ...setupDone, configChanged: true }),
      setOpenShellListener: jest.fn(),
      registerWithAgent: jest.fn(),
      upsertGrant: jest.fn(),
      removeGrant: jest.fn(),
    };
    originalIpc = (global as any).ipc;
    (global as any).ipc = {
      platform: { deviceType: DeviceType.MacOsDesktop },
      agentAccess: agentAccessIpc,
    };
  });

  afterEach(() => {
    (global as any).ipc = originalIpc;
    TestBed.resetTestingModule();
  });

  async function render(): Promise<ComponentFixture<AgentAccessOpenShellSectionComponent>> {
    const i18n = mock<I18nService>();
    i18n.t.mockImplementation((key: string) => key);
    TestBed.configureTestingModule({
      imports: [AgentAccessOpenShellSectionComponent, NoopAnimationsModule],
      providers: [
        { provide: DesktopSettingsService, useValue: settings },
        { provide: I18nService, useValue: i18n },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
      ],
    });
    const fixture = TestBed.createComponent(AgentAccessOpenShellSectionComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const q = (fixture: ComponentFixture<unknown>, selector: string) =>
    (fixture.nativeElement as HTMLElement).querySelector(selector);

  function assertNoWritingIpc() {
    for (const name of [
      "runOpenShellSetup",
      "removeOpenShellSetup",
      "setOpenShellListener",
      "registerWithAgent",
      "upsertGrant",
      "removeGrant",
    ]) {
      expect(agentAccessIpc[name]).not.toHaveBeenCalled();
    }
  }

  it("renders nothing when OpenShell isn't detected", async () => {
    agentAccessIpc.detectOpenShell.mockResolvedValue({ ...detected, present: false });
    const fixture = await render();
    expect(q(fixture, '[data-testid="agent-access-openshell-section"]')).toBeNull();
    assertNoWritingIpc();
  });

  it("renders nothing when Agent Access is off", async () => {
    agentAccessEnabled$.next(false);
    const fixture = await render();
    expect(q(fixture, '[data-testid="agent-access-openshell-section"]')).toBeNull();
  });

  it("renders nothing on Windows and doesn't even detect", async () => {
    (global as any).ipc.platform.deviceType = DeviceType.WindowsDesktop;
    const fixture = await render();
    expect(q(fixture, '[data-testid="agent-access-openshell-section"]')).toBeNull();
    expect(agentAccessIpc.detectOpenShell).not.toHaveBeenCalled();
  });

  it.each([
    ["snap", "agentAccessOpenShellUnsupportedSnap"],
    ["appImage", "agentAccessOpenShellUnsupportedAppImage"],
  ] as const)("shows the %s reason and no toggle", async (reason, key) => {
    agentAccessIpc.detectOpenShell.mockResolvedValue({
      ...detected,
      platformSupported: false,
      unsupportedReason: reason,
    });
    const fixture = await render();
    expect(q(fixture, '[data-testid="agent-access-openshell-unsupported"]')?.textContent).toContain(
      key,
    );
    expect(q(fixture, "bit-switch")).toBeNull();
    expect(agentAccessIpc.getOpenShellSnippet).not.toHaveBeenCalled();
  });

  it("shows only the toggle while the integration is off", async () => {
    const fixture = await render();
    expect(q(fixture, "bit-switch")).not.toBeNull();
    expect(q(fixture, '[data-testid="agent-access-openshell-details"]')).toBeNull();
  });

  it("shows the lifetime picker, snippet, examples and warnings when on", async () => {
    openShellEnabled$.next(true);
    const fixture = await render();
    expect(q(fixture, "bit-radio-group")).not.toBeNull();
    expect(q(fixture, "#agent-access-openshell_select_ttl")).not.toBeNull();
    expect(q(fixture, '[data-testid="agent-access-openshell-gateway-toml"]')?.textContent).toBe(
      snippet.gatewayToml,
    );
    const examples = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '[data-testid="agent-access-openshell-example"]',
    );
    expect(Array.from(examples).map((e) => e.textContent)).toEqual([
      snippet.providerExample,
      snippet.attachExample,
    ]);
    expect(q(fixture, '[data-testid="agent-access-openshell-takeover"]')).not.toBeNull();
    const authWarnings = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '[data-testid="agent-access-openshell-auth"]',
    );
    expect(authWarnings).toHaveLength(1);
    expect(q(fixture, '[data-testid="agent-access-openshell-driver"]')?.textContent).toContain(
      "agentAccessOpenShellDriverNotSeen",
    );
    expect(fixture.nativeElement.textContent).toContain("agentAccessOpenShellOneSandboxRule");
    expect(fixture.nativeElement.textContent).toContain("agentAccessOpenShellMergeNote");
    assertNoWritingIpc();
  });

  it("hides the TTL picker for a non-ttl lifetime", async () => {
    openShellEnabled$.next(true);
    lifetime$.next({ mode: "perRequest", ttlMinutes: 60 });
    const fixture = await render();
    expect(q(fixture, "#agent-access-openshell_select_ttl")).toBeNull();
  });

  it("writes the setting when the toggle changes, and nothing else", async () => {
    const fixture = await render();
    (fixture.componentInstance as any).enabledControl.setValue(true);
    await fixture.whenStable();
    expect(settings.setAgentAccessOpenShellEnabled).toHaveBeenCalledWith(true);
    assertNoWritingIpc();
  });

  it("saves the lifetime when the mode changes", async () => {
    openShellEnabled$.next(true);
    const fixture = await render();
    (fixture.componentInstance as any).modeControl.setValue("sandboxLifetime");
    await fixture.whenStable();
    expect(settings.setAgentAccessOpenShellApprovalLifetime).toHaveBeenCalledWith({
      mode: "sandboxLifetime",
      ttlMinutes: 60,
    });
  });

  describe("one-button setup (§M8.19)", () => {
    const phase = (fixture: ComponentFixture<unknown>) =>
      (fixture.componentInstance as any).phase() as string;

    async function renderEnabled() {
      openShellEnabled$.next(true);
      return render();
    }

    afterEach(() => {
      jest.useRealTimers();
    });

    it("offers a single Set up button until something has been done", async () => {
      const fixture = await renderEnabled();

      expect(phase(fixture)).toBe("idle");
      expect(q(fixture, "#agent-access-openshell_button_setup")).not.toBeNull();
      expect(agentAccessIpc.runOpenShellSetup).not.toHaveBeenCalled();
    });

    it("disables the button when setup can't run here", async () => {
      agentAccessIpc.getOpenShellSetupStatus.mockResolvedValue({
        ...setupStatus,
        canSetUp: false,
        blockedReason: "noBundledCli",
      });
      const fixture = await renderEnabled();

      expect(
        q(fixture, "#agent-access-openshell_button_setup")?.getAttribute("aria-disabled"),
      ).toBe("true");
    });

    it("runs setup, waits for the gateway, and reports connected once it connects", async () => {
      const fixture = await renderEnabled();
      jest.useFakeTimers();

      await (fixture.componentInstance as any).runSetup();
      fixture.detectChanges();
      expect(agentAccessIpc.runOpenShellSetup).toHaveBeenCalledTimes(1);
      expect(phase(fixture)).toBe("waiting");

      // A connection from before the restart doesn't count.
      agentAccessIpc.getOpenShellDriverLastSeen.mockResolvedValue(setupDone.restartedAtMs! - 1);
      await jest.advanceTimersByTimeAsync(1000);
      expect(phase(fixture)).toBe("waiting");

      agentAccessIpc.getOpenShellDriverLastSeen.mockResolvedValue(setupDone.restartedAtMs! + 5);
      await jest.advanceTimersByTimeAsync(1000);
      fixture.detectChanges();
      expect(phase(fixture)).toBe("connected");
      expect(q(fixture, '[data-testid="agent-access-openshell-connected"]')).not.toBeNull();
    });

    it("says what to check when the gateway never connects", async () => {
      const fixture = await renderEnabled();
      jest.useFakeTimers();

      await (fixture.componentInstance as any).runSetup();
      await jest.advanceTimersByTimeAsync(31_000);
      fixture.detectChanges();

      expect(phase(fixture)).toBe("timedOut");
      expect(q(fixture, '[data-testid="agent-access-openshell-timeout"]')).not.toBeNull();
      expect(q(fixture, "#agent-access-openshell_button_retry")).not.toBeNull();
    });

    it("shows why a file it can't edit was left alone, and offers no blind retry", async () => {
      agentAccessIpc.runOpenShellSetup.mockResolvedValue({
        ok: false,
        failure: "unmergeable",
        configChanged: false,
        restarted: false,
        restartMethod: "brew",
      });
      const fixture = await renderEnabled();

      await (fixture.componentInstance as any).runSetup();
      fixture.detectChanges();

      expect(phase(fixture)).toBe("failed");
      expect(q(fixture, '[data-testid="agent-access-openshell-failure"]')?.textContent).toContain(
        "agentAccessOpenShellSetupFailUnmergeable",
      );
    });

    it("keeps watching after a failed restart, so a manual restart is noticed", async () => {
      agentAccessIpc.runOpenShellSetup.mockResolvedValue({
        ...setupDone,
        ok: false,
        failure: "restartFailed",
        restarted: false,
        restartedAtMs: undefined,
      });
      const fixture = await renderEnabled();
      jest.useFakeTimers();

      await (fixture.componentInstance as any).runSetup();
      expect(phase(fixture)).toBe("failed");

      agentAccessIpc.getOpenShellDriverLastSeen.mockResolvedValue(Date.now() + 10_000);
      await jest.advanceTimersByTimeAsync(1000);
      fixture.detectChanges();

      expect(phase(fixture)).toBe("connected");
    });

    it("removes the driver on request", async () => {
      agentAccessIpc.getOpenShellSetupStatus.mockResolvedValue({
        ...setupStatus,
        configured: true,
      });
      agentAccessIpc.getOpenShellDriverLastSeen.mockResolvedValue(1);
      const fixture = await renderEnabled();
      expect(phase(fixture)).toBe("connected");

      await (fixture.componentInstance as any).removeSetup();

      expect(agentAccessIpc.removeOpenShellSetup).toHaveBeenCalledTimes(1);
    });
  });
});
