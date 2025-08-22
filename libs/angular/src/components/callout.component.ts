// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Input, OnInit } from "@angular/core";

import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CalloutTypes } from "@bitwarden/components";

/**
 * @deprecated use the CL's `CalloutComponent` instead
 */
@Component({
  selector: "app-callout",
  templateUrl: "callout.component.html",
  standalone: false,
})
export class DeprecatedCalloutComponent implements OnInit {
  @Input() type: CalloutTypes = "info";
  @Input() icon: string;
  @Input() title: string;
  @Input() enforcedPolicyOptions: MasterPasswordPolicyOptions;
  @Input() enforcedPolicyMessage: string;
  @Input() useAlertRole = false;

  calloutStyle: string;

  constructor(private i18nService: I18nService) {}

  ngOnInit() {
    this.calloutStyle = this.type;

    if (this.enforcedPolicyMessage === undefined) {
      this.enforcedPolicyMessage = this.i18nService.t("masterPasswordPolicyInEffect");
    }
  }

  getPasswordScoreAlertDisplay() {
    if (this.enforcedPolicyOptions == null) {
      return "";
    }

    let str: string;
    switch (this.enforcedPolicyOptions.minComplexity) {
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
    return str + " (" + this.enforcedPolicyOptions.minComplexity + ")";
  }
}
