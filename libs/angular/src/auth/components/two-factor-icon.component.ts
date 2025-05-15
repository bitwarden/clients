// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Input } from "@angular/core";

import { EmailIcon } from "../icons/email.icon";
import { RecoveryCodeIcon } from "../icons/recovery.icon";
import { TOTPIcon } from "../icons/totp.icon";
import { WebAuthnIcon } from "../icons/webauthn.icon";

@Component({
  selector: "auth-two-factor-icon",
  templateUrl: "./two-factor-icon.component.html",
  standalone: false,
})
export class TwoFactorIconComponent {
  @Input() provider: any;
  @Input() name: string;

  protected readonly Icons = {
    TOTPIcon,
    EmailIcon,
    WebAuthnIcon,
    RecoveryCodeIcon,
  };

  constructor() {}
}
