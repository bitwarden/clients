import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { WebAuthnLoginPrfKeyServiceAbstraction } from "@bitwarden/common/auth/abstractions/webauthn/webauthn-login-prf-key.service.abstraction";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
// eslint-disable-next-line no-restricted-imports
import { EncryptService } from "@bitwarden/legacy-crypto";
import { StateProvider } from "@bitwarden/state";

import { DesktopWebAuthnPrfUnlockService } from "./desktop-webauthn-prf-unlock.service";

describe("DesktopWebAuthnPrfUnlockService", () => {
  const userId = "userId" as UserId;

  let service: DesktopWebAuthnPrfUnlockService;

  beforeEach(() => {
    const stateProvider = mock<StateProvider>();
    stateProvider.getUserState$.mockReturnValue(
      of({ options: [{ credentialId: "AQID", transports: ["internal"] }] }),
    );
    const win = { navigator: { credentials: { get: jest.fn() } } } as unknown as Window;

    service = new DesktopWebAuthnPrfUnlockService(
      mock<WebAuthnLoginPrfKeyServiceAbstraction>(),
      stateProvider,
      mock<EncryptService>(),
      mock<EnvironmentService>(),
      win,
      mock<LogService>(),
    );
  });

  it("is not available, even when the user has PRF credentials", async () => {
    await expect(service.isPrfUnlockAvailable(userId)).resolves.toBe(false);
  });
});
