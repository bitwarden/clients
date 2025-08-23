import { Component } from "@angular/core";

import { PolicyType } from "@bitwarden/common/admin-console/enums";

import { SharedModule } from "../../../shared";

import { BasePolicy, BasePolicyComponent } from "./base-policy.component";

export class RemoveUnlockWithPinPolicy extends BasePolicy {
  name = "removeUnlockWithPinPolicyTitle";
  description = "removeUnlockWithPinPolicyDesc";
  type = PolicyType.RemoveUnlockWithPin;
  component = RemoveUnlockWithPinPolicyComponent;
}

@Component({
  templateUrl: "remove-unlock-with-pin.component.html",
  imports: [SharedModule],
})
export class RemoveUnlockWithPinPolicyComponent extends BasePolicyComponent {}
