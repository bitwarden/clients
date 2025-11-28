import { Component } from "@angular/core";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import {
  BasePolicyEditDefinition,
  BasePolicyEditComponent,
} from "@bitwarden/web-vault/app/admin-console/organizations/policies";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

export class DisablePersonalVaultExportPolicy extends BasePolicyEditDefinition {
  name = "disablePersonalVaultExport";
  description = "disablePersonalVaultExportDescription";
  type = PolicyType.DisablePersonalVaultExport;
  component = DisablePersonalVaultExportPolicyComponent;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "disable-personal-vault-export.component.html",
  imports: [SharedModule],
})
export class DisablePersonalVaultExportPolicyComponent extends BasePolicyEditComponent {}
