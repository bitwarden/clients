import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { of } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  FormControlModule,
  LinkModule,
  SwitchComponent,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import {
  BasePolicyEditDefinition,
  BasePolicyEditComponent,
  PolicyCategory,
} from "@bitwarden/web-vault/app/admin-console/organizations/policies";

export class ActivateAutofillPolicy extends BasePolicyEditDefinition {
  name = "enableAutofillOnPageLoad";
  description = "activateAutofillPolicyDescription";
  type = PolicyType.ActivateAutofill;
  category = PolicyCategory.VaultManagement;
  priority = 40;
  component = ActivateAutofillPolicyComponent;
  showDescription = false;

  display$(organization: Organization, _configService: ConfigService) {
    return of(organization.useActivateAutofillPolicy);
  }
}

@Component({
  selector: "activate-autofill-policy-edit",
  template: `
    <p bitTypography="body1">
      {{ "activateAutofillPolicyDescV2" | i18n }}
      <a
        bitLink
        href="https://bitwarden.com/help/auto-fill-browser/#on-page-load"
        target="_blank"
        rel="noreferrer"
        >{{ "exploitAutofillOnPageLoad" | i18n }}</a
      >.
    </p>
    <bit-form-control>
      <bit-switch [formControl]="enabled"></bit-switch>
      <bit-label>{{ "enablePolicy" | i18n }}</bit-label>
    </bit-form-control>
  `,
  imports: [
    ReactiveFormsModule,
    LinkModule,
    FormControlModule,
    SwitchComponent,
    TypographyModule,
    I18nPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivateAutofillPolicyComponent extends BasePolicyEditComponent {}
