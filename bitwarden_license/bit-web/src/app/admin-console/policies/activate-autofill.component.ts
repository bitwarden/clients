import { Component } from "@angular/core";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import {
  BasePolicy,
  BasePolicyComponent,
} from "@bitwarden/web-vault/app/admin-console/organizations/policies/base-policy.component";

export class ActivateAutofillPolicy extends BasePolicy {
  name = "activateAutofill";
  description = "activateAutofillPolicyDesc";
  type = PolicyType.ActivateAutofill;
  component = ActivateAutofillPolicyComponent;

  display(organization: Organization) {
    return organization.useActivateAutofillPolicy;
  }
}

@Component({
  selector: "policy-activate-autofill",
  templateUrl: "activate-autofill.component.html",
  standalone: false,
})
export class ActivateAutofillPolicyComponent extends BasePolicyComponent {}
