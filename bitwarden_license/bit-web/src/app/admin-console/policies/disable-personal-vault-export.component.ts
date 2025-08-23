import { Component } from "@angular/core";


import { PolicyType } from "@bitwarden/common/admin-console/enums";
import {
  BasePolicy,
  BasePolicyComponent,
} from "@bitwarden/web-vault/app/admin-console/organizations/policies/base-policy.component";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

export class DisablePersonalVaultExportPolicy extends BasePolicy {
  name = "disablePersonalVaultExport";
  description = "disablePersonalVaultExportDescription";
  type = PolicyType.DisablePersonalVaultExport;
  component = DisablePersonalVaultExportPolicyComponent;
}

@Component({
  templateUrl: "disable-personal-vault-export.component.html",
  imports: [SharedModule],
})
export class DisablePersonalVaultExportPolicyComponent extends BasePolicyComponent {}
