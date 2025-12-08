import { Component } from "@angular/core";
import { of } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  BasePolicyEditDefinition,
  BasePolicyEditComponent,
} from "@bitwarden/web-vault/app/admin-console/organizations/policies";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

export class ActivateAutofillPolicy extends BasePolicyEditDefinition {
  name = "activateAutofill";
  description = "activateAutofillPolicyDesc";
  type = PolicyType.ActivateAutofill;
  component = ActivateAutofillPolicyComponent;

  display(organization: Organization, configService: ConfigService) {
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
