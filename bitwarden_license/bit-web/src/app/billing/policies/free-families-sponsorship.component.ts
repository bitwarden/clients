import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { FormFieldModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import {
  BasePolicyEditDefinition,
  BasePolicyEditComponent,
  PolicyCategory,
} from "@bitwarden/web-vault/app/admin-console/organizations/policies";
import { SimpleTogglePolicyComponent } from "@bitwarden/web-vault/app/admin-console/organizations/policies/policy-edit-definitions/simple-toggle-policy.component";

export class FreeFamiliesSponsorshipPolicy extends BasePolicyEditDefinition {
  name = "freeFamiliesSponsorship";
  nameV2 = "freeFamiliesSponsorshipPolicyTitleV2";
  description = "freeFamiliesSponsorshipPolicyDesc";
  descriptionV2 = "freeFamiliesSponsorshipPolicyDescV2";
  type = PolicyType.FreeFamiliesSponsorship;
  category = PolicyCategory.VaultManagement;
  priority = 60;
  component = FreeFamiliesSponsorshipPolicyComponent;
  flaggedComponent = {
    flag: FeatureFlag.PolicyDrawers,
    component: SimpleTogglePolicyComponent,
  };
}

@Component({
  templateUrl: "free-families-sponsorship.component.html",
  imports: [ReactiveFormsModule, FormFieldModule, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FreeFamiliesSponsorshipPolicyComponent extends BasePolicyEditComponent {}
