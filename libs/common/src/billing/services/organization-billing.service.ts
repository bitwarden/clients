import { OrganizationApiServiceAbstraction as OrganizationApiService } from "../../admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationCreateRequest } from "../../admin-console/models/request/organization-create.request";
import { OrganizationKeysRequest } from "../../admin-console/models/request/organization-keys.request";
import { OrganizationResponse } from "../../admin-console/models/response/organization.response";
import { CryptoService } from "../../platform/abstractions/crypto.service";
import { EncryptService } from "../../platform/abstractions/encrypt.service";
import { I18nService } from "../../platform/abstractions/i18n.service";
import { EncString } from "../../platform/models/domain/enc-string";
import { OrgKey } from "../../types/key";
import {
  OrganizationBillingServiceAbstraction,
  OrganizationInformation,
  PaymentInformation,
  PlanInformation,
  SubscriptionInformation,
} from "../abstractions/organization-billing.service";
import { PlanType } from "../enums";

interface OrganizationKeys {
  encryptedKey: EncString;
  publicKey: string;
  encryptedPrivateKey: EncString;
  encryptedCollectionName: EncString;
}

export class OrganizationBillingService implements OrganizationBillingServiceAbstraction {
  constructor(
    private cryptoService: CryptoService,
    private encryptService: EncryptService,
    private i18nService: I18nService,
    private organizationApiService: OrganizationApiService,
  ) {}

  async purchaseSubscription(subscription: SubscriptionInformation): Promise<OrganizationResponse> {
    const request = new OrganizationCreateRequest();

    const organizationKeys = await this.makeOrganizationKeys();

    this.setOrganizationKeys(request, organizationKeys);

    this.setOrganizationInformation(request, subscription.organization);

    this.setPlanInformation(request, subscription.plan);

    this.setPaymentInformation(request, subscription.payment);

    return await this.organizationApiService.create(request);
  }

  async startFree(subscription: SubscriptionInformation): Promise<OrganizationResponse> {
    const request = new OrganizationCreateRequest();

    const organizationKeys = await this.makeOrganizationKeys();

    this.setOrganizationKeys(request, organizationKeys);

    this.setOrganizationInformation(request, subscription.organization);

    this.setPlanInformation(request, subscription.plan);

    return await this.organizationApiService.create(request);
  }

  private async makeOrganizationKeys(): Promise<OrganizationKeys> {
    const [encryptedKey, key] = await this.cryptoService.makeOrgKey<OrgKey>();
    const [publicKey, encryptedPrivateKey] = await this.cryptoService.makeKeyPair(key);
    const encryptedCollectionName = await this.encryptService.encrypt(
      this.i18nService.t("defaultCollection"),
      key,
    );
    return {
      encryptedKey,
      publicKey,
      encryptedPrivateKey,
      encryptedCollectionName,
    };
  }

  private prohibitsAdditionalSeats(planType: PlanType) {
    switch (planType) {
      case PlanType.Free:
      case PlanType.FamiliesAnnually:
      case PlanType.FamiliesAnnually2019:
      case PlanType.TeamsStarter2023:
      case PlanType.TeamsStarter:
        return true;
      default:
        return false;
    }
  }

  private setOrganizationInformation(
    request: OrganizationCreateRequest,
    information: OrganizationInformation,
  ): void {
    request.name = information.name;
    request.businessName = information.businessName;
    request.billingEmail = information.billingEmail;
    request.initiationPath = information.initiationPath;
  }

  private setOrganizationKeys(request: OrganizationCreateRequest, keys: OrganizationKeys): void {
    request.key = keys.encryptedKey.encryptedString;
    request.keys = new OrganizationKeysRequest(
      keys.publicKey,
      keys.encryptedPrivateKey.encryptedString,
    );
    request.collectionName = keys.encryptedCollectionName.encryptedString;
  }

  private setPaymentInformation(
    request: OrganizationCreateRequest,
    information: PaymentInformation,
  ) {
    const [paymentToken, paymentMethodType] = information.paymentMethod;
    request.paymentToken = paymentToken;
    request.paymentMethodType = paymentMethodType;

    const billingInformation = information.billing;
    request.billingAddressPostalCode = billingInformation.postalCode;
    request.billingAddressCountry = billingInformation.country;

    if (billingInformation.taxId) {
      request.taxIdNumber = billingInformation.taxId;
      request.billingAddressLine1 = billingInformation.addressLine1;
      request.billingAddressLine2 = billingInformation.addressLine2;
      request.billingAddressCity = billingInformation.city;
      request.billingAddressState = billingInformation.state;
    }
  }

  private setPlanInformation(
    request: OrganizationCreateRequest,
    information: PlanInformation,
  ): void {
    request.planType = information.type;

    if (this.prohibitsAdditionalSeats(request.planType)) {
      request.useSecretsManager = information.subscribeToSecretsManager;
      request.isFromSecretsManagerTrial = information.isFromSecretsManagerTrial;
      return;
    }

    request.additionalSeats = information.passwordManagerSeats;

    if (information.subscribeToSecretsManager) {
      request.useSecretsManager = true;
      request.isFromSecretsManagerTrial = information.isFromSecretsManagerTrial;
      request.additionalSmSeats = information.secretsManagerSeats;
      request.additionalServiceAccounts = information.secretsManagerServiceAccounts;
    }

    if (information.storage) {
      request.additionalStorageGb = information.storage;
    }
  }
}
