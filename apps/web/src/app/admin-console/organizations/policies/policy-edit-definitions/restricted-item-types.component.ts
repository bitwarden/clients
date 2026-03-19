import { ChangeDetectionStrategy, Component } from "@angular/core";

import { PolicyType } from "@bitwarden/common/admin-console/enums";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";

export class RestrictedItemTypesPolicy extends BasePolicyEditDefinition {
  name = "restrictedItemTypePolicy";
  description = "restrictedItemTypePolicyDesc";
  type = PolicyType.RestrictedItemTypes;
  component = RestrictedItemTypesPolicyComponent;
}

@Component({
  selector: "restricted-item-types-policy-edit",
  templateUrl: "restricted-item-types.component.html",
  imports: [SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RestrictedItemTypesPolicyComponent extends BasePolicyEditComponent {
  constructor() {
    super();
  }
}
