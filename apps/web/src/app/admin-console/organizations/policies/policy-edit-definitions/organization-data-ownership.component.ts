import { ChangeDetectionStrategy, Component, OnInit, TemplateRef, ViewChild } from "@angular/core";
import { lastValueFrom, map, Observable } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { VNextSavePolicyRequest } from "@bitwarden/common/admin-console/models/request/v-next-save-policy.request";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrgKey } from "@bitwarden/common/types/key";
import { CenterPositionStrategy, DialogService } from "@bitwarden/components";
import { EncString } from "@bitwarden/sdk-internal";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";

type VNextSaveOrganizationDataOwnershipPolicyRequest = VNextSavePolicyRequest<{
  defaultUserCollectionName: string;
}>;

export class OrganizationDataOwnershipPolicy extends BasePolicyEditDefinition {
  name = "organizationDataOwnership";
  description = "organizationDataOwnershipDesc";
  type = PolicyType.OrganizationDataOwnership;
  component = OrganizationDataOwnershipPolicyComponent;
  showDescription = false;

  override display$(organization: Organization, configService: ConfigService): Observable<boolean> {
    return configService
      .getFeatureFlag$(FeatureFlag.MigrateMyVaultToMyItems)
      .pipe(map((enabled) => !enabled));
  }
}

@Component({
  selector: "organization-data-ownership-policy-edit",
  templateUrl: "organization-data-ownership.component.html",
  imports: [SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationDataOwnershipPolicyComponent
  extends BasePolicyEditComponent
  implements OnInit
{
  constructor(
    private dialogService: DialogService,
    private i18nService: I18nService,
    private encryptService: EncryptService,
  ) {
    super();
  }

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild("dialog", { static: true }) warningContent!: TemplateRef<unknown>;

  override async confirm(): Promise<boolean> {
    if (this.policyResponse?.enabled && !this.enabled.value) {
      const dialogRef = this.dialogService.open(this.warningContent, {
        positionStrategy: new CenterPositionStrategy(),
      });
      const result = await lastValueFrom(dialogRef.closed);
      return Boolean(result);
    }
    return true;
  }

  async buildVNextRequest(
    orgKey: OrgKey,
  ): Promise<VNextSaveOrganizationDataOwnershipPolicyRequest> {
    if (!this.policy) {
      throw new Error("Policy was not found");
    }

    const defaultUserCollectionName = await this.getEncryptedDefaultUserCollectionName(orgKey);

    const request: VNextSaveOrganizationDataOwnershipPolicyRequest = {
      policy: {
        enabled: this.enabled.value ?? false,
        data: this.buildRequestData(),
      },
      metadata: {
        defaultUserCollectionName,
      },
    };

    return request;
  }

  private async getEncryptedDefaultUserCollectionName(orgKey: OrgKey): Promise<EncString> {
    const defaultCollectionName = this.i18nService.t("myItems");
    const encrypted = await this.encryptService.encryptString(defaultCollectionName, orgKey);

    if (!encrypted.encryptedString) {
      throw new Error("Encryption error");
    }

    return encrypted.encryptedString;
  }
}
