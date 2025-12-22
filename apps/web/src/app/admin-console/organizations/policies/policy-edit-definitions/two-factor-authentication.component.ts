import { ChangeDetectionStrategy, Component } from "@angular/core";

import { PolicyType } from "@bitwarden/common/admin-console/enums";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";

export class TwoFactorAuthenticationPolicy extends BasePolicyEditDefinition {
  name = "twoStepLoginPolicyTitle";
  description = "twoStepLoginPolicyDesc";
  type = PolicyType.TwoFactorAuthentication;
  component = TwoFactorAuthenticationPolicyComponent;
}

@Component({
  selector: "two-factor-authentication-policy-edit",
  templateUrl: "two-factor-authentication.component.html",
  imports: [SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TwoFactorAuthenticationPolicyComponent extends BasePolicyEditComponent {}
