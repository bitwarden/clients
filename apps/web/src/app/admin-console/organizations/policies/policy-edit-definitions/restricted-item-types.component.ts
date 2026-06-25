import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { CheckboxModule, FormFieldModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";

import { SimpleTogglePolicyComponent } from "./simple-toggle-policy.component";

export class RestrictedItemTypesPolicy extends BasePolicyEditDefinition {
  name = "restrictedItemTypePolicy";
  description = "restrictedItemTypePolicyDesc";
  type = PolicyType.RestrictedItemTypes;
  category = PolicyCategory.VaultManagement;
  priority = 50;
  component = RestrictedItemTypesPolicyComponent;
  v2 = {
    component: SimpleTogglePolicyComponent,
    description: "restrictedItemTypePolicyDescV2",
  };
}

@Component({
  selector: "restricted-item-types-policy-edit",
  templateUrl: "restricted-item-types.component.html",
  imports: [ReactiveFormsModule, CheckboxModule, FormFieldModule, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RestrictedItemTypesPolicyComponent extends BasePolicyEditComponent {
  constructor() {
    super();
  }
}
