import { ChangeDetectionStrategy, Component, OnInit } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder } from "@angular/forms";
import { Observable, startWith } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { VNextSavePolicyRequest } from "@bitwarden/common/admin-console/models/request/v-next-save-policy.request";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrgKey } from "@bitwarden/common/types/key";
import { EncString } from "@bitwarden/sdk-internal";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";
import { OrganizationDataOwnershipPolicyDialogComponent } from "../policy-edit-dialogs";

type VNextSaveOrganizationDataOwnershipPolicyRequest = VNextSavePolicyRequest<{
  defaultUserCollectionName: string;
}>;

type OrganizationDataOwnershipPolicyData = {
  enableIndividualItemsTransfer: boolean;
};

export class vNextOrganizationDataOwnershipPolicy extends BasePolicyEditDefinition {
  name = "centralizeDataOwnership";
  description = "centralizeDataOwnershipDesc";
  type = PolicyType.OrganizationDataOwnership;
  component = vNextOrganizationDataOwnershipPolicyComponent;
  showDescription = false;

  editDialogComponent = OrganizationDataOwnershipPolicyDialogComponent;

  override display$(organization: Organization, configService: ConfigService): Observable<boolean> {
    return configService.getFeatureFlag$(FeatureFlag.MigrateMyVaultToMyItems);
  }
}

@Component({
  selector: "vnext-organization-data-ownership-policy-edit",
  templateUrl: "vnext-organization-data-ownership.component.html",
  imports: [SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class vNextOrganizationDataOwnershipPolicyComponent
  extends BasePolicyEditComponent
  implements OnInit
{
  constructor(
    private i18nService: I18nService,
    private encryptService: EncryptService,
    private formBuilder: FormBuilder,
  ) {
    super();

    this.enabled.valueChanges.pipe(takeUntilDestroyed()).subscribe((enabled) => {
      if (enabled) {
        this.data.controls.enableIndividualItemsTransfer.enable();
      } else {
        this.data.controls.enableIndividualItemsTransfer.disable();
        this.data.controls.enableIndividualItemsTransfer.setValue(false);
      }
    });
  }

  data = this.formBuilder.group({
    enableIndividualItemsTransfer: [{ value: false, disabled: true }],
  });

  protected readonly enableIndividualItemsTransfer = toSignal(
    this.data.controls.enableIndividualItemsTransfer.valueChanges.pipe(startWith(false)),
    { initialValue: false },
  );

  override ngOnInit(): void {
    super.ngOnInit();

    if (this.enabled.value) {
      this.data.controls.enableIndividualItemsTransfer.enable();
    }
  }

  protected override loadData() {
    if (!this.policyResponse?.data) {
      return;
    }

    const data = this.policyResponse.data as OrganizationDataOwnershipPolicyData;
    this.data.patchValue({
      enableIndividualItemsTransfer: data.enableIndividualItemsTransfer ?? false,
    });
  }

  protected override buildRequestData(): OrganizationDataOwnershipPolicyData {
    const raw = this.data.getRawValue();
    return {
      enableIndividualItemsTransfer: raw.enableIndividualItemsTransfer ?? false,
    };
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
