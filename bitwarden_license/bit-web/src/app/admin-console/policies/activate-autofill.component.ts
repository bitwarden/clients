import { Component } from "@angular/core";
import { of } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  BasePolicy,
  BasePolicyComponent,
} from "@bitwarden/web-vault/app/admin-console/organizations/policies/base-policy.component";

export class ActivateAutofillPolicy extends BasePolicy {
  name = "activateAutofill";
  description = "activateAutofillPolicyDesc";
  type = PolicyType.ActivateAutofill;
  component = ActivateAutofillPolicyComponent;

  display(organization: Organization, configService: ConfigService) {
    return of(organization.useActivateAutofillPolicy);
  }
}

@Component({
  selector: "policy-activate-autofill",
  templateUrl: "activate-autofill.component.html",
  standalone: false,
})
export class ActivateAutofillPolicyComponent extends BasePolicyComponent {}
