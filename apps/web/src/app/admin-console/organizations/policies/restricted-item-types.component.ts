import { Component } from "@angular/core";
import { UntypedFormBuilder, UntypedFormGroup } from "@angular/forms";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { CipherType } from "@bitwarden/common/vault/enums";

import { BasePolicy, BasePolicyComponent } from "./base-policy.component";

export class RestrictedItemTypesPolicy extends BasePolicy {
  name = "restrictedItemTypes";
  description = "restrictedItemTypesPolicyDesc";
  type = PolicyType.RestrictedItemTypesPolicy;
  component = RestrictedItemTypesPolicyComponent;
}

@Component({
  selector: "policy-restricted-item-types",
  templateUrl: "restricted-item-types.component.html",
  standalone: false,
})
export class RestrictedItemTypesPolicyComponent extends BasePolicyComponent {
  CIPHER_TYPE_VALUES: readonly CipherType[] = Object.values(CipherType).filter(
    (v) => typeof v === "number",
  ) as CipherType[];

  data: UntypedFormGroup = this.formBuilder.group({
    restrictedTypes: this.CIPHER_TYPE_VALUES.map((type) => ({
      [type]: false,
    })),
  });

  constructor(private formBuilder: UntypedFormBuilder) {
    super();
  }
}
