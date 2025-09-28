import { Component } from "@angular/core";

import { BaseLoginViaWebAuthnComponent } from "@bitwarden/angular/auth/components/base-login-via-webauthn.component";
import {
  TwoFactorAuthSecurityKeyIcon,
  TwoFactorAuthSecurityKeyFailedIcon,
} from "@bitwarden/assets/svg";

@Component({
  selector: "app-login-via-webauthn",
  templateUrl: "login-via-webauthn.component.html",
  standalone: false,
})
export class LoginViaWebAuthnComponent extends BaseLoginViaWebAuthnComponent {
  protected readonly Icons = {
    TwoFactorAuthSecurityKeyIcon,
    TwoFactorAuthSecurityKeyFailedIcon,
  };
}
