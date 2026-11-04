import { mock, MockProxy } from "jest-mock-extended";

import { DeviceType } from "@bitwarden/common/enums";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService } from "@bitwarden/components";

import { DesktopLoginViaWebAuthnComponentService } from "./desktop-login-via-webauthn-component.service";

describe("DesktopLoginViaWebAuthnComponentService", () => {
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let dialogService: MockProxy<DialogService>;
  let service: DesktopLoginViaWebAuthnComponentService;

  beforeEach(() => {
    platformUtilsService = mock<PlatformUtilsService>();
    dialogService = mock<DialogService>();
    service = new DesktopLoginViaWebAuthnComponentService(platformUtilsService, dialogService);
  });

  describe("confirmAccount", () => {
    it.each([true, false])(
      "asks the user to confirm the account on Linux, and returns %s when they answer so",
      async (confirmed) => {
        platformUtilsService.getDevice.mockReturnValue(DeviceType.LinuxDesktop);
        dialogService.openSimpleDialog.mockResolvedValue(confirmed);

        await expect(service.confirmAccount("user@example.com")).resolves.toBe(confirmed);

        expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
          expect.objectContaining({
            content: { key: "confirmPasskeyAccountDesc", placeholders: ["user@example.com"] },
          }),
        );
      },
    );

    it.each([DeviceType.WindowsDesktop, DeviceType.MacOsDesktop])(
      "confirms without asking on device type %s",
      async (deviceType) => {
        platformUtilsService.getDevice.mockReturnValue(deviceType);

        await expect(service.confirmAccount("user@example.com")).resolves.toBe(true);

        expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      },
    );
  });
});
