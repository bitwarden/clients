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

export class BlockClaimedDomainAccountCreationPolicy extends BasePolicyEditDefinition {
  name = "blockClaimedDomainAccountCreation";
  description = "blockClaimedDomainAccountCreationDesc";
  type = PolicyType.BlockClaimedDomainAccountCreation;
  component = BlockClaimedDomainAccountCreationPolicyComponent;
  showDescription = false; // Description is shown in the component template with inline link

  display(organization: Organization, configService: ConfigService) {
    return of(organization.useOrganizationDomains);
  }
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "block-claimed-domain-account-creation.component.html",
  imports: [SharedModule],
})
export class BlockClaimedDomainAccountCreationPolicyComponent extends BasePolicyEditComponent {}
