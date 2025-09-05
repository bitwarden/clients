import { Component, OnInit, TemplateRef, ViewChild } from "@angular/core";
import { lastValueFrom, Observable } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { PolicyRequest } from "@bitwarden/common/admin-console/models/request/policy.request";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrgKey } from "@bitwarden/common/types/key";
import { DialogService } from "@bitwarden/components";
import { EncString } from "@bitwarden/sdk-internal";

import { SharedModule } from "../../../shared";

import { BasePolicy, BasePolicyComponent } from "./base-policy.component";

interface VNextPolicyRequest {
  policy: PolicyRequest;
  metadata: {
    defaultUserCollectionName: string;
  };
}

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
    private encryptService: EncryptService,
  ) {
    super();
  }

  @ViewChild("dialog", { static: true }) warningContent!: TemplateRef<unknown>;

  override async confirm(): Promise<boolean> {
    if (this.policyResponse?.enabled && !this.enabled.value) {
      const dialogRef = this.dialogService.open(this.warningContent);
      const result = await lastValueFrom(dialogRef.closed);
      return Boolean(result);
    }
    return true;
  }

  async buildVNextRequest(orgKey: OrgKey): Promise<VNextPolicyRequest> {
    if (!this.policy) {
      throw new Error("Policy was not found");
    }

    const policyRequest: PolicyRequest = {
      type: this.policy.type,
      enabled: this.enabled.value,
      data: this.buildRequestData(),
    };

    const request: VNextPolicyRequest = {
      policy: policyRequest,
      metadata: {
        defaultUserCollectionName: await this.getEncryptedDefaultUserCollectionName(orgKey),
      },
    };

    return request;
  }

  private async getEncryptedDefaultUserCollectionName(orgKey: OrgKey): Promise<EncString> {
    const defaultCollectionName = this.i18nService.t("myItems");
    const encrypted = await this.encryptService.encryptString(defaultCollectionName, orgKey);
    return encrypted.encryptedString;
  }
}
