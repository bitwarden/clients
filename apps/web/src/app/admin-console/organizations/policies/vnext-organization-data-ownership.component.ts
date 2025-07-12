import { Component, OnInit, TemplateRef, ViewChild } from "@angular/core";
import { lastValueFrom, Observable } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService } from "@bitwarden/components";

import { SharedModule } from "../../../shared";

import { BasePolicy, BasePolicyComponent } from "./base-policy.component";

export class vNextOrganizationDataOwnershipPolicy extends BasePolicy {
  name = "organizationDataOwnership";
  description = "organizationDataOwnershipDesc";
  type = PolicyType.OrganizationDataOwnership;
  component = vNextOrganizationDataOwnershipPolicyComponent;
  showDescription = false;

  override display(organization: Organization, configService: ConfigService): Observable<boolean> {
    return configService.getFeatureFlag$(FeatureFlag.CreateDefaultLocation);
  }
}

@Component({
  selector: "vnext-policy-organization-data-ownership",
  templateUrl: "vnext-organization-data-ownership.component.html",
  standalone: true,
  imports: [SharedModule],
})
export class vNextOrganizationDataOwnershipPolicyComponent
  extends BasePolicyComponent
  implements OnInit
{
  constructor(
    private dialogService: DialogService,
    private i18nService: I18nService,
  ) {
    super();
  }

  @ViewChild("dialog", { static: true }) warningContent!: TemplateRef<unknown>;

  async buildRequest() {
    if (this.policyResponse?.enabled && !this.enabled.value) {
      const dialogRef = this.dialogService.open(this.warningContent);
      const result = await lastValueFrom(dialogRef.closed);

      if (!result) {
        throw new Error(this.i18nService.t("canceled"));
      }
    }

    return super.buildRequest();
  }
}
