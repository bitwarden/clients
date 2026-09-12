import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { DeviceType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DIALOG_DATA, DialogRef, ToastService } from "@bitwarden/components";

import { SshAgentSetupDialogComponent } from "./ssh-agent-setup-dialog.component";

describe("SshAgentSetupDialogComponent", () => {
  const SOCKET_ADDRESS = "/home/test/.bitwarden-ssh-agent.sock";

  const platformUtilsService = mock<PlatformUtilsService>();
  const i18nService = mock<I18nService>();
  const toastService = mock<ToastService>();
  const logService = mock<LogService>();
  const dialogRef = mock<DialogRef>();

  let originalIpc: any;
  const applyConfiguration = jest.fn();

  async function createComponent(
    device: DeviceType,
  ): Promise<ComponentFixture<SshAgentSetupDialogComponent>> {
    platformUtilsService.getDevice.mockReturnValue(device);

    await TestBed.configureTestingModule({
      imports: [SshAgentSetupDialogComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: { socketAddress: SOCKET_ADDRESS } },
        { provide: DialogRef, useValue: dialogRef },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: I18nService, useValue: i18nService },
        { provide: ToastService, useValue: toastService },
        { provide: LogService, useValue: logService },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(SshAgentSetupDialogComponent);
    fixture.detectChanges();

    return fixture;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    TestBed.resetTestingModule();
    i18nService.t.mockImplementation((key: string) => key);

    applyConfiguration.mockResolvedValue(undefined);
    originalIpc = (global as any).ipc;
    (global as any).ipc = { autofill: { sshAgent: { applyConfiguration } } };
  });

  afterEach(() => {
    (global as any).ipc = originalIpc;
  });

  it("shows the export line on unix", async () => {
    const fixture = await createComponent(DeviceType.MacOsDesktop);

    expect(fixture.componentInstance["isWindows"]).toBe(false);
    expect(fixture.nativeElement.textContent).toContain(`export SSH_AUTH_SOCK="${SOCKET_ADDRESS}"`);
  });

  it("shows no export line and no socket address on windows", async () => {
    const fixture = await createComponent(DeviceType.WindowsDesktop);

    expect(fixture.componentInstance["isWindows"]).toBe(true);
    expect(fixture.nativeElement.textContent).not.toContain("export SSH_AUTH_SOCK");
    expect(fixture.nativeElement.textContent).not.toContain(SOCKET_ADDRESS);
    expect(fixture.nativeElement.textContent).toContain("sshAgentSetupWindowsService");
  });

  it("copies the export line to the clipboard", async () => {
    const fixture = await createComponent(DeviceType.LinuxDesktop);

    fixture.componentInstance["copyEnvVarLine"]();

    expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith(
      `export SSH_AUTH_SOCK="${SOCKET_ADDRESS}"`,
    );
    expect(toastService.showToast).toHaveBeenCalled();
  });

  it("applies the configuration and closes on success", async () => {
    const fixture = await createComponent(DeviceType.LinuxDesktop);

    await fixture.componentInstance["applyAutomatically"]();

    expect(applyConfiguration).toHaveBeenCalled();
    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success", message: "sshAgentSetupApplied" }),
    );
    expect(dialogRef.close).toHaveBeenCalled();
  });

  it("keeps the dialog open and toasts when applying fails", async () => {
    applyConfiguration.mockRejectedValue(new Error("elevation declined"));
    const fixture = await createComponent(DeviceType.WindowsDesktop);

    await fixture.componentInstance["applyAutomatically"]();

    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error", message: "sshAgentSetupApplyFailed" }),
    );
    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});
