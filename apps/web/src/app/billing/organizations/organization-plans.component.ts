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
import { Subject, takeUntil } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { OrganizationCreateRequest } from "@bitwarden/common/admin-console/models/request/organization-create.request";
import { OrganizationKeysRequest } from "@bitwarden/common/admin-console/models/request/organization-keys.request";
import { OrganizationUpgradeRequest } from "@bitwarden/common/admin-console/models/request/organization-upgrade.request";
import { ProviderOrganizationCreateRequest } from "@bitwarden/common/admin-console/models/request/provider/provider-organization-create.request";
import { ProviderResponse } from "@bitwarden/common/admin-console/models/response/provider/provider.response";
import { PaymentMethodType, PlanType } from "@bitwarden/common/billing/enums";
import { PaymentRequest } from "@bitwarden/common/billing/models/request/payment.request";
import { BillingResponse } from "@bitwarden/common/billing/models/response/billing.response";
import { OrganizationSubscriptionResponse } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { ProductType } from "@bitwarden/common/enums";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { OrgKey } from "@bitwarden/common/types/key";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";

import { OrganizationCreateModule } from "../../admin-console/organizations/create/organization-create.module";
import { BillingSharedModule, secretsManagerSubscribeFormFactory } from "../shared";
import { PaymentComponent } from "../shared/payment.component";
import { TaxInfoComponent } from "../shared/tax-info.component";

interface OnSuccessArgs {
  organizationId: string;
}

const AllowedLegacyPlanTypes = [
  PlanType.TeamsMonthly2023,
  PlanType.TeamsAnnually2023,
  PlanType.EnterpriseAnnually2023,
  PlanType.EnterpriseMonthly2023,
  PlanType.TeamsMonthly2020,
  PlanType.TeamsAnnually2020,
  PlanType.EnterpriseAnnually2020,
  PlanType.EnterpriseMonthly2020,
];

@Component({
  selector: "app-organization-plans",
  templateUrl: "organization-plans.component.html",
  standalone: true,
  imports: [BillingSharedModule, OrganizationCreateModule],
})
export class OrganizationPlansComponent implements OnInit, OnDestroy {
  @ViewChild(PaymentComponent) paymentComponent: PaymentComponent;
  @ViewChild(TaxInfoComponent) taxComponent: TaxInfoComponent;

  @Input() organizationId: string;
  @Input() showFree = true;
  @Input() showCancel = false;
  @Input() acceptingSponsorship = false;
  @Input() currentPlan: PlanResponse;

  @Input()
  get product(): ProductType {
    return this._product;
  }

  set product(product: ProductType) {
    this._product = product;
    this.formGroup?.controls?.product?.setValue(product);
  }

  private _product = ProductType.Free;

  @Input()
  get plan(): PlanType {
    return this._plan;
  }

  set plan(plan: PlanType) {
    this._plan = plan;
    this.formGroup?.controls?.plan?.setValue(plan);
  }

  private _plan = PlanType.Free;
  @Input() providerId?: string;
  @Output() onSuccess = new EventEmitter<OnSuccessArgs>();
  @Output() onCanceled = new EventEmitter<void>();
  @Output() onTrialBillingSuccess = new EventEmitter();

  loading = true;
  selfHosted = false;
  productTypes = ProductType;
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
    businessName: [""],
    plan: [this.plan],
    product: [this.product],
    secretsManager: this.secretsManagerSubscription,
  });

  passwordManagerPlans: PlanResponse[];
  secretsManagerPlans: PlanResponse[];
  organization: Organization;
  sub: OrganizationSubscriptionResponse;
  billing: BillingResponse;
  provider: ProviderResponse;

  private destroy$ = new Subject<void>();

  constructor(
    private apiService: ApiService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private cryptoService: CryptoService,
    private router: Router,
    private syncService: SyncService,
    private policyService: PolicyService,
    private organizationService: OrganizationService,
    private logService: LogService,
    private messagingService: MessagingService,
    private formBuilder: FormBuilder,
    private organizationApiService: OrganizationApiServiceAbstraction,
  ) {
    this.selfHosted = platformUtilsService.isSelfHost();
  }

  async ngOnInit() {
    if (this.organizationId) {
      this.organization = await this.organizationService.get(this.organizationId);
      this.billing = await this.organizationApiService.getBilling(this.organizationId);
      this.sub = await this.organizationApiService.getSubscription(this.organizationId);
    }

    if (!this.selfHosted) {
      const plans = await this.apiService.getPlans();
      this.passwordManagerPlans = plans.data.filter((plan) => !!plan.PasswordManager);
      this.secretsManagerPlans = plans.data.filter((plan) => !!plan.SecretsManager);

      if (this.product === ProductType.Enterprise || this.product === ProductType.Teams) {
        this.formGroup.controls.businessOwned.setValue(true);
      }
    }

    if (this.currentPlan && this.currentPlan.product !== ProductType.Enterprise) {
      const upgradedPlan = this.passwordManagerPlans.find((plan) =>
        this.currentPlan.product === ProductType.Free
          ? plan.type === PlanType.FamiliesAnnually
          : plan.upgradeSortOrder == this.currentPlan.upgradeSortOrder + 1,
      );

      this.plan = upgradedPlan.type;
      this.product = upgradedPlan.product;
    }

    if (this.hasProvider) {
      this.formGroup.controls.businessOwned.setValue(true);
      this.changedOwnedBusiness();
      this.provider = await this.apiService.getProvider(this.providerId);
      const providerDefaultPlan = this.passwordManagerPlans.find(
        (plan) => plan.type === PlanType.TeamsAnnually,
      );
      this.plan = providerDefaultPlan.type;
      this.product = providerDefaultPlan.product;
    }

    if (!this.createOrganization) {
      this.upgradeFlowPrefillForm();
    } else {
      this.formGroup.controls.name.addValidators([Validators.required, Validators.maxLength(50)]);
      this.formGroup.controls.billingEmail.addValidators(Validators.required);
    }

    this.policyService
      .policyAppliesToActiveUser$(PolicyType.SingleOrg)
      .pipe(takeUntil(this.destroy$))
      .subscribe((policyAppliesToActiveUser) => {
        this.singleOrgPolicyAppliesToActiveUser = policyAppliesToActiveUser;
      });

    if (!this.selfHosted) {
      this.changedProduct();
    }

    this.loading = false;
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
      this.organization?.planProductType === ProductType.Free &&
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
        (this.showFree || plan.product !== ProductType.Free) &&
        (plan.isAnnual ||
          plan.product === ProductType.Free ||
          plan.product === ProductType.TeamsStarter) &&
        (!this.currentPlan || this.currentPlan.upgradeSortOrder < plan.upgradeSortOrder) &&
        (!this.hasProvider || plan.product !== ProductType.TeamsStarter) &&
        ((!this.isProviderQualifiedFor2020Plan() && this.planIsEnabled(plan)) ||
          (this.isProviderQualifiedFor2020Plan() && AllowedLegacyPlanTypes.includes(plan.type))),
    );

    result.sort((planA, planB) => planA.displaySortOrder - planB.displaySortOrder);

    return result;
  }

  get selectablePlans() {
    const selectedProductType = this.formGroup.controls.product.value;
    const result =
      this.passwordManagerPlans?.filter(
        (plan) =>
          plan.product === selectedProductType &&
          ((!this.isProviderQualifiedFor2020Plan() && this.planIsEnabled(plan)) ||
            (this.isProviderQualifiedFor2020Plan() && AllowedLegacyPlanTypes.includes(plan.type))),
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
    let subTotal = this.selectedPlan.PasswordManager.basePrice;
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
      this.selectedPlan.PasswordManager.hasAdditionalStorageOption &&
      this.formGroup.controls.additionalStorage.value
    ) {
      subTotal += this.additionalStorageTotal(this.selectedPlan);
    }
    if (
      this.selectedPlan.PasswordManager.hasPremiumAccessOption &&
      this.formGroup.controls.premiumAccessAddon.value
    ) {
      subTotal += this.selectedPlan.PasswordManager.premiumAccessOptionPrice;
    }
    return subTotal - this.discount;
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

  get taxCharges() {
    return this.taxComponent != null && this.taxComponent.taxRate != null
      ? (this.taxComponent.taxRate / 100) *
          (this.passwordManagerSubtotal + this.secretsManagerSubtotal)
      : 0;
  }

  get total() {
    return this.passwordManagerSubtotal + this.secretsManagerSubtotal + this.taxCharges || 0;
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
    this.formGroup.controls.product.setValue(ProductType.TeamsStarter);
    this.formGroup.controls.plan.setValue(PlanType.TeamsStarter);
    this.changedProduct();
  }

  changedCountry() {
    this.paymentComponent.hideBank = this.taxComponent.taxInfo.country !== "US";
    // Bank Account payments are only available for US customers
    if (
      this.paymentComponent.hideBank &&
      this.paymentComponent.method === PaymentMethodType.BankAccount
    ) {
      this.paymentComponent.method = PaymentMethodType.Card;
      this.paymentComponent.changeMethod();
    }
  }

  cancel() {
    this.onCanceled.emit();
  }

  async submit() {
    if (this.singleOrgPolicyBlock) {
      return;
    }

    try {
      const doSubmit = async (): Promise<string> => {
        let orgId: string = null;
        if (this.createOrganization) {
          const orgKey = await this.cryptoService.makeOrgKey<OrgKey>();
          const key = orgKey[0].encryptedString;
          const collection = await this.cryptoService.encrypt(
            this.i18nService.t("defaultCollection"),
            orgKey[1],
          );
          const collectionCt = collection.encryptedString;
          const orgKeys = await this.cryptoService.makeKeyPair(orgKey[1]);

          if (this.selfHosted) {
            orgId = await this.createSelfHosted(key, collectionCt, orgKeys);
          } else {
            orgId = await this.createCloudHosted(key, collectionCt, orgKeys, orgKey[1]);
          }

          this.platformUtilsService.showToast(
            "success",
            this.i18nService.t("organizationCreated"),
            this.i18nService.t("organizationReadyToGo"),
          );
        } else {
          orgId = await this.updateOrganization(orgId);
          this.platformUtilsService.showToast(
            "success",
            null,
            this.i18nService.t("organizationUpgraded"),
          );
        }

        await this.apiService.refreshIdentityToken();
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
      this.messagingService.send("organizationCreated", organizationId);
    } catch (e) {
      this.logService.error(e);
    }
  }

  private async updateOrganization(orgId: string) {
    const request = new OrganizationUpgradeRequest();
    request.businessName = this.formGroup.controls.businessOwned.value
      ? this.formGroup.controls.businessName.value
      : null;
    request.additionalSeats = this.formGroup.controls.additionalSeats.value;
    request.additionalStorageGb = this.formGroup.controls.additionalStorage.value;
    request.premiumAccessAddon =
      this.selectedPlan.PasswordManager.hasPremiumAccessOption &&
      this.formGroup.controls.premiumAccessAddon.value;
    request.planType = this.selectedPlan.type;
    request.billingAddressCountry = this.taxComponent.taxInfo.country;
    request.billingAddressPostalCode = this.taxComponent.taxInfo.postalCode;

    // Secrets Manager
    this.buildSecretsManagerRequest(request);

    if (this.upgradeRequiresPaymentMethod) {
      const tokenResult = await this.paymentComponent.createPaymentToken();
      const paymentRequest = new PaymentRequest();
      paymentRequest.paymentToken = tokenResult[0];
      paymentRequest.paymentMethodType = tokenResult[1];
      paymentRequest.country = this.taxComponent.taxInfo.country;
      paymentRequest.postalCode = this.taxComponent.taxInfo.postalCode;
      await this.organizationApiService.updatePayment(this.organizationId, paymentRequest);
    }

    // Backfill pub/priv key if necessary
    if (!this.organization.hasPublicAndPrivateKeys) {
      const orgShareKey = await this.cryptoService.getOrgKey(this.organizationId);
      const orgKeys = await this.cryptoService.makeKeyPair(orgShareKey);
      request.keys = new OrganizationKeysRequest(orgKeys[0], orgKeys[1].encryptedString);
    }

    const result = await this.organizationApiService.upgrade(this.organizationId, request);
    if (!result.success && result.paymentIntentClientSecret != null) {
      await this.paymentComponent.handleStripeCardPayment(result.paymentIntentClientSecret, null);
    }
    return this.organizationId;
  }

  private async createCloudHosted(
    key: string,
    collectionCt: string,
    orgKeys: [string, EncString],
    orgKey: SymmetricCryptoKey,
  ) {
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
      const tokenResult = await this.paymentComponent.createPaymentToken();

      request.paymentToken = tokenResult[0];
      request.paymentMethodType = tokenResult[1];
      request.businessName = this.formGroup.controls.businessOwned.value
        ? this.formGroup.controls.businessName.value
        : null;
      request.additionalSeats = this.formGroup.controls.additionalSeats.value;
      request.additionalStorageGb = this.formGroup.controls.additionalStorage.value;
      request.premiumAccessAddon =
        this.selectedPlan.PasswordManager.hasPremiumAccessOption &&
        this.formGroup.controls.premiumAccessAddon.value;
      request.planType = this.selectedPlan.type;
      request.billingAddressPostalCode = this.taxComponent.taxInfo.postalCode;
      request.billingAddressCountry = this.taxComponent.taxInfo.country;
      if (this.taxComponent.taxInfo.includeTaxId) {
        request.taxIdNumber = this.taxComponent.taxInfo.taxId;
        request.billingAddressLine1 = this.taxComponent.taxInfo.line1;
        request.billingAddressLine2 = this.taxComponent.taxInfo.line2;
        request.billingAddressCity = this.taxComponent.taxInfo.city;
        request.billingAddressState = this.taxComponent.taxInfo.state;
      }
    }

    // Secrets Manager
    this.buildSecretsManagerRequest(request);

    if (this.hasProvider) {
      const providerRequest = new ProviderOrganizationCreateRequest(
        this.formGroup.controls.clientOwnerEmail.value,
        request,
      );
      const providerKey = await this.cryptoService.getProviderKey(this.providerId);
      providerRequest.organizationCreateRequest.key = (
        await this.cryptoService.encrypt(orgKey.key, providerKey)
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
    const fileEl = document.getElementById("file") as HTMLInputElement;
    const files = fileEl.files;
    if (files == null || files.length === 0) {
      throw new Error(this.i18nService.t("selectFile"));
    }

    const fd = new FormData();
    fd.append("license", files[0]);
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
      this.formGroup.controls.product.setValue(ProductType.Families);
      this.changedProduct();
      return;
    }

    if (this.currentPlan && this.currentPlan.product !== ProductType.Enterprise) {
      const upgradedPlan = this.passwordManagerPlans.find((plan) =>
        this.currentPlan.product === ProductType.Free
          ? plan.type === PlanType.FamiliesAnnually
          : plan.upgradeSortOrder == this.currentPlan.upgradeSortOrder + 1,
      );

      this.plan = upgradedPlan.type;
      this.product = upgradedPlan.product;
      this.changedProduct();
    }
  }

  private planIsEnabled(plan: PlanResponse) {
    return !plan.disabled && !plan.legacyYear;
  }
}
