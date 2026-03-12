import { ChangeDetectionStrategy, Component } from "@angular/core";

import { PolicyType } from "@bitwarden/common/admin-console/enums";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";

export class RemoveUnlockWithPinPolicy extends BasePolicyEditDefinition {
  name = "removeUnlockWithPinPolicyTitle";
  description = "removeUnlockWithPinPolicyDesc";
  type = PolicyType.RemoveUnlockWithPin;
  category = PolicyCategory.Authentication;
  priority = 80;
  component = RemoveUnlockWithPinPolicyComponent;
}

@Component({
  selector: "remove-unlock-with-pin-policy-edit",
  templateUrl: "remove-unlock-with-pin.component.html",
  imports: [SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RemoveUnlockWithPinPolicyComponent extends BasePolicyEditComponent {}
