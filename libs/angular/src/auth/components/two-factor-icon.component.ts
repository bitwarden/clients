// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Input } from "@angular/core";

import {
  Icon,
  TwoFactorAuthAuthenticatorIcon,
  TwoFactorAuthEmailIcon,
  TwoFactorAuthWebAuthnIcon,
} from "@bitwarden/assets/svg";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
 
@Component({
  selector: "auth-two-factor-icon",
  templateUrl: "./two-factor-icon.component.html",
  standalone: false,
})
export class TwoFactorIconComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
   
  @Input() provider: any;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
   
  @Input() name: string;

  protected readonly IconProviderMap: { [key: number | string]: Icon } = {
    0: TwoFactorAuthAuthenticatorIcon,
    1: TwoFactorAuthEmailIcon,
    7: TwoFactorAuthWebAuthnIcon,
  };

  constructor() {}
}
