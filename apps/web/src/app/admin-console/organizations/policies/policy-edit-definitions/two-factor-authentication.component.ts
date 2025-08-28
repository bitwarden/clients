import { Component } from "@angular/core";

import { PolicyType } from "@bitwarden/common/admin-console/enums";

import { SharedModule } from "../../../../shared";
import { BasePolicy, BasePolicyComponent } from "../base-policy.component";

export class TwoFactorAuthenticationPolicy extends BasePolicy {
  name = "twoStepLoginPolicyTitle";
  description = "twoStepLoginPolicyDesc";
  type = PolicyType.TwoFactorAuthentication;
  component = TwoFactorAuthenticationPolicyComponent;
}

@Component({
  templateUrl: "two-factor-authentication.component.html",
  imports: [SharedModule],
})
export class TwoFactorAuthenticationPolicyComponent extends BasePolicyComponent {}
