import { Injectable } from "@angular/core";

import { DefaultLoginViaWebAuthnComponentService } from "@bitwarden/angular/auth/login-via-webauthn/default-login-via-webauthn-component.service";
import { LoginViaWebAuthnComponentService } from "@bitwarden/angular/auth/login-via-webauthn/login-via-webauthn-component.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

@Injectable()
export class ExtensionLoginViaWebAuthnComponentService
  extends DefaultLoginViaWebAuthnComponentService
  implements LoginViaWebAuthnComponentService
{
  override successRoute = "/tabs/vault";

  constructor(private messagingService: MessagingService) {
    super();
  }

  async handleSuccessfulAuthentication(shouldAutoClosePopout: boolean): Promise<boolean> {
    if (shouldAutoClosePopout) {
      this.messagingService.send("openPopup");
      window.close();
      return true;
    }
    return false;
  }
}
