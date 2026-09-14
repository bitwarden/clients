import { PolicyType } from "@bitwarden/common/admin-console/enums";
import {
  BasePolicyEditDefinition,
  PolicyCategory,
} from "@bitwarden/web-vault/app/admin-console/organizations/policies";
import { SimpleTogglePolicyComponent } from "@bitwarden/web-vault/app/admin-console/organizations/policies/policy-edit-definitions";

export class DisablePersonalVaultExportPolicy extends BasePolicyEditDefinition {
  name = "disableExport";
  description = "disablePersonalVaultExportDescriptionV2";
  descriptionVfo1 = "disablePersonalVaultExportDescriptionListVfo1";
  drawerDescriptionVfo1 = "disablePersonalVaultExportDescriptionVfo1";
  type = PolicyType.DisablePersonalVaultExport;
  category = PolicyCategory.DataControl;
  priority = 50;
  component = SimpleTogglePolicyComponent;
}
