import { ChangeDetectionStrategy, Component } from "@angular/core";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";

import { SimpleTogglePolicyComponent } from "./simple-toggle-policy.component";

export class RemoveUnlockWithPinPolicy extends BasePolicyEditDefinition {
  name = "removeUnlockWithPinPolicyTitle";
  description = "removeUnlockWithPinPolicyDesc";
  descriptionV2 = "removeUnlockWithPinPolicyDescV2";
  type = PolicyType.RemoveUnlockWithPin;
  category = PolicyCategory.Authentication;
  priority = 80;
  component = RemoveUnlockWithPinPolicyComponent;
  flaggedComponent = {
    flag: FeatureFlag.PolicyDrawers,
    component: SimpleTogglePolicyComponent,
  };
}

@Component({
  selector: "remove-unlock-with-pin-policy-edit",
  templateUrl: "remove-unlock-with-pin.component.html",
  imports: [SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RemoveUnlockWithPinPolicyComponent extends BasePolicyEditComponent {}
