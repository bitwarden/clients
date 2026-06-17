import { Injectable } from "@angular/core";

import { DefaultLoginViaWebAuthnComponentService } from "@bitwarden/angular/auth/login-via-webauthn/default-login-via-webauthn-component.service";
import { LoginViaWebAuthnComponentService } from "@bitwarden/angular/auth/login-via-webauthn/login-via-webauthn-component.service";

@Injectable()
export class ExtensionLoginViaWebAuthnComponentService
  extends DefaultLoginViaWebAuthnComponentService
  implements LoginViaWebAuthnComponentService
{
  showTroubleLoggingInText = false;
  leftAlignDescription = true;
}
