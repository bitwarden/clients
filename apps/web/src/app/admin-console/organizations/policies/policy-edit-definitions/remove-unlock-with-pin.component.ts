import { ChangeDetectionStrategy, Component } from "@angular/core";

import { PolicyType } from "@bitwarden/common/admin-console/enums";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";

export class RemoveUnlockWithPinPolicy extends BasePolicyEditDefinition {
  name = "removeUnlockWithPinPolicyTitle";
  description = "removeUnlockWithPinPolicyDesc";
  type = PolicyType.RemoveUnlockWithPin;
  component = RemoveUnlockWithPinPolicyComponent;
}

@Component({
  selector: "remove-unlock-with-pin-policy-edit",
  templateUrl: "remove-unlock-with-pin.component.html",
  imports: [SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RemoveUnlockWithPinPolicyComponent extends BasePolicyEditComponent {}
