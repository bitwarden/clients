import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { map } from "rxjs/operators";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AutotypeFeatureFlagState } from "@bitwarden/common/desktop-native/enums/autotype-feature-flag-state.enum";
import { autotypeFeatureFlagState$ } from "@bitwarden/common/desktop-native/services/autotype-feature-flags";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  FormControlModule,
  LinkComponent,
  SwitchComponent,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { BasePolicyEditComponent, BasePolicyEditDefinition } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";

export class DesktopAutotypeGaPolicy extends BasePolicyEditDefinition {
  name = "desktopAppAutofillPolicyTitle";
  description = "desktopAppAutofillPolicyDesc";
  type = PolicyType.AutotypeGaPolicy;
  category = PolicyCategory.VaultManagement;
  priority = 71;
  component = DesktopAutotypeGaPolicyComponent;
  showDescription = false;

  display$(organization: Organization, configService: ConfigService) {
    return autotypeFeatureFlagState$(configService).pipe(
      map((state) => state === AutotypeFeatureFlagState.Ga),
    );
  }
}

@Component({
  selector: "app-autotype-ga-policy-edit",
  template: `
    <p bitTypography="body1">
      {{ "desktopAppAutofillPolicyDrawerDesc" | i18n }}
      <a
        bitLink
        href="https://bitwarden.com/help/autofill-from-desktop-app/"
        target="_blank"
        rel="noreferrer"
        endIcon="bwi-external-link"
        >{{ "learnMore" | i18n }}</a
      >
    </p>
    <bit-form-control>
      <bit-switch [formControl]="enabled"></bit-switch>
      <bit-label>{{ "enablePolicy" | i18n }}</bit-label>
    </bit-form-control>
  `,
  imports: [
    ReactiveFormsModule,
    FormControlModule,
    LinkComponent,
    SwitchComponent,
    TypographyModule,
    I18nPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesktopAutotypeGaPolicyComponent extends BasePolicyEditComponent {}
