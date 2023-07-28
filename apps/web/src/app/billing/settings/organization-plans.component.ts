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
import { OrganizationCreateRequest } from "@bitwarden/common/admin-console/models/request/organization-create.request";
import { OrganizationKeysRequest } from "@bitwarden/common/admin-console/models/request/organization-keys.request";
import { OrganizationUpgradeRequest } from "@bitwarden/common/admin-console/models/request/organization-upgrade.request";
import { ProviderOrganizationCreateRequest } from "@bitwarden/common/admin-console/models/request/provider/provider-organization-create.request";
import { BitwardenProductType, PaymentMethodType, PlanType } from "@bitwarden/common/billing/enums";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { ProductType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigServiceAbstraction } from "@bitwarden/common/platform/abstractions/config/config.service.abstraction";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";

import { secretsManagerSubscribeFormFactory } from "../organizations/secrets-manager/sm-subscribe.component";

import { PaymentComponent } from "./payment.component";
import { TaxInfoComponent } from "./tax-info.component";

interface OnSuccessArgs {
  organizationId: string;
}

@Component({
  selector: "app-organization-plans",
  templateUrl: "organization-plans.component.html",
})
export class OrganizationPlansComponent implements OnInit, OnDestroy {
  @ViewChild(PaymentComponent) paymentComponent: PaymentComponent;
  @ViewChild(TaxInfoComponent) taxComponent: TaxInfoComponent;

  @Input() organizationId: string;
  @Input() showFree = true;
  @Input() showCancel = false;
  @Input() acceptingSponsorship = false;

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
  showSecretsManagerSubscribe: boolean;

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
    private configService: ConfigServiceAbstraction
  ) {
    this.selfHosted = platformUtilsService.isSelfHost();
  }

  async ngOnInit() {
    if (!this.selfHosted) {
      const plans = await this.apiService.getPlans();
      this.passwordManagerPlans = plans.data.filter(
        (plan) => plan.bitwardenProduct === BitwardenProductType.PasswordManager
      );
      this.secretsManagerPlans = plans.data.filter(
        (plan) => plan.bitwardenProduct === BitwardenProductType.SecretsManager
      );

      if (this.product === ProductType.Enterprise || this.product === ProductType.Teams) {
        this.formGroup.controls.businessOwned.setValue(true);
      }
    }

    if (this.providerId) {
      this.formGroup.controls.businessOwned.setValue(true);
      this.changedOwnedBusiness();
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

    this.showSecretsManagerSubscribe = await this.configService.getFeatureFlagBool(
      FeatureFlag.SecretsManagerBilling,
      false
    );

    this.loading = false;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get singleOrgPolicyBlock() {
    return this.singleOrgPolicyAppliesToActiveUser && this.providerId == null;
  }

  get createOrganization() {
    return this.organizationId == null;
  }

  get selectedPlan() {
    return this.passwordManagerPlans.find(
      (plan) => plan.type === this.formGroup.controls.plan.value
    );
  }

  get selectedSecretsManagerPlan() {
    return this.secretsManagerPlans.find(
      (plan) => plan.type === this.formGroup.controls.plan.value
    );
  }

  get selectedPlanInterval() {
    return this.selectedPlan.isAnnual ? "year" : "month";
  }

  get selectableProducts() {
    let validPlans = this.passwordManagerPlans.filter((plan) => plan.type !== PlanType.Custom);

    if (this.formGroup.controls.businessOwned.value) {
      validPlans = validPlans.filter((plan) => plan.canBeUsedByBusiness);
    }

    if (!this.showFree) {
      validPlans = validPlans.filter((plan) => plan.product !== ProductType.Free);
    }

    validPlans = validPlans.filter(
      (plan) =>
        !plan.legacyYear &&
        !plan.disabled &&
        (plan.isAnnual || plan.product === this.productTypes.Free)
    );

    if (this.acceptingSponsorship) {
      const familyPlan = this.passwordManagerPlans.find(
        (plan) => plan.type === PlanType.FamiliesAnnually
      );
      this.discount = familyPlan.basePrice;
      validPlans = [familyPlan];
    }

    return validPlans;
  }

  get selectablePlans() {
    return this.passwordManagerPlans?.filter(
      (plan) =>
        !plan.legacyYear && !plan.disabled && plan.product === this.formGroup.controls.product.value
    );
  }

  additionalStoragePriceMonthly(selectedPlan: PlanResponse) {
    if (!selectedPlan.isAnnual) {
      return selectedPlan.additionalStoragePricePerGb;
    }
    return selectedPlan.additionalStoragePricePerGb / 12;
  }

  seatPriceMonthly(selectedPlan: PlanResponse) {
    if (!selectedPlan.isAnnual) {
      return selectedPlan.seatPrice;
    }
    return selectedPlan.seatPrice / 12;
  }

  additionalStorageTotal(plan: PlanResponse): number {
    if (!plan.hasAdditionalStorageOption) {
      return 0;
    }

    return (
      plan.additionalStoragePricePerGb *
      Math.abs(this.formGroup.controls.additionalStorage.value || 0)
    );
  }

  seatTotal(plan: PlanResponse, seats: number): number {
    if (!plan.hasAdditionalSeatsOption) {
      return 0;
    }

    return plan.seatPrice * Math.abs(seats || 0);
  }

  additionalServiceAccountTotal(plan: PlanResponse): number {
    if (!plan.hasAdditionalServiceAccountOption) {
      return 0;
    }

    return (
      plan.additionalPricePerServiceAccount *
      Math.abs(this.secretsManagerForm.value.additionalServiceAccounts || 0)
    );
  }

  get passwordManagerSubtotal() {
    let subTotal = this.selectedPlan.basePrice;
    if (
      this.selectedPlan.hasAdditionalSeatsOption &&
      this.formGroup.controls.additionalSeats.value
    ) {
      subTotal += this.seatTotal(this.selectedPlan, this.formGroup.value.additionalSeats);
    }
    if (
      this.selectedPlan.hasAdditionalStorageOption &&
      this.formGroup.controls.additionalStorage.value
    ) {
      subTotal += this.additionalStorageTotal(this.selectedPlan);
    }
    if (
      this.selectedPlan.hasPremiumAccessOption &&
      this.formGroup.controls.premiumAccessAddon.value
    ) {
      subTotal += this.selectedPlan.premiumAccessOptionPrice;
    }
    return subTotal - this.discount;
  }

  get secretsManagerSubtotal() {
    const plan = this.selectedSecretsManagerPlan;
    const formValues = this.secretsManagerForm.value;

    if (!this.planOffersSecretsManager || !formValues.enabled) {
      return 0;
    }

    let subTotal = plan.basePrice;
    if (plan.hasAdditionalSeatsOption && formValues.userSeats) {
      subTotal += this.seatTotal(plan, formValues.userSeats);
    }

    if (plan.hasAdditionalStorageOption && formValues.additionalServiceAccounts) {
      subTotal += this.additionalServiceAccountTotal(this.selectedPlan);
    }

    return subTotal;
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
    this.formGroup.controls.plan.setValue(this.selectablePlans[0].type);
    if (!this.selectedPlan.hasPremiumAccessOption) {
      this.formGroup.controls.premiumAccessAddon.setValue(false);
    }
    if (!this.selectedPlan.hasAdditionalStorageOption) {
      this.formGroup.controls.additionalStorage.setValue(0);
    }
    if (!this.selectedPlan.hasAdditionalSeatsOption) {
      this.formGroup.controls.additionalSeats.setValue(0);
    } else if (
      !this.formGroup.controls.additionalSeats.value &&
      !this.selectedPlan.baseSeats &&
      this.selectedPlan.hasAdditionalSeatsOption
    ) {
      this.formGroup.controls.additionalSeats.setValue(1);
    }

    if (this.planOffersSecretsManager) {
      this.secretsManagerForm.enable();
    } else {
      this.secretsManagerForm.disable();
    }

    this.secretsManagerForm.updateValueAndValidity();
  }

  changedOwnedBusiness() {
    if (!this.formGroup.controls.businessOwned.value || this.selectedPlan.canBeUsedByBusiness) {
      return;
    }
    this.formGroup.controls.product.setValue(ProductType.Teams);
    this.formGroup.controls.plan.setValue(PlanType.TeamsAnnually);
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
          const shareKey = await this.cryptoService.makeShareKey();
          const key = shareKey[0].encryptedString;
          const collection = await this.cryptoService.encrypt(
            this.i18nService.t("defaultCollection"),
            shareKey[1]
          );
          const collectionCt = collection.encryptedString;
          const orgKeys = await this.cryptoService.makeKeyPair(shareKey[1]);

          if (this.selfHosted) {
            orgId = await this.createSelfHosted(key, collectionCt, orgKeys);
          } else {
            orgId = await this.createCloudHosted(key, collectionCt, orgKeys, shareKey[1]);
          }

          this.platformUtilsService.showToast(
            "success",
            this.i18nService.t("organizationCreated"),
            this.i18nService.t("organizationReadyToGo")
          );
        } else {
          orgId = await this.updateOrganization(orgId);
          this.platformUtilsService.showToast(
            "success",
            null,
            this.i18nService.t("organizationUpgraded")
          );
        }

        await this.apiService.refreshIdentityToken();
        await this.syncService.fullSync(true);

        if (!this.acceptingSponsorship && !this.isInTrialFlow) {
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
      this.selectedPlan.hasPremiumAccessOption && this.formGroup.controls.premiumAccessAddon.value;
    request.planType = this.selectedPlan.type;
    request.billingAddressCountry = this.taxComponent.taxInfo.country;
    request.billingAddressPostalCode = this.taxComponent.taxInfo.postalCode;

    // Secrets Manager
    this.buildSecretsManagerRequest(request);

    // Retrieve org info to backfill pub/priv key if necessary
    const org = await this.organizationService.get(this.organizationId);
    if (!org.hasPublicAndPrivateKeys) {
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
    orgKey: SymmetricCryptoKey
  ) {
    const request = new OrganizationCreateRequest();
    request.key = key;
    request.collectionName = collectionCt;
    request.name = this.formGroup.controls.name.value;
    request.billingEmail = this.formGroup.controls.billingEmail.value;
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
        this.selectedPlan.hasPremiumAccessOption &&
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

    if (this.providerId) {
      const providerRequest = new ProviderOrganizationCreateRequest(
        this.formGroup.controls.clientOwnerEmail.value,
        request
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
    const price = selectedPlan.basePrice === 0 ? selectedPlan.seatPrice : selectedPlan.basePrice;
    let text = "";

    if (selectedPlan.isAnnual) {
      text += `${this.i18nService.t("annual")} ($${price}/${this.i18nService.t("yr")})`;
    } else {
      text += `${this.i18nService.t("monthly")} ($${price}/${this.i18nService.t("monthAbbr")})`;
    }

    return text;
  }

  private buildSecretsManagerRequest(
    request: OrganizationCreateRequest | OrganizationUpgradeRequest
  ): void {
    const formValues = this.secretsManagerForm.value;

    request.useSecretsManager = this.planOffersSecretsManager && formValues.enabled;

    if (!request.useSecretsManager) {
      return;
    }

    if (this.selectedSecretsManagerPlan.hasAdditionalSeatsOption) {
      request.additionalSmSeats = formValues.userSeats;
    }

    if (this.selectedSecretsManagerPlan.hasAdditionalServiceAccountOption) {
      request.additionalServiceAccounts = formValues.additionalServiceAccounts;
    }
  }

  private upgradeFlowPrefillForm() {
    if (this.acceptingSponsorship) {
      this.formGroup.controls.product.setValue(ProductType.Families);
      this.changedProduct();
      return;
    }

    // If they already have SM enabled, bump them up to Teams and enable SM to maintain this access
    const organization = this.organizationService.get(this.organizationId);
    if (organization.useSecretsManager) {
      this.formGroup.controls.product.setValue(ProductType.Teams);
      this.secretsManagerForm.controls.enabled.setValue(true);
      this.changedProduct();
    }
  }
}
