import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  Signal,
  TemplateRef,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder } from "@angular/forms";
import {
  catchError,
  combineLatest,
  defer,
  firstValueFrom,
  from,
  map,
  Observable,
  of,
  startWith,
  switchMap,
} from "rxjs";

import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { VNextSavePolicyRequest } from "@bitwarden/common/admin-console/models/request/v-next-save-policy.request";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { assertNonNullish } from "@bitwarden/common/auth/utils";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";
import { EncString } from "@bitwarden/sdk-internal";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";
import { MultiStepPolicyEditDialogComponent, PolicyStep } from "../policy-edit-dialogs";

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

  editDialogComponent = MultiStepPolicyEditDialogComponent;

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
  private readonly step0Title: Signal<TemplateRef<unknown>> = viewChild.required("step0Title");
  private readonly step0Footer: Signal<TemplateRef<unknown>> = viewChild.required("step0Footer");

  protected readonly centralizeDataOwnershipEnabled$: Observable<boolean> = defer(() =>
    from(
      this.policyApiService.getPolicy(
        this.organizationId ?? "",
        PolicyType.OrganizationDataOwnership,
      ),
    ).pipe(
      map((policy) => policy.enabled),
      catchError(() => of(false)),
    ),
  );

  protected readonly saveDisabled$: Observable<boolean> = combineLatest([
    this.centralizeDataOwnershipEnabled$,
    this.enabled.valueChanges.pipe(startWith(this.enabled.value)),
  ]).pipe(map(([policyEnabled, value]) => !policyEnabled && !value));

  readonly policySteps: PolicyStep[] = [
    {
      titleContent: this.step0Title,
      footerContent: this.step0Footer,
      disableSave: this.saveDisabled$,
      sideEffect: this.savePolicy.bind(this),
    },
  ];

  constructor(
    private readonly i18nService: I18nService,
    private readonly encryptService: EncryptService,
    private readonly formBuilder: FormBuilder,
    private readonly policyApiService: PolicyApiServiceAbstraction,
    private readonly accountService: AccountService,
    private readonly keyService: KeyService,
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

  readonly data = this.formBuilder.group({
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

  private async savePolicy(): Promise<void> {
    const orgKeys = await firstValueFrom(
      this.accountService.activeAccount$.pipe(
        getUserId,
        switchMap((userId) => this.keyService.orgKeys$(userId)),
      ),
    );

    assertNonNullish(orgKeys, "Org keys not provided");

    const orgKey = orgKeys[this.organizationId as OrganizationId];
    const request = await this.buildVNextRequest(orgKey);

    await this.policyApiService.putPolicyVNext(
      this.organizationId ?? "",
      this.policy?.type ?? PolicyType.OrganizationDataOwnership,
      request,
    );
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
