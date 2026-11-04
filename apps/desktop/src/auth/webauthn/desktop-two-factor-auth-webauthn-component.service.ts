import { firstValueFrom } from "rxjs";

import {
  DefaultTwoFactorAuthWebAuthnComponentService,
  TwoFactorAuthWebAuthnComponentService,
} from "@bitwarden/auth/angular";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { nativeWebAuthnEnabled$ } from "./native-webauthn-feature";

/**
 * `navigator.credentials` uses the platform's passkey APIs, or the web vault's desktop WebAuthn
 * connector in a browser where they can't be used (see `installNativeWebAuthn`), so WebAuthn 2FA
 * is started from the app's window instead of in the web vault's WebAuthn connector.
 */
export class DesktopTwoFactorAuthWebAuthnComponentService
  extends DefaultTwoFactorAuthWebAuthnComponentService
  implements TwoFactorAuthWebAuthnComponentService
{
  constructor(
    private platformUtilsService: PlatformUtilsService,
    private configService: ConfigService,
  ) {
    super();
  }

  override shouldAuthenticateInWindow(): Promise<boolean> {
    return firstValueFrom(nativeWebAuthnEnabled$(this.platformUtilsService, this.configService));
  }

  override async authenticateInWindow(
    options: PublicKeyCredentialRequestOptions,
    win: Window,
  ): Promise<string> {
    const credential = await win.navigator.credentials.get({ publicKey: options });
    if (!(credential instanceof PublicKeyCredential)) {
      throw new Error("No WebAuthn credential was returned.");
    }
    if (!(credential.response instanceof AuthenticatorAssertionResponse)) {
      throw new Error("Invalid WebAuthn response.");
    }

    // The same format as the web vault's WebAuthn connector.
    return JSON.stringify({
      id: credential.id,
      rawId: Utils.fromBufferToUrlB64(credential.rawId),
      type: credential.type,
      extensions: credential.getClientExtensionResults(),
      response: {
        authenticatorData: Utils.fromBufferToUrlB64(credential.response.authenticatorData),
        clientDataJson: Utils.fromBufferToUrlB64(credential.response.clientDataJSON),
        signature: Utils.fromBufferToUrlB64(credential.response.signature),
      },
    });
  }
}
