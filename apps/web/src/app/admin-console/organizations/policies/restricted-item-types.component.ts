import { Component } from "@angular/core";

import { PolicyType } from "@bitwarden/common/admin-console/enums";

import { BasePolicy, BasePolicyComponent } from "./base-policy.component";

export class RestrictedItemTypesPolicy extends BasePolicy {
  name = "restrictedItemTypePolicy";
  description = "restrictedItemTypePolicyDesc";
  type = PolicyType.RestrictedItemTypes;
  component = RestrictedItemTypesPolicyComponent;
}

@Component({
  selector: "policy-restricted-item-types",
  templateUrl: "restricted-item-types.component.html",
  standalone: false,
})
export class RestrictedItemTypesPolicyComponent extends BasePolicyComponent {
  constructor() {
    super();
  }
}
