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
import { SharedModule } from "@bitwarden/web-vault/app/shared";

export class ActivateAutofillPolicy extends BasePolicyEditDefinition {
  name = "activateAutofillPolicy";
  description = "activateAutofillPolicyDescription";
  type = PolicyType.ActivateAutofill;
  category = PolicyCategory.VaultManagement;
  priority = 40;
  component = ActivateAutofillPolicyComponent;
  v2 = {
    component: ActivateAutofillV2PolicyComponent,
    name: "enableAutofillOnPageLoad",
    showDescription: false,
  };

  display$(organization: Organization, _configService: ConfigService) {
    return of(organization.useActivateAutofillPolicy);
  }
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "activate-autofill-policy-edit",
  templateUrl: "activate-autofill.component.html",
  imports: [SharedModule],
})
export class ActivateAutofillPolicyComponent extends BasePolicyEditComponent {}

@Component({
  selector: "activate-autofill-v2-policy-edit",
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
export class ActivateAutofillV2PolicyComponent extends BasePolicyEditComponent {}
