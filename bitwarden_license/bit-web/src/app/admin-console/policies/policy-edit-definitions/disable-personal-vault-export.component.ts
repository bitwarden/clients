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
import { SimpleTogglePolicyComponent } from "@bitwarden/web-vault/app/admin-console/organizations/policies/policy-edit-definitions";

export class DisablePersonalVaultExportPolicy extends BasePolicyEditDefinition {
  name = "disableExport";
  description = "disablePersonalVaultExportDescription";
  type = PolicyType.DisablePersonalVaultExport;
  category = PolicyCategory.DataControl;
  priority = 50;
  component = DisablePersonalVaultExportPolicyComponent;
  v2 = {
    component: SimpleTogglePolicyComponent,
    description: "disablePersonalVaultExportDescriptionV2",
  };
}

@Component({
  selector: "disable-personal-vault-export-policy-edit",
  templateUrl: "disable-personal-vault-export.component.html",
  imports: [ReactiveFormsModule, CheckboxModule, FormFieldModule, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DisablePersonalVaultExportPolicyComponent extends BasePolicyEditComponent {}
