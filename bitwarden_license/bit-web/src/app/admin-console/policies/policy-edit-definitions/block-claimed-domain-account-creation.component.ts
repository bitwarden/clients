import { ChangeDetectionStrategy, Component } from "@angular/core";
import { map, Observable } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
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

  override display$(organization: Organization, configService: ConfigService): Observable<boolean> {
    return configService
      .getFeatureFlag$(FeatureFlag.BlockClaimedDomainAccountCreation)
      .pipe(map((enabled) => enabled && organization.useOrganizationDomains));
  }
}

@Component({
  selector: "block-claimed-domain-account-creation-policy-edit",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "block-claimed-domain-account-creation.component.html",
  imports: [SharedModule],
})
export class BlockClaimedDomainAccountCreationPolicyComponent extends BasePolicyEditComponent {}
