// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CalloutModule } from "@bitwarden/components";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
 
@Component({
  selector: "auth-password-callout",
  templateUrl: "password-callout.component.html",
  imports: [CommonModule, JslibModule, CalloutModule],
})
export class PasswordCalloutComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
   
  @Input() message = "masterPasswordPolicyInEffect";
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
   
  @Input() policy: MasterPasswordPolicyOptions;

  constructor(private i18nService: I18nService) {}

  getPasswordScoreAlertDisplay() {
    let str: string;
    switch (this.policy.minComplexity) {
      case 4:
        str = this.i18nService.t("strong");
        break;
      case 3:
        str = this.i18nService.t("good");
        break;
      default:
        str = this.i18nService.t("weak");
        break;
    }
    return str + " (" + this.policy.minComplexity + ")";
  }
}
