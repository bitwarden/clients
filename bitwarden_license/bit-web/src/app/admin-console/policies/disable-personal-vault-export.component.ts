import { Component } from "@angular/core";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import {
  BasePolicy,
  BasePolicyComponent,
} from "@bitwarden/web-vault/app/admin-console/organizations/policies/base-policy.component";

export class DisablePersonalVaultExportPolicy extends BasePolicy {
  name = "disablePersonalVaultExport";
  description = "disablePersonalVaultExportDescription";
  type = PolicyType.DisablePersonalVaultExport;
  component = DisablePersonalVaultExportPolicyComponent;
}

@Component({
  selector: "policy-disable-personal-vault-export",
  templateUrl: "disable-personal-vault-export.component.html",
  standalone: false,
})
export class DisablePersonalVaultExportPolicyComponent extends BasePolicyComponent {}
