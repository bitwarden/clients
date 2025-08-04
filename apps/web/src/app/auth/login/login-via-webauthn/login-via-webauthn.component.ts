import { Component } from "@angular/core";

import { BaseLoginViaWebAuthnComponent } from "@bitwarden/angular/auth/components/base-login-via-webauthn.component";
import { CreatePasskeyFailedIcon } from "@bitwarden/angular/auth/icons/create-passkey-failed.icon";
import { CreatePasskeyIcon } from "@bitwarden/angular/auth/icons/create-passkey.icon";

@Component({
  selector: "app-login-via-webauthn",
  templateUrl: "login-via-webauthn.component.html",
  standalone: false,
})
export class LoginViaWebAuthnComponent extends BaseLoginViaWebAuthnComponent {
  protected readonly Icons = { CreatePasskeyIcon, CreatePasskeyFailedIcon };
}
