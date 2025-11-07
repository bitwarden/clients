// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { firstValueFrom, merge, Subject, takeUntil } from "rxjs";
import { debounceTime, map, switchMap } from "rxjs/operators";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { ProviderApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/provider/provider-api.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { OrganizationCreateRequest } from "@bitwarden/common/admin-console/models/request/organization-create.request";
import { OrganizationKeysRequest } from "@bitwarden/common/admin-console/models/request/organization-keys.request";
import { OrganizationUpgradeRequest } from "@bitwarden/common/admin-console/models/request/organization-upgrade.request";
import { ProviderOrganizationCreateRequest } from "@bitwarden/common/admin-console/models/request/provider/provider-organization-create.request";
import { ProviderResponse } from "@bitwarden/common/admin-console/models/response/provider/provider.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { assertNonNullish } from "@bitwarden/common/auth/utils";
import { PlanSponsorshipType, PlanType, ProductTierType } from "@bitwarden/common/billing/enums";
import { BillingResponse } from "@bitwarden/common/billing/models/response/billing.response";
import { OrganizationSubscriptionResponse } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { OrganizationId, ProviderId, UserId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
import {
  OrganizationSubscriptionPlan,
  OrganizationSubscriptionPurchase,
  SubscriberBillingClient,
  TaxClient,
} from "@bitwarden/web-vault/app/billing/clients";
import {
  EnterBillingAddressComponent,
  EnterPaymentMethodComponent,
  getBillingAddressFromForm,
} from "@bitwarden/web-vault/app/billing/payment/components";
import { tokenizablePaymentMethodToLegacyEnum } from "@bitwarden/web-vault/app/billing/payment/types";

import { OrganizationCreateModule } from "../../admin-console/organizations/create/organization-create.module";
import { BillingSharedModule, secretsManagerSubscribeFormFactory } from "../shared";

interface OnSuccessArgs {
  organizationId: string;
}

const Allowed2020PlansForLegacyProviders = [
  PlanType.TeamsMonthly2020,
  PlanType.TeamsAnnually2020,
  PlanType.EnterpriseAnnually2020,
  PlanType.EnterpriseMonthly2020,
];

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-organization-plans",
  templateUrl: "organization-plans.component.html",
  imports: [
    BillingSharedModule,
    OrganizationCreateModule,
    EnterPaymentMethodComponent,
    EnterBillingAddressComponent,
  ],
  providers: [SubscriberBillingClient, TaxClient],
})
export class OrganizationPlansComponent implements OnInit, OnDestroy {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild(EnterPaymentMethodComponent) enterPaymentMethodComponent!: EnterPaymentMethodComponent;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() organizationId?: string;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() showFree = true;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() showCancel = false;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() acceptingSponsorship = false;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() planSponsorshipType?: PlanSponsorshipType;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() currentPlan: PlanResponse;

  selectedFile: File;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input()
  get productTier(): ProductTierType {
    return this._productTier;
  }

  set productTier(product: ProductTierType) {
    this._productTier = product;
    this.formGroup?.controls?.productTier?.setValue(product);
  }

  private _productTier = ProductTierType.Free;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input()
  get plan(): PlanType {
    return this._plan;
  }

  set plan(plan: PlanType) {
    this._plan = plan;
    this.formGroup?.controls?.plan?.setValue(plan);
  }
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() enableSecretsManagerByDefault: boolean;

  private _plan = PlanType.Free;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() providerId?: string;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() preSelectedProductTier?: ProductTierType;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onSuccess = new EventEmitter<OnSuccessArgs>();
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onCanceled = new EventEmitter<void>();
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onTrialBillingSuccess = new EventEmitter();

  loading = true;
  selfHosted = false;
  productTypes = ProductTierType;
  formPromise: Promise<string>;
  singleOrgPolicyAppliesToActiveUser = false;
  isInTrialFlow = false;
  discount = 0;

  secretsManagerSubscription = secretsManagerSubscribeFormFactory(this.formBuilder);

  formGroup = this.formBuilder.group({
    name: [""],
    billingEmail: ["", [Validators.email]],
    businessOwned: [false],
    premiumAccessAddon: [false],
    additionalStorage: [0, [Validators.min(0), Validators.max(99)]],
    additionalSeats: [0, [Validators.min(0), Validators.max(100000)]],
    clientOwnerEmail: ["", [Validators.email]],
    plan: [this.plan],
    productTier: [this.productTier],
    secretsManager: this.secretsManagerSubscription,
  });

  billingFormGroup = this.formBuilder.group({
    paymentMethod: EnterPaymentMethodComponent.getFormGroup(),
    billingAddress: EnterBillingAddressComponent.getFormGroup(),
  });

  passwordManagerPlans: PlanResponse[];
  secretsManagerPlans: PlanResponse[];
  organization: Organization;
  sub: OrganizationSubscriptionResponse;
  billing: BillingResponse;
  provider: ProviderResponse;

  protected estimatedTax: number = 0;
  protected total: number = 0;

  private destroy$: Subject<void> = new Subject<void>();

  constructor(
    private apiService: ApiService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private keyService: KeyService,
    private encryptService: EncryptService,
    private router: Router,
    private syncService: SyncService,
    private policyService: PolicyService,
    private organizationService: OrganizationService,
    private messagingService: MessagingService,
    private formBuilder: FormBuilder,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private providerApiService: ProviderApiServiceAbstraction,
    private toastService: ToastService,
    private accountService: AccountService,
    private subscriberBillingClient: SubscriberBillingClient,
    private taxClient: TaxClient,
  ) {
    this.selfHosted = this.platformUtilsService.isSelfHost();
  }

  async ngOnInit() {
    if (this.organizationId) {
      const userId = await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((a) => a?.id)),
      );
      this.organization = await firstValueFrom(
        this.organizationService
          .organizations$(userId)
          .pipe(getOrganizationById(this.organizationId)),
      );
      this.billing = await this.organizationApiService.getBilling(this.organizationId);
      this.sub = await this.organizationApiService.getSubscription(this.organizationId);
      const billingAddress = await this.subscriberBillingClient.getBillingAddress({
        type: "organization",
        data: this.organization,
      });
      this.billingFormGroup.controls.billingAddress.patchValue({
        ...billingAddress,
        taxId: billingAddress?.taxId?.value,
      });
    }

    if (!this.selfHosted) {
      const plans = await this.apiService.getPlans();
      this.passwordManagerPlans = plans.data.filter((plan) => !!plan.PasswordManager);
      this.secretsManagerPlans = plans.data.filter((plan) => !!plan.SecretsManager);

      if (
        this.productTier === ProductTierType.Enterprise ||
        this.productTier === ProductTierType.Teams
      ) {
        this.formGroup.controls.businessOwned.setValue(true);
      }
    }

    if (this.currentPlan && this.currentPlan.productTier !== ProductTierType.Enterprise) {
      const upgradedPlan = this.passwordManagerPlans.find((plan) =>
        this.currentPlan.productTier === ProductTierType.Free
          ? plan.type === PlanType.FamiliesAnnually
          : plan.upgradeSortOrder == this.currentPlan.upgradeSortOrder + 1,
      );

      this.plan = upgradedPlan.type;
      this.productTier = upgradedPlan.productTier;
    }

    if (this.hasProvider) {
      this.formGroup.controls.businessOwned.setValue(true);
      this.formGroup.controls.clientOwnerEmail.addValidators(Validators.required);
      this.changedOwnedBusiness();
      this.provider = await this.providerApiService.getProvider(this.providerId);
      const providerDefaultPlan = this.passwordManagerPlans.find(
        (plan) => plan.type === PlanType.TeamsAnnually,
      );
      this.plan = providerDefaultPlan.type;
      this.productTier = providerDefaultPlan.productTier;
    }

    if (!this.createOrganization) {
      this.upgradeFlowPrefillForm();
    } else {
      this.formGroup.controls.name.addValidators([Validators.required, Validators.maxLength(50)]);
      this.formGroup.controls.billingEmail.addValidators(Validators.required);
    }

    this.accountService.activeAccount$
      .pipe(
        getUserId,
        switchMap((userId) =>
          this.policyService.policyAppliesToUser$(PolicyType.SingleOrg, userId),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe((policyAppliesToActiveUser) => {
        this.singleOrgPolicyAppliesToActiveUser = policyAppliesToActiveUser;
      });

    if (this.preSelectedProductTier != null && this.productTier < this.preSelectedProductTier) {
      this.productTier = this.preSelectedProductTier;
    }
    if (!this.selfHosted) {
      this.changedProduct();
    }

    this.loading = false;

    merge(
      this.formGroup.valueChanges,
      this.billingFormGroup.valueChanges,
      this.secretsManagerForm.valueChanges,
    )
      .pipe(
        debounceTime(1000),
        switchMap(async () => await this.refreshSalesTax()),
        takeUntil(this.destroy$),
      )
      .subscribe();

    if (this.enableSecretsManagerByDefault && this.selectedSecretsManagerPlan) {
      this.secretsManagerSubscription.patchValue({
        enabled: true,
        userSeats: 1,
        additionalServiceAccounts: 0,
      });
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get singleOrgPolicyBlock() {
    return this.singleOrgPolicyAppliesToActiveUser && !this.hasProvider;
  }

  get createOrganization() {
    return this.organizationId == null;
  }

  get upgradeRequiresPaymentMethod() {
    return (
      this.organization?.productTierType === ProductTierType.Free &&
      !this.showFree &&
      !this.billing?.paymentSource
    );
  }

  get selectedPlan() {
    return this.passwordManagerPlans.find(
      (plan) => plan.type === this.formGroup.controls.plan.value,
    );
  }

  get selectedSecretsManagerPlan() {
    return this.secretsManagerPlans.find(
      (plan) => plan.type === this.formGroup.controls.plan.value,
    );
  }

  get selectedPlanInterval() {
    return this.selectedPlan.isAnnual ? "year" : "month";
  }

  isProviderQualifiedFor2020Plan() {
    const targetDate = new Date("2023-11-06");

    if (!this.provider || !this.provider.creationDate) {
      return false;
    }

    const creationDate = new Date(this.provider.creationDate);
    return creationDate < targetDate;
  }

  get selectableProducts() {
    if (this.acceptingSponsorship) {
      const familyPlan = this.passwordManagerPlans.find(
        (plan) => plan.type === PlanType.FamiliesAnnually,
      );
      this.discount = familyPlan.PasswordManager.basePrice;
      return [familyPlan];
    }

    const businessOwnedIsChecked = this.formGroup.controls.businessOwned.value;

    const result = this.passwordManagerPlans.filter(
      (plan) =>
        plan.type !== PlanType.Custom &&
        (!businessOwnedIsChecked || plan.canBeUsedByBusiness) &&
        (this.showFree || plan.productTier !== ProductTierType.Free) &&
        (plan.isAnnual ||
          plan.productTier === ProductTierType.Free ||
          plan.productTier === ProductTierType.TeamsStarter) &&
        (!this.currentPlan || this.currentPlan.upgradeSortOrder < plan.upgradeSortOrder) &&
        (!this.hasProvider || plan.productTier !== ProductTierType.TeamsStarter) &&
        ((!this.isProviderQualifiedFor2020Plan() && this.planIsEnabled(plan)) ||
          (this.isProviderQualifiedFor2020Plan() &&
            Allowed2020PlansForLegacyProviders.includes(plan.type))),
    );

    result.sort((planA, planB) => planA.displaySortOrder - planB.displaySortOrder);

    return result;
  }

  get selectablePlans() {
    const selectedProductTierType = this.formGroup.controls.productTier.value;
    const result =
      this.passwordManagerPlans?.filter(
        (plan) =>
          plan.productTier === selectedProductTierType &&
          ((!this.isProviderQualifiedFor2020Plan() && this.planIsEnabled(plan)) ||
            (this.isProviderQualifiedFor2020Plan() &&
              Allowed2020PlansForLegacyProviders.includes(plan.type))),
      ) || [];

    result.sort((planA, planB) => planA.displaySortOrder - planB.displaySortOrder);
    return result;
  }

  get hasProvider() {
    return this.providerId != null;
  }

  additionalStoragePriceMonthly(selectedPlan: PlanResponse) {
    if (!selectedPlan.isAnnual) {
      return selectedPlan.PasswordManager.additionalStoragePricePerGb;
    }
    return selectedPlan.PasswordManager.additionalStoragePricePerGb / 12;
  }

  seatPriceMonthly(selectedPlan: PlanResponse) {
    if (!selectedPlan.isAnnual) {
      return selectedPlan.PasswordManager.seatPrice;
    }
    return selectedPlan.PasswordManager.seatPrice / 12;
  }

  additionalStorageTotal(plan: PlanResponse): number {
    if (!plan.PasswordManager.hasAdditionalStorageOption) {
      return 0;
    }

    return (
      plan.PasswordManager.additionalStoragePricePerGb *
      Math.abs(this.formGroup.controls.additionalStorage.value || 0)
    );
  }

  passwordManagerSeatTotal(plan: PlanResponse, seats: number): number {
    if (!plan.PasswordManager.hasAdditionalSeatsOption) {
      return 0;
    }

    return plan.PasswordManager.seatPrice * Math.abs(seats || 0);
  }

  secretsManagerSeatTotal(plan: PlanResponse, seats: number): number {
    if (!plan.SecretsManager.hasAdditionalSeatsOption) {
      return 0;
    }

    return plan.SecretsManager.seatPrice * Math.abs(seats || 0);
  }

  additionalServiceAccountTotal(plan: PlanResponse): number {
    if (!plan.SecretsManager.hasAdditionalServiceAccountOption) {
      return 0;
    }

    return (
      plan.SecretsManager.additionalPricePerServiceAccount *
      Math.abs(this.secretsManagerForm.value.additionalServiceAccounts || 0)
    );
  }

  get passwordManagerSubtotal() {
    const basePriceAfterDiscount = this.acceptingSponsorship
      ? Math.max(this.selectedPlan.PasswordManager.basePrice - this.discount, 0)
      : this.selectedPlan.PasswordManager.basePrice;
    let subTotal = basePriceAfterDiscount;
    if (
      this.selectedPlan.PasswordManager.hasAdditionalSeatsOption &&
      this.formGroup.controls.additionalSeats.value
    ) {
      subTotal += this.passwordManagerSeatTotal(
        this.selectedPlan,
        this.formGroup.value.additionalSeats,
      );
    }
    if (
      this.selectedPlan.PasswordManager.hasPremiumAccessOption &&
      this.formGroup.controls.premiumAccessAddon.value
    ) {
      subTotal += this.selectedPlan.PasswordManager.premiumAccessOptionPrice;
    }
    if (
      this.selectedPlan.PasswordManager.hasAdditionalStorageOption &&
      this.formGroup.controls.additionalStorage.value
    ) {
      subTotal += this.additionalStorageTotal(this.selectedPlan);
    }
    return subTotal;
  }

  get secretsManagerSubtotal() {
    const plan = this.selectedSecretsManagerPlan;
    const formValues = this.secretsManagerForm.value;

    if (!this.planOffersSecretsManager || !formValues.enabled) {
      return 0;
    }

    return (
      plan.SecretsManager.basePrice +
      this.secretsManagerSeatTotal(plan, formValues.userSeats) +
      this.additionalServiceAccountTotal(plan)
    );
  }

  get freeTrial() {
    return this.selectedPlan.trialPeriodDays != null;
  }

  get paymentDesc() {
    if (this.acceptingSponsorship) {
      return this.i18nService.t("paymentSponsored");
    } else if (this.freeTrial && this.createOrganization) {
      return this.i18nService.t("paymentChargedWithTrial");
    } else {
      return this.i18nService.t("paymentCharged", this.i18nService.t(this.selectedPlanInterval));
    }
  }

  get secretsManagerForm() {
    return this.formGroup.controls.secretsManager;
  }

  get planOffersSecretsManager() {
    return this.selectedSecretsManagerPlan != null;
  }

  get teamsStarterPlanIsAvailable() {
    return this.selectablePlans.some((plan) => plan.type === PlanType.TeamsStarter);
  }

  changedProduct() {
    const selectedPlan = this.selectablePlans[0];

    this.setPlanType(selectedPlan.type);
    this.handlePremiumAddonAccess(selectedPlan.PasswordManager.hasPremiumAccessOption);
    this.handleAdditionalStorage(selectedPlan.PasswordManager.hasAdditionalStorageOption);
    this.handleAdditionalSeats(selectedPlan.PasswordManager.hasAdditionalSeatsOption);
    this.handleSecretsManagerForm();
  }

  setPlanType(planType: PlanType) {
    this.formGroup.controls.plan.setValue(planType);
  }

  handlePremiumAddonAccess(hasPremiumAccessOption: boolean) {
    this.formGroup.controls.premiumAccessAddon.setValue(!hasPremiumAccessOption);
  }

  handleAdditionalStorage(selectedPlanHasAdditionalStorageOption: boolean) {
    if (!selectedPlanHasAdditionalStorageOption || !this.currentPlan) {
      this.formGroup.controls.additionalStorage.setValue(0);
      return;
    }

    if (this.organization?.maxStorageGb) {
      this.formGroup.controls.additionalStorage.setValue(
        this.organization.maxStorageGb - this.currentPlan.PasswordManager.baseStorageGb,
      );
    }
  }

  handleAdditionalSeats(selectedPlanHasAdditionalSeatsOption: boolean) {
    if (!selectedPlanHasAdditionalSeatsOption) {
      this.formGroup.controls.additionalSeats.setValue(0);
      return;
    }

    if (this.currentPlan && !this.currentPlan.PasswordManager.hasAdditionalSeatsOption) {
      this.formGroup.controls.additionalSeats.setValue(this.currentPlan.PasswordManager.baseSeats);
      return;
    }

    if (this.organization) {
      this.formGroup.controls.additionalSeats.setValue(this.organization.seats);
      return;
    }

    this.formGroup.controls.additionalSeats.setValue(1);
  }

  handleSecretsManagerForm() {
    if (this.planOffersSecretsManager) {
      this.secretsManagerForm.enable();
    }

    if (this.organization?.useSecretsManager) {
      this.secretsManagerForm.controls.enabled.setValue(true);
    }

    if (this.secretsManagerForm.controls.enabled.value) {
      this.secretsManagerForm.controls.userSeats.setValue(this.sub?.smSeats || 1);
      this.secretsManagerForm.controls.additionalServiceAccounts.setValue(
        this.sub?.smServiceAccounts - this.currentPlan.SecretsManager?.baseServiceAccount || 0,
      );
    }

    this.secretsManagerForm.updateValueAndValidity();
  }

  changedOwnedBusiness() {
    if (!this.formGroup.controls.businessOwned.value || this.selectedPlan.canBeUsedByBusiness) {
      return;
    }
    if (this.teamsStarterPlanIsAvailable) {
      this.formGroup.controls.productTier.setValue(ProductTierType.TeamsStarter);
      this.formGroup.controls.plan.setValue(PlanType.TeamsStarter);
    } else {
      this.formGroup.controls.productTier.setValue(ProductTierType.Teams);
      this.formGroup.controls.plan.setValue(PlanType.TeamsAnnually);
    }
    this.changedProduct();
  }

  protected cancel(): void {
    this.onCanceled.emit();
  }

  submit = async () => {
    this.formGroup.markAllAsTouched();
    if (this.formGroup.invalid) {
      return;
    }

    if (this.singleOrgPolicyBlock) {
      return;
    }
    const doSubmit = async (): Promise<string> => {
      let orgId: string;
      if (this.createOrganization) {
        const activeUserId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
        const orgKey = await this.keyService.makeOrgKey<OrgKey>(activeUserId);
        const key = orgKey[0].encryptedString;
        const collection = await this.encryptService.encryptString(
          this.i18nService.t("defaultCollection"),
          orgKey[1],
        );
        const collectionCt = collection.encryptedString;
        const orgKeys = await this.keyService.makeKeyPair(orgKey[1]);

        orgId = this.selfHosted
          ? await this.createSelfHosted(key, collectionCt, orgKeys)
          : await this.createCloudHosted(key, collectionCt, orgKeys, orgKey[1], activeUserId);

        this.toastService.showToast({
          variant: "success",
          title: this.i18nService.t("organizationCreated"),
          message: this.i18nService.t("organizationReadyToGo"),
        });
      } else {
        orgId = await this.updateOrganization();
        this.toastService.showToast({
          variant: "success",
          title: null,
          message: this.i18nService.t("organizationUpgraded"),
        });
      }

      await this.syncService.fullSync(true);

      if (!this.acceptingSponsorship && !this.isInTrialFlow) {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.router.navigate(["/organizations/" + orgId]);
      }

      if (this.isInTrialFlow) {
        this.onTrialBillingSuccess.emit({
          orgId: orgId,
          subLabelText: this.billingSubLabelText(),
        });
      }

      return orgId;
    };

    this.formPromise = doSubmit();
    const organizationId = await this.formPromise;
    this.onSuccess.emit({ organizationId: organizationId });
    // TODO: No one actually listening to this message?
    this.messagingService.send("organizationCreated", { organizationId });
  };

  protected get showTaxIdField(): boolean {
    switch (this.formGroup.controls.productTier.value) {
      case ProductTierType.Free:
      case ProductTierType.Families:
        return false;
      default:
        return true;
    }
  }

  private getPlanFromLegacyEnum(): OrganizationSubscriptionPlan {
    switch (this.formGroup.value.plan) {
      case PlanType.FamiliesAnnually:
        return { tier: "families", cadence: "annually" };
      case PlanType.TeamsMonthly:
        return { tier: "teams", cadence: "monthly" };
      case PlanType.TeamsAnnually:
        return { tier: "teams", cadence: "annually" };
      case PlanType.EnterpriseMonthly:
        return { tier: "enterprise", cadence: "monthly" };
      case PlanType.EnterpriseAnnually:
        return { tier: "enterprise", cadence: "annually" };
    }
  }

  private buildTaxPreviewRequest(
    additionalStorage: number,
    sponsored: boolean,
  ): OrganizationSubscriptionPurchase {
    const passwordManagerSeats = this.selectedPlan.PasswordManager.hasAdditionalSeatsOption
      ? this.formGroup.value.additionalSeats
      : 1;

    return {
      ...this.getPlanFromLegacyEnum(),
      passwordManager: {
        seats: passwordManagerSeats,
        additionalStorage,
        sponsored,
      },
      secretsManager: this.formGroup.value.secretsManager.enabled
        ? {
            seats: this.secretsManagerForm.value.userSeats,
            additionalServiceAccounts: this.secretsManagerForm.value.additionalServiceAccounts,
            standalone: false,
          }
        : undefined,
    };
  }

  private async refreshSalesTax(): Promise<void> {
    if (this.billingFormGroup.controls.billingAddress.invalid) {
      return;
    }

    const billingAddress = getBillingAddressFromForm(this.billingFormGroup.controls.billingAddress);

    // should still be taxed. We mark the plan as NOT sponsored when there is additional storage
    // so the server calculates tax, but we'll adjust the calculation to only tax the storage.
    const hasPaidStorage = (this.formGroup.value.additionalStorage || 0) > 0;
    const sponsoredForTaxPreview = this.acceptingSponsorship && !hasPaidStorage;

    if (this.acceptingSponsorship && hasPaidStorage) {
      // For sponsored plans with paid storage, calculate tax only on storage
      // by comparing tax on base+storage vs tax on base only
      //TODO: Move this logic to PreviewOrganizationTaxCommand - https://bitwarden.atlassian.net/browse/PM-27585
      const [baseTaxAmounts, fullTaxAmounts] = await Promise.all([
        this.taxClient.previewTaxForOrganizationSubscriptionPurchase(
          this.buildTaxPreviewRequest(0, false),
          billingAddress,
        ),
        this.taxClient.previewTaxForOrganizationSubscriptionPurchase(
          this.buildTaxPreviewRequest(this.formGroup.value.additionalStorage, false),
          billingAddress,
        ),
      ]);

      // Tax on storage = Tax on (base + storage) - Tax on (base only)
      this.estimatedTax = fullTaxAmounts.tax - baseTaxAmounts.tax;
    } else {
      const taxAmounts = await this.taxClient.previewTaxForOrganizationSubscriptionPurchase(
        this.buildTaxPreviewRequest(this.formGroup.value.additionalStorage, sponsoredForTaxPreview),
        billingAddress,
      );

      this.estimatedTax = taxAmounts.tax;
    }

    const subtotal =
      this.passwordManagerSubtotal +
      (this.planOffersSecretsManager && this.secretsManagerForm.value.enabled
        ? this.secretsManagerSubtotal
        : 0);
    this.total = subtotal + this.estimatedTax;
  }

  private async updateOrganization() {
    const request = new OrganizationUpgradeRequest();
    request.additionalSeats = this.formGroup.controls.additionalSeats.value;
    request.additionalStorageGb = this.formGroup.controls.additionalStorage.value;
    request.premiumAccessAddon =
      this.selectedPlan.PasswordManager.hasPremiumAccessOption &&
      this.formGroup.controls.premiumAccessAddon.value;
    request.planType = this.selectedPlan.type;
    request.billingAddressCountry = this.billingFormGroup.value.billingAddress.country;
    request.billingAddressPostalCode = this.billingFormGroup.value.billingAddress.postalCode;

    // Secrets Manager
    this.buildSecretsManagerRequest(request);

    if (this.upgradeRequiresPaymentMethod) {
      if (this.billingFormGroup.invalid) {
        return;
      }
      const paymentMethod = await this.enterPaymentMethodComponent.tokenize();
      await this.subscriberBillingClient.updatePaymentMethod(
        { type: "organization", data: this.organization },
        paymentMethod,
        {
          country: this.billingFormGroup.value.billingAddress.country,
          postalCode: this.billingFormGroup.value.billingAddress.postalCode,
        },
      );
    }

    // Backfill pub/priv key if necessary
    if (!this.organization.hasPublicAndPrivateKeys) {
      const userId = await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((a) => a?.id)),
      );
      const orgShareKey = await firstValueFrom(
        this.keyService
          .orgKeys$(userId)
          .pipe(map((orgKeys) => orgKeys?.[this.organizationId as OrganizationId] ?? null)),
      );
      const orgKeys = await this.keyService.makeKeyPair(orgShareKey);
      request.keys = new OrganizationKeysRequest(orgKeys[0], orgKeys[1].encryptedString);
    }

    await this.organizationApiService.upgrade(this.organizationId, request);
    return this.organizationId;
  }

  private async createCloudHosted(
    key: string,
    collectionCt: string,
    orgKeys: [string, EncString],
    orgKey: SymmetricCryptoKey,
    activeUserId: UserId,
  ): Promise<string> {
    const request = new OrganizationCreateRequest();
    request.key = key;
    request.collectionName = collectionCt;
    request.name = this.formGroup.controls.name.value;
    request.billingEmail = this.formGroup.controls.billingEmail.value;
    request.initiationPath = "New organization creation in-product";
    request.keys = new OrganizationKeysRequest(orgKeys[0], orgKeys[1].encryptedString);

    if (this.selectedPlan.type === PlanType.Free) {
      request.planType = PlanType.Free;
    } else {
      if (this.billingFormGroup.invalid) {
        return;
      }

      const paymentMethod = await this.enterPaymentMethodComponent.tokenize();

      const billingAddress = getBillingAddressFromForm(
        this.billingFormGroup.controls.billingAddress,
      );

      request.paymentToken = paymentMethod.token;
      request.paymentMethodType = tokenizablePaymentMethodToLegacyEnum(paymentMethod.type);
      request.additionalSeats = this.formGroup.controls.additionalSeats.value;
      request.additionalStorageGb = this.formGroup.controls.additionalStorage.value;
      request.premiumAccessAddon =
        this.selectedPlan.PasswordManager.hasPremiumAccessOption &&
        this.formGroup.controls.premiumAccessAddon.value;
      request.planType = this.selectedPlan.type;
      request.billingAddressPostalCode = billingAddress.postalCode;
      request.billingAddressCountry = billingAddress.country;
      request.taxIdNumber = billingAddress.taxId?.value;
      request.billingAddressLine1 = billingAddress.line1;
      request.billingAddressLine2 = billingAddress.line2;
      request.billingAddressCity = billingAddress.city;
      request.billingAddressState = billingAddress.state;
    }

    // Secrets Manager
    this.buildSecretsManagerRequest(request);

    if (this.hasProvider) {
      const providerRequest = new ProviderOrganizationCreateRequest(
        this.formGroup.controls.clientOwnerEmail.value,
        request,
      );

      const providerKey = await firstValueFrom(
        this.keyService
          .providerKeys$(activeUserId)
          .pipe(map((providerKeys) => providerKeys?.[this.providerId as ProviderId] ?? null)),
      );
      assertNonNullish(providerKey, "Provider key not found");

      providerRequest.organizationCreateRequest.key = (
        await this.encryptService.wrapSymmetricKey(orgKey, providerKey)
      ).encryptedString;
      const orgId = (
        await this.apiService.postProviderCreateOrganization(this.providerId, providerRequest)
      ).organizationId;

      return orgId;
    } else {
      return (await this.organizationApiService.create(request)).id;
    }
  }

  private async createSelfHosted(key: string, collectionCt: string, orgKeys: [string, EncString]) {
    if (!this.selectedFile) {
      throw new Error(this.i18nService.t("selectFile"));
    }

    const fd = new FormData();
    fd.append("license", this.selectedFile);
    fd.append("key", key);
    fd.append("collectionName", collectionCt);
    const response = await this.organizationApiService.createLicense(fd);
    const orgId = response.id;

    await this.apiService.refreshIdentityToken();

    // Org Keys live outside of the OrganizationLicense - add the keys to the org here
    const request = new OrganizationKeysRequest(orgKeys[0], orgKeys[1].encryptedString);
    await this.organizationApiService.updateKeys(orgId, request);

    return orgId;
  }

  private billingSubLabelText(): string {
    const selectedPlan = this.selectedPlan;
    const price =
      selectedPlan.PasswordManager.basePrice === 0
        ? selectedPlan.PasswordManager.seatPrice
        : selectedPlan.PasswordManager.basePrice;
    let text = "";

    if (selectedPlan.isAnnual) {
      text += `${this.i18nService.t("annual")} ($${price}/${this.i18nService.t("yr")})`;
    } else {
      text += `${this.i18nService.t("monthly")} ($${price}/${this.i18nService.t("monthAbbr")})`;
    }

    return text;
  }

  private buildSecretsManagerRequest(
    request: OrganizationCreateRequest | OrganizationUpgradeRequest,
  ): void {
    const formValues = this.secretsManagerForm.value;

    request.useSecretsManager = this.planOffersSecretsManager && formValues.enabled;

    if (!request.useSecretsManager) {
      return;
    }

    if (this.selectedSecretsManagerPlan.SecretsManager.hasAdditionalSeatsOption) {
      request.additionalSmSeats = formValues.userSeats;
    }

    if (this.selectedSecretsManagerPlan.SecretsManager.hasAdditionalServiceAccountOption) {
      request.additionalServiceAccounts = formValues.additionalServiceAccounts;
    }
  }

  private upgradeFlowPrefillForm() {
    if (this.acceptingSponsorship) {
      this.formGroup.controls.productTier.setValue(ProductTierType.Families);
      this.changedProduct();
      return;
    }

    if (this.currentPlan && this.currentPlan.productTier !== ProductTierType.Enterprise) {
      const upgradedPlan = this.passwordManagerPlans.find((plan) => {
        if (this.currentPlan.productTier === ProductTierType.Free) {
          return plan.type === PlanType.FamiliesAnnually;
        }

        if (
          this.currentPlan.productTier === ProductTierType.Families &&
          !this.teamsStarterPlanIsAvailable
        ) {
          return plan.type === PlanType.TeamsAnnually;
        }

        return plan.upgradeSortOrder === this.currentPlan.upgradeSortOrder + 1;
      });

      this.plan = upgradedPlan.type;
      this.productTier = upgradedPlan.productTier;
      this.changedProduct();
    }
  }

  private planIsEnabled(plan: PlanResponse) {
    return !plan.disabled && !plan.legacyYear;
  }

  protected async onLicenseFileUploaded(organizationId: string): Promise<void> {
    this.toastService.showToast({
      variant: "success",
      title: this.i18nService.t("organizationCreated"),
      message: this.i18nService.t("organizationReadyToGo"),
    });

    if (!this.acceptingSponsorship && !this.isInTrialFlow) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.router.navigate(["/organizations/" + organizationId]);
    }

    if (this.isInTrialFlow) {
      this.onTrialBillingSuccess.emit({
        orgId: organizationId,
        subLabelText: this.billingSubLabelText(),
      });
    }

    this.onSuccess.emit({ organizationId: organizationId });

    // TODO: No one actually listening to this message?
    this.messagingService.send("organizationCreated", { organizationId: organizationId });
  }
}
