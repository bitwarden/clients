import { Component } from "@angular/core";

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
  templateUrl: "restricted-item-types.component.html",
  imports: [SharedModule],
})
export class RestrictedItemTypesPolicyComponent extends BasePolicyEditComponent {
  constructor() {
    super();
  }
}
