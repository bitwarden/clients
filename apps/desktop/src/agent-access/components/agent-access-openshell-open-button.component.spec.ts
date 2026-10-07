import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock } from "jest-mock-extended";

import { DeviceType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";

import { AgentAccessOpenShellOpenButtonComponent } from "./agent-access-openshell-open-button.component";

describe("AgentAccessOpenShellOpenButtonComponent (§M8.20 rule 15)", () => {
  let agentAccessIpc: Record<string, jest.Mock>;
  let originalIpc: unknown;
  let platformUtils: ReturnType<typeof mock<PlatformUtilsService>>;
  let toast: ReturnType<typeof mock<ToastService>>;

  beforeAll(() => {
    (global as any).ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  beforeEach(() => {
    agentAccessIpc = {
      openOpenShellShell: jest.fn().mockResolvedValue({
        ok: true,
        data: { command: "openshell sandbox connect --gateway=work alpha", launched: true },
      }),
    };
    originalIpc = (global as any).ipc;
    (global as any).ipc = { agentAccess: agentAccessIpc };
    platformUtils = mock<PlatformUtilsService>();
    toast = mock<ToastService>();
  });

  afterEach(() => {
    (global as any).ipc = originalIpc;
    TestBed.resetTestingModule();
  });

  async function render(
    device: DeviceType,
    disabled = false,
  ): Promise<ComponentFixture<AgentAccessOpenShellOpenButtonComponent>> {
    platformUtils.getDevice.mockReturnValue(device);
    const i18n = mock<I18nService>();
    i18n.t.mockImplementation((key: string) => key);
    TestBed.configureTestingModule({
      imports: [AgentAccessOpenShellOpenButtonComponent, NoopAnimationsModule],
      providers: [
        { provide: I18nService, useValue: i18n },
        { provide: PlatformUtilsService, useValue: platformUtils },
        { provide: ToastService, useValue: toast },
      ],
    });
    const fixture = TestBed.createComponent(AgentAccessOpenShellOpenButtonComponent);
    fixture.componentRef.setInput("sandboxName", "alpha");
    fixture.componentRef.setInput("disabled", disabled);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  const openMenu = async (fixture: ComponentFixture<unknown>) => {
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLElement>('[data-testid="openshell-open"]')!
      .click();
    fixture.detectChanges();
    await fixture.whenStable();
  };
  const item = (testId: string) => document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);

  it("offers Open in Terminal on macOS and launches it by sandbox name only", async () => {
    const fixture = await render(DeviceType.MacOsDesktop);
    await openMenu(fixture);
    expect(item("openshell-open-terminal")).not.toBeNull();
    item("openshell-open-terminal")!.click();
    await fixture.whenStable();
    expect(agentAccessIpc.openOpenShellShell).toHaveBeenCalledWith({
      sandboxName: "alpha",
      action: "openTerminal",
    });
  });

  it("offers only the copy action elsewhere, and copies the command main built", async () => {
    const fixture = await render(DeviceType.LinuxDesktop);
    await openMenu(fixture);
    expect(item("openshell-open-terminal")).toBeNull();
    item("openshell-open-copy")!.click();
    await fixture.whenStable();
    expect(agentAccessIpc.openOpenShellShell).toHaveBeenCalledWith({
      sandboxName: "alpha",
      action: "copyCommand",
    });
    expect(platformUtils.copyToClipboard).toHaveBeenCalledWith(
      "openshell sandbox connect --gateway=work alpha",
    );
    expect(toast.showToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "success" }));
  });

  it("shows an error toast with main's message and copies nothing on failure", async () => {
    agentAccessIpc.openOpenShellShell.mockResolvedValue({
      ok: false,
      error: "failed",
      message: "Terminal could not be opened.",
    });
    const fixture = await render(DeviceType.MacOsDesktop);
    await openMenu(fixture);
    item("openshell-open-copy")!.click();
    await fixture.whenStable();
    expect(platformUtils.copyToClipboard).not.toHaveBeenCalled();
    expect(toast.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error", message: "Terminal could not be opened." }),
    );
  });

  it("is disabled when the sandbox is not ready", async () => {
    const fixture = await render(DeviceType.MacOsDesktop, true);
    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '[data-testid="openshell-open"]',
    )!;
    expect(button.getAttribute("aria-disabled") === "true" || button.disabled).toBe(true);
  });
});
