import { Observable, of } from "rxjs";

import { DeviceType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

/** The feature flags for each platform's passkey login, passkey unlock and WebAuthn 2FA. */
type NativeWebAuthnFlag = FeatureFlag.PM46060_DesktopWebAuthnClientWindows;

/** The feature flag for a platform's passkey login, passkey unlock and WebAuthn 2FA. */
function platformFlag(device: DeviceType): NativeWebAuthnFlag | null {
  switch (device) {
    case DeviceType.WindowsDesktop:
      return FeatureFlag.PM46060_DesktopWebAuthnClientWindows;
    default:
      return null;
  }
}

/**
 * Whether WebAuthn requests use the platform's passkey APIs (see `installNativeWebAuthn`). This
 * enables logging in and unlocking with a passkey, and WebAuthn 2FA from the app's window.
 */
export function nativeWebAuthnEnabled$(
  platformUtilsService: PlatformUtilsService,
  configService: ConfigService,
): Observable<boolean> {
  const flag = platformFlag(platformUtilsService.getDevice());
  return flag == null ? of(false) : configService.getFeatureFlag$(flag);
}
