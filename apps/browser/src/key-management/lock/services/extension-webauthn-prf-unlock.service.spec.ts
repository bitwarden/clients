import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { WebAuthnLoginPrfKeyServiceAbstraction } from "@bitwarden/common/auth/abstractions/webauthn/webauthn-login-prf-key.service.abstraction";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/common/types/guid";
// eslint-disable-next-line no-restricted-imports
import { EncryptService } from "@bitwarden/legacy-crypto";
import { StateProvider } from "@bitwarden/state";

import { ExtensionWebAuthnPrfUnlockService } from "./extension-webauthn-prf-unlock.service";

describe("ExtensionWebAuthnPrfUnlockService", () => {
  const userId = "userId" as UserId;

  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let stateProvider: MockProxy<StateProvider>;
  let service: ExtensionWebAuthnPrfUnlockService;

  beforeEach(() => {
    platformUtilsService = mock<PlatformUtilsService>();
    stateProvider = mock<StateProvider>();
    stateProvider.getUserState$.mockReturnValue(
      of({ options: [{ credentialId: "AQID", transports: ["internal"] }] }),
    );
    const win = { navigator: { credentials: { get: jest.fn() } } } as unknown as Window;

    service = new ExtensionWebAuthnPrfUnlockService(
      mock<WebAuthnLoginPrfKeyServiceAbstraction>(),
      stateProvider,
      mock<EncryptService>(),
      mock<EnvironmentService>(),
      win,
      mock<LogService>(),
      platformUtilsService,
    );
  });

  it("is available in Chromium-based browsers when the user has PRF credentials", async () => {
    platformUtilsService.isChromium.mockReturnValue(true);

    await expect(service.isPrfUnlockAvailable(userId)).resolves.toBe(true);
  });

  it("is not available in other browsers", async () => {
    platformUtilsService.isChromium.mockReturnValue(false);

    await expect(service.isPrfUnlockAvailable(userId)).resolves.toBe(false);
  });

  it("is not available when the user has no PRF credentials", async () => {
    platformUtilsService.isChromium.mockReturnValue(true);
    stateProvider.getUserState$.mockReturnValue(of({ options: [] }));

    await expect(service.isPrfUnlockAvailable(userId)).resolves.toBe(false);
  });
});
