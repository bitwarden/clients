import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { DeviceType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { nativeWebAuthnEnabled$ } from "./native-webauthn-feature";

describe("nativeWebAuthnEnabled$", () => {
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let configService: MockProxy<ConfigService>;

  beforeEach(() => {
    platformUtilsService = mock<PlatformUtilsService>();
    configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockReturnValue(of(true));
  });

  it.each([
    [DeviceType.WindowsDesktop, FeatureFlag.PM46060_DesktopWebAuthnClientWindows],
    [DeviceType.MacOsDesktop, FeatureFlag.PM46059_DesktopWebAuthnClientMacOs],
    [DeviceType.LinuxDesktop, FeatureFlag.PM46061_DesktopWebAuthnClientLinux],
  ])("uses the feature flag for device type %s", async (device, flag) => {
    platformUtilsService.getDevice.mockReturnValue(device);

    await expect(
      firstValueFrom(nativeWebAuthnEnabled$(platformUtilsService, configService)),
    ).resolves.toBe(true);
    expect(configService.getFeatureFlag$).toHaveBeenCalledWith(flag);
  });

  it.each([DeviceType.ChromeExtension])("is off for device type %s", async (device) => {
    platformUtilsService.getDevice.mockReturnValue(device);

    await expect(
      firstValueFrom(nativeWebAuthnEnabled$(platformUtilsService, configService)),
    ).resolves.toBe(false);
    expect(configService.getFeatureFlag$).not.toHaveBeenCalled();
  });
});
