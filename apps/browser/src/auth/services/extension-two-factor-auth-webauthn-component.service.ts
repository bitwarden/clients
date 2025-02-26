import {
  DefaultTwoFactorAuthWebAuthnComponentService,
  TwoFactorAuthWebAuthnComponentService,
} from "@bitwarden/auth/angular";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

export class ExtensionTwoFactorAuthWebAuthnComponentService
  extends DefaultTwoFactorAuthWebAuthnComponentService
  implements TwoFactorAuthWebAuthnComponentService
{
  constructor(private platformUtilsService: PlatformUtilsService) {
    super();
  }

  /**
   * In the browser extension, we open webAuthn in a new web client tab sometimes due to inline
   * WebAuthn Iframe's not working in some browsers. We open a 2FA popout upon successful
   * completion of WebAuthn submission with query parameters to finish the 2FA process.
   * @returns boolean
   */
  shouldOpenWebAuthnInNewTab(): boolean {
    const isChrome = this.platformUtilsService.isChrome();
    if (isChrome) {
      // Chrome now supports WebAuthn in the iframe in the extension now.
      return false;
    }

    return true;
  }
}
