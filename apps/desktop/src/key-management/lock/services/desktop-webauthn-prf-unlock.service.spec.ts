import { mock, MockProxy } from "jest-mock-extended";
import { of, throwError } from "rxjs";

import { WebAuthnLoginPrfKeyServiceAbstraction } from "@bitwarden/common/auth/abstractions/webauthn/webauthn-login-prf-key.service.abstraction";
import { DeviceType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/common/types/guid";
// eslint-disable-next-line no-restricted-imports
import { EncryptService } from "@bitwarden/legacy-crypto";
import { StateProvider } from "@bitwarden/state";

import { DesktopWebAuthnPrfUnlockService } from "./desktop-webauthn-prf-unlock.service";

describe("DesktopWebAuthnPrfUnlockService", () => {
  const userId = "userId" as UserId;

  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let stateProvider: MockProxy<StateProvider>;
  let configService: MockProxy<ConfigService>;
  let logService: MockProxy<LogService>;
  let service: DesktopWebAuthnPrfUnlockService;

  beforeEach(() => {
    platformUtilsService = mock<PlatformUtilsService>();
    platformUtilsService.getDevice.mockReturnValue(DeviceType.WindowsDesktop);
    stateProvider = mock<StateProvider>();
    stateProvider.getUserState$.mockReturnValue(
      of({ options: [{ credentialId: "AQID", transports: ["internal"] }] }),
    );
    configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockReturnValue(of(true));
    logService = mock<LogService>();
    const win = { navigator: { credentials: { get: jest.fn() } } } as unknown as Window;

    service = new DesktopWebAuthnPrfUnlockService(
      mock<WebAuthnLoginPrfKeyServiceAbstraction>(),
      stateProvider,
      mock<EncryptService>(),
      mock<EnvironmentService>(),
      win,
      logService,
      platformUtilsService,
      configService,
    );
  });

  it("is available when the platform's feature flag is on and the user has PRF credentials", async () => {
    await expect(service.isPrfUnlockAvailable(userId)).resolves.toBe(true);
    expect(configService.getFeatureFlag$).toHaveBeenCalledWith(
      FeatureFlag.PM46060_DesktopWebAuthnClientWindows,
    );
  });

  it("is not available when the platform's feature flag is off", async () => {
    configService.getFeatureFlag$.mockReturnValue(of(false));

    await expect(service.isPrfUnlockAvailable(userId)).resolves.toBe(false);
  });

  it("is not available when the platform's feature flag can't be read", async () => {
    configService.getFeatureFlag$.mockReturnValue(throwError(() => new Error("Unavailable")));

    await expect(service.isPrfUnlockAvailable(userId)).resolves.toBe(false);
    expect(logService.error).toHaveBeenCalled();
  });

  it("is not available when the user has no PRF credentials", async () => {
    stateProvider.getUserState$.mockReturnValue(of({ options: [] }));

    await expect(service.isPrfUnlockAvailable(userId)).resolves.toBe(false);
  });
});
