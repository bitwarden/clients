import { Component, OnInit, TemplateRef, ViewChild } from "@angular/core";
import { lastValueFrom } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService } from "@bitwarden/components";

import { LooseComponentsModule, SharedModule } from "../../../shared";

import { BasePolicy, BasePolicyComponent } from "./base-policy.component";

export class vNextOrganizationDataOwnershipPolicy extends BasePolicy {
  name = "organizationDataOwnership";
  description = "organizationDataOwnershipDesc";
  type = PolicyType.OrganizationDataOwnership;
  component = vNextOrganizationDataOwnershipPolicyComponent;
  showDescription = false;
}

@Component({
  selector: "vnext-policy-organization-data-ownership",
  templateUrl: "vnext-organization-data-ownership.component.html",
  standalone: true,
  imports: [SharedModule, LooseComponentsModule],
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
    if (this.policyResponse?.enabled && this.policyResponse?.enabled != this.enabled.value) {
      const dialogRef = this.dialogService.open(this.warningContent);
      const result = await lastValueFrom(dialogRef.closed);

      if (!result) {
        throw new Error(this.i18nService.t("canceled"));
      }
    }

    return super.buildRequest();
  }
}
