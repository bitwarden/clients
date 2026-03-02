import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  signal,
  Signal,
  TemplateRef,
  viewChild,
  WritableSignal,
} from "@angular/core";
import { Observable } from "rxjs";

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
  ) {
    super();
  }
  private readonly policyForm: Signal<TemplateRef<any> | undefined> = viewChild("step0");
  private readonly warningContent: Signal<TemplateRef<any> | undefined> = viewChild("step1");
  protected readonly step: WritableSignal<number> = signal(0);

  protected steps = [this.policyForm, this.warningContent];

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

  setStep(step: number) {
    this.step.set(step);
  }
}
