import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { DeviceType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DIALOG_DATA, ToastService } from "@bitwarden/components";

import { SshAgentSetupDialogComponent } from "./ssh-agent-setup-dialog.component";

describe("SshAgentSetupDialogComponent", () => {
  const SOCKET_ADDRESS = "/home/test/.bitwarden-ssh-agent.sock";

  const platformUtilsService = mock<PlatformUtilsService>();
  const i18nService = mock<I18nService>();
  const toastService = mock<ToastService>();

  async function createComponent(
    device: DeviceType,
  ): Promise<ComponentFixture<SshAgentSetupDialogComponent>> {
    platformUtilsService.getDevice.mockReturnValue(device);

    await TestBed.configureTestingModule({
      imports: [SshAgentSetupDialogComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: { socketAddress: SOCKET_ADDRESS } },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: I18nService, useValue: i18nService },
        { provide: ToastService, useValue: toastService },
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
  });

  it("shows the export line on unix", async () => {
    const fixture = await createComponent(DeviceType.MacOsDesktop);

    expect(fixture.componentInstance["isWindows"]).toBe(false);
    expect(fixture.nativeElement.textContent).toContain(`export SSH_AUTH_SOCK=${SOCKET_ADDRESS}`);
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
      `export SSH_AUTH_SOCK=${SOCKET_ADDRESS}`,
    );
    expect(toastService.showToast).toHaveBeenCalled();
  });
});
