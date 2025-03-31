import { Component } from "@angular/core";

import { PolicyType } from "@bitwarden/common/admin-console/enums";

import { BasePolicy, BasePolicyComponent } from "./base-policy.component";

export class RemoveUnlockWithPinPolicy extends BasePolicy {
  name = "removeUnlockWithPinPolicyTitle";
  description = "removeUnlockWithPinPolicyDesc";
  type = PolicyType.RemoveUnlockWithPin;
  component = RemoveUnlockWithPinPolicyComponent;
}

@Component({
  selector: "remove-unlock-with-pin",
  templateUrl: "remove-unlock-with-pin.component.html",
})
export class RemoveUnlockWithPinPolicyComponent extends BasePolicyComponent {}
