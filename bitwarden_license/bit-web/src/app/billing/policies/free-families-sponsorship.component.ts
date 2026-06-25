import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { CheckboxModule, FormFieldModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import {
  BasePolicyEditDefinition,
  BasePolicyEditComponent,
  PolicyCategory,
} from "@bitwarden/web-vault/app/admin-console/organizations/policies";
import { SimpleTogglePolicyComponent } from "@bitwarden/web-vault/app/admin-console/organizations/policies/policy-edit-definitions/simple-toggle-policy.component";

export class FreeFamiliesSponsorshipPolicy extends BasePolicyEditDefinition {
  name = "freeFamiliesSponsorship";
  description = "freeFamiliesSponsorshipPolicyDesc";
  type = PolicyType.FreeFamiliesSponsorship;
  category = PolicyCategory.VaultManagement;
  priority = 60;
  component = FreeFamiliesSponsorshipPolicyComponent;
  v2 = {
    component: SimpleTogglePolicyComponent,
    name: "freeFamiliesSponsorshipPolicyTitleV2",
    description: "freeFamiliesSponsorshipPolicyDescV2",
  };
}

@Component({
  templateUrl: "free-families-sponsorship.component.html",
  imports: [ReactiveFormsModule, CheckboxModule, FormFieldModule, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FreeFamiliesSponsorshipPolicyComponent extends BasePolicyEditComponent {}
