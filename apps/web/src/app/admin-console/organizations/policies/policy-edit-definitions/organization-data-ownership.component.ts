import { ChangeDetectionStrategy, Component, OnInit, signal } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder } from "@angular/forms";
import { firstValueFrom, startWith } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { SavePolicyRequest } from "@bitwarden/common/admin-console/models/request/save-policy.request";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { getById } from "@bitwarden/common/platform/misc";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { EncString } from "@bitwarden/sdk-internal";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";
import { MultiStepPolicyEditDialogComponent } from "../policy-edit-dialogs";
import { PolicyStep } from "../policy-edit-dialogs/models";

type SaveOrganizationDataOwnershipPolicyRequest = SavePolicyRequest<{
  defaultUserCollectionName: string;
}>;

type OrganizationDataOwnershipPolicyData = {
  enableIndividualItemsTransfer: boolean;
};

export class OrganizationDataOwnershipPolicy extends BasePolicyEditDefinition {
  name = "centralizeDataOwnership";
  description = "centralizeDataOwnershipDesc";
  type = PolicyType.OrganizationDataOwnership;
  category = PolicyCategory.DataControl;
  priority = 20;
  component = OrganizationDataOwnershipPolicyComponent;
  showDescription = false;

  editDialogComponent = MultiStepPolicyEditDialogComponent;
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
  protected readonly useMyItems = signal(false);

  constructor(
    private readonly i18nService: I18nService,
    private readonly encryptService: EncryptService,
    private readonly formBuilder: FormBuilder,
    private readonly organizationService: OrganizationService,
  ) {
    super();

    this.enabled.valueChanges.pipe(takeUntilDestroyed()).subscribe((enabled) => {
      if (enabled && this.useMyItems()) {
        this.data.controls.enableIndividualItemsTransfer.enable();
      } else {
        this.data.controls.enableIndividualItemsTransfer.disable();
        this.data.controls.enableIndividualItemsTransfer.setValue(false);
      }
    });
  }

  override readonly policySteps: PolicyStep[] = [
    {
      sideEffect: () => this.savePolicy(),
    },
  ];

  readonly data = this.formBuilder.group({
    enableIndividualItemsTransfer: [{ value: false, disabled: true }],
  });

  protected readonly enableIndividualItemsTransfer = toSignal(
    this.data.controls.enableIndividualItemsTransfer.valueChanges.pipe(startWith(false)),
    { initialValue: false },
  );

  override async ngOnInit(): Promise<void> {
    super.ngOnInit();

    const orgId = this.policyResponse()?.organizationId as OrganizationId | undefined;
    if (orgId) {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const org = await firstValueFrom(
        this.organizationService.organizations$(userId).pipe(getById(orgId)),
      );
      this.useMyItems.set(org?.useMyItems ?? false);
    }

    if (this.enabled.value && this.useMyItems()) {
      this.data.controls.enableIndividualItemsTransfer.enable();
    }
  }

  protected override loadData() {
    if (!this.policyResponse()?.data) {
      return;
    }

    const data = this.policyResponse()!.data as OrganizationDataOwnershipPolicyData;
    this.data.patchValue({
      enableIndividualItemsTransfer: data.enableIndividualItemsTransfer ?? false,
    });
  }

  protected override buildRequestData(): OrganizationDataOwnershipPolicyData {
    const raw = this.data.getRawValue();
    return {
      enableIndividualItemsTransfer:
        (this.useMyItems() && raw.enableIndividualItemsTransfer) ?? false,
    };
  }

  override async buildRequest(
    orgKey?: OrgKey,
  ): Promise<SaveOrganizationDataOwnershipPolicyRequest> {
    if (!this.policy()) {
      throw new Error("Policy was not found");
    }

    if (orgKey == null) {
      throw new Error("No encryption key for this organization.");
    }

    const defaultUserCollectionName = await this.getEncryptedDefaultUserCollectionName(orgKey);

    return {
      policy: {
        enabled: this.enabled.value ?? false,
        data: this.buildRequestData(),
      },
      metadata: {
        defaultUserCollectionName,
      },
    };
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
