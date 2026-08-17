import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { autotypeFeatureFlagEnabled$ } from "@bitwarden/common/desktop-native/services/autotype-feature-flags";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CheckboxModule, FormFieldModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";

import { SimpleTogglePolicyComponent } from "./simple-toggle-policy.component";

export class DesktopAutotypeDefaultSettingPolicy extends BasePolicyEditDefinition {
  name = "desktopAutotypePolicy";
  description = "desktopAutotypePolicyDesc";
  type = PolicyType.AutotypeDefaultSetting;
  category = PolicyCategory.VaultManagement;
  priority = 70;
  component = DesktopAutotypeDefaultSettingPolicyComponent;
  v2 = {
    component: SimpleTogglePolicyComponent,
    name: "desktopAutotypePolicyTitleV2",
    description: "desktopAutotypePolicyDescV2",
  };

  display$(organization: Organization, configService: ConfigService) {
    return autotypeFeatureFlagEnabled$(configService);
  }
}

@Component({
  selector: "autotype-policy-edit",
  templateUrl: "autotype-policy.component.html",
  imports: [ReactiveFormsModule, CheckboxModule, FormFieldModule, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesktopAutotypeDefaultSettingPolicyComponent extends BasePolicyEditComponent {}
