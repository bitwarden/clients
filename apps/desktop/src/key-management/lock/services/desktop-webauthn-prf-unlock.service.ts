import { catchError, defer, firstValueFrom, Observable, of } from "rxjs";

import { WebAuthnLoginPrfKeyServiceAbstraction } from "@bitwarden/common/auth/abstractions/webauthn/webauthn-login-prf-key.service.abstraction";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DefaultWebAuthnPrfUnlockService } from "@bitwarden/key-management-ui";
// eslint-disable-next-line no-restricted-imports
import { EncryptService } from "@bitwarden/legacy-crypto";
import { StateProvider } from "@bitwarden/state";

import { nativeWebAuthnEnabled$ } from "../../../auth/webauthn/native-webauthn-feature";

/**
 * When the platform's feature flag is on, `navigator.credentials` uses the platform's passkey
 * APIs, or the web vault's WebAuthn connector in a browser where they can't be used, which
 * support PRF (see `installNativeWebAuthn`).
 */
export class DesktopWebAuthnPrfUnlockService extends DefaultWebAuthnPrfUnlockService {
  /** Whether the platform's feature flag is on. False if it can't be read. */
  private readonly enabled$: Observable<boolean>;

  constructor(
    webAuthnLoginPrfKeyService: WebAuthnLoginPrfKeyServiceAbstraction,
    stateProvider: StateProvider,
    encryptService: EncryptService,
    environmentService: EnvironmentService,
    window: Window,
    logService: LogService,
    platformUtilsService: PlatformUtilsService,
    configService: ConfigService,
  ) {
    super(
      webAuthnLoginPrfKeyService,
      stateProvider,
      encryptService,
      environmentService,
      window,
      logService,
    );
    this.enabled$ = defer(() => nativeWebAuthnEnabled$(platformUtilsService, configService)).pipe(
      catchError((error: unknown) => {
        logService.error("Error checking whether passkey unlock is enabled:", error);
        return of(false);
      }),
    );
  }

  override async isPrfUnlockAvailable(userId: UserId): Promise<boolean> {
    const enabled = await firstValueFrom(this.enabled$);
    return enabled && (await super.isPrfUnlockAvailable(userId));
  }
}
