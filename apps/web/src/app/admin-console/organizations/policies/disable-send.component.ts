import { Component } from "@angular/core";

import { PolicyType } from "@bitwarden/common/admin-console/enums";

import { SharedModule } from "../../../shared";

import { BasePolicy, BasePolicyComponent } from "./base-policy.component";

export class DisableSendPolicy extends BasePolicy {
  name = "disableSend";
  description = "disableSendPolicyDesc";
  type = PolicyType.DisableSend;
  component = DisableSendPolicyComponent;
}

@Component({
  templateUrl: "disable-send.component.html",
  imports: [SharedModule],
})
export class DisableSendPolicyComponent extends BasePolicyComponent {}
