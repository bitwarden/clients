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
  nameVfo1 = "freeFamiliesSponsorshipTitleVfo1";
  description = "freeFamiliesSponsorshipPolicyDesc";
  descriptionVfo1 = "freeFamiliesSponsorshipDescVfo1";
  type = PolicyType.FreeFamiliesSponsorship;
  category = PolicyCategory.VaultManagement;
  priority = 60;
  component = FreeFamiliesSponsorshipPolicyComponent;
  v2 = {
    component: SimpleTogglePolicyComponent,
    name: "freeFamiliesSponsorshipPolicyTitleV2",
    // Figma shows a drawer-specific VFO1 title ("Remove Sponsored Families Plan") that differs
    // from both the legacy drawer title and the list's VFO1 title (`nameVfo1`, singular "Family").
    nameVfo1: "freeFamiliesSponsorshipPolicyTitleV2Vfo1",
    description: "freeFamiliesSponsorshipPolicyDescV2",
    // Figma shows this drawer body unchanged under VFO1 - only the title and list row change.
    // Pinning this to the same key as `description` prevents the drawer from leaking the
    // list-only `descriptionVfo1` text.
    descriptionVfo1: "freeFamiliesSponsorshipPolicyDescV2",
  };
}

@Component({
  templateUrl: "free-families-sponsorship.component.html",
  imports: [ReactiveFormsModule, CheckboxModule, FormFieldModule, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FreeFamiliesSponsorshipPolicyComponent extends BasePolicyEditComponent {}
