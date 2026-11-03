import { WebAuthnLoginPrfKeyServiceAbstraction } from "@bitwarden/common/auth/abstractions/webauthn/webauthn-login-prf-key.service.abstraction";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DefaultWebAuthnPrfUnlockService } from "@bitwarden/key-management-ui";
// eslint-disable-next-line no-restricted-imports
import { EncryptService } from "@bitwarden/legacy-crypto";
import { StateProvider } from "@bitwarden/state";

/** Passkey unlock is only supported in Chromium-based browsers' extensions. */
export class ExtensionWebAuthnPrfUnlockService extends DefaultWebAuthnPrfUnlockService {
  constructor(
    webAuthnLoginPrfKeyService: WebAuthnLoginPrfKeyServiceAbstraction,
    stateProvider: StateProvider,
    encryptService: EncryptService,
    environmentService: EnvironmentService,
    window: Window,
    logService: LogService,
    private platformUtilsService: PlatformUtilsService,
  ) {
    super(
      webAuthnLoginPrfKeyService,
      stateProvider,
      encryptService,
      environmentService,
      window,
      logService,
    );
  }

  override async isPrfUnlockAvailable(userId: UserId): Promise<boolean> {
    return this.platformUtilsService.isChromium() && (await super.isPrfUnlockAvailable(userId));
  }
}
