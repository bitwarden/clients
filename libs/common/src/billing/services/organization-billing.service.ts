// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";
import { UserId } from "@bitwarden/user-core";

import { ApiService } from "../../abstractions/api.service";
import { OrganizationApiServiceAbstraction as OrganizationApiService } from "../../admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationCreateRequest } from "../../admin-console/models/request/organization-create.request";
import { OrganizationKeysRequest } from "../../admin-console/models/request/organization-keys.request";
import { OrganizationResponse } from "../../admin-console/models/response/organization.response";
import { EncryptService } from "../../key-management/crypto/abstractions/encrypt.service";
import { EncString } from "../../key-management/crypto/models/enc-string";
import { I18nService } from "../../platform/abstractions/i18n.service";
import { SyncService } from "../../platform/sync";
import { OrgKey } from "../../types/key";
import {
  BillingApiServiceAbstraction,
  OrganizationBillingServiceAbstraction,
  OrganizationInformation,
  PaymentInformation,
  PlanInformation,
  SubscriptionInformation,
} from "../abstractions";
import { PlanType } from "../enums";
import { OrganizationNoPaymentMethodCreateRequest } from "../models/request/organization-no-payment-method-create-request";
import { PaymentSourceResponse } from "../models/response/payment-source.response";

interface OrganizationKeys {
  encryptedKey: EncString;
  publicKey: string;
  encryptedPrivateKey: EncString;
  encryptedCollectionName: EncString;
}

export class OrganizationBillingService implements OrganizationBillingServiceAbstraction {
  constructor(
    private apiService: ApiService,
    private billingApiService: BillingApiServiceAbstraction,
    private keyService: KeyService,
    private encryptService: EncryptService,
    private i18nService: I18nService,
    private organizationApiService: OrganizationApiService,
    private syncService: SyncService,
  ) {}

  async getPaymentSource(organizationId: string): Promise<PaymentSourceResponse> {
    const paymentMethod = await this.billingApiService.getOrganizationPaymentMethod(organizationId);
    return paymentMethod?.paymentSource;
  }

  async purchaseSubscription(
    subscription: SubscriptionInformation,
    activeUserId: UserId,
  ): Promise<OrganizationResponse> {
    const request = new OrganizationCreateRequest();

    const organizationKeys = await this.makeOrganizationKeys(activeUserId);

    this.setOrganizationKeys(request, organizationKeys);

    this.setOrganizationInformation(request, subscription.organization);

    this.setPlanInformation(request, subscription.plan);

    this.setPaymentInformation(request, subscription.payment);

    const response = await this.organizationApiService.create(request);

    await this.apiService.refreshIdentityToken();

    await this.syncService.fullSync(true);

    return response;
  }

  async purchaseSubscriptionNoPaymentMethod(
    subscription: SubscriptionInformation,
    activeUserId: UserId,
  ): Promise<OrganizationResponse> {
    const request = new OrganizationNoPaymentMethodCreateRequest();

    const organizationKeys = await this.makeOrganizationKeys(activeUserId);

    this.setOrganizationKeys(request, organizationKeys);

    this.setOrganizationInformation(request, subscription.organization);

    this.setPlanInformation(request, subscription.plan);

    const response = await this.organizationApiService.createWithoutPayment(request);

    await this.apiService.refreshIdentityToken();

    await this.syncService.fullSync(true);

    return response;
  }

  async startFree(
    subscription: SubscriptionInformation,
    activeUserId: UserId,
  ): Promise<OrganizationResponse> {
    const request = new OrganizationCreateRequest();

    const organizationKeys = await this.makeOrganizationKeys(activeUserId);

    this.setOrganizationKeys(request, organizationKeys);

    this.setOrganizationInformation(request, subscription.organization);

    this.setPlanInformation(request, subscription.plan);

    const response = await this.organizationApiService.create(request);

    await this.apiService.refreshIdentityToken();

    await this.syncService.fullSync(true);

    return response;
  }

  private async makeOrganizationKeys(activeUserId: UserId): Promise<OrganizationKeys> {
    const [encryptedKey, key] = await this.keyService.makeOrgKey<OrgKey>(activeUserId);
    const [publicKey, encryptedPrivateKey] = await this.keyService.makeKeyPair(key);
    const encryptedCollectionName = await this.encryptService.encryptString(
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
    request: OrganizationCreateRequest | OrganizationNoPaymentMethodCreateRequest,
    information: OrganizationInformation,
  ): void {
    request.name = information.name;
    request.businessName = information.businessName;
    request.billingEmail = information.billingEmail;
    request.initiationPath = information.initiationPath;
  }

  private setOrganizationKeys(
    request: OrganizationCreateRequest | OrganizationNoPaymentMethodCreateRequest,
    keys: OrganizationKeys,
  ): void {
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
    request.skipTrial = information.skipTrial;

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
    request: OrganizationCreateRequest | OrganizationNoPaymentMethodCreateRequest,
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

  async restartSubscription(
    organizationId: string,
    subscription: SubscriptionInformation,
    activeUserId: UserId,
  ): Promise<void> {
    const request = new OrganizationCreateRequest();
    const organizationKeys = await this.makeOrganizationKeys(activeUserId);
    this.setOrganizationKeys(request, organizationKeys);
    this.setOrganizationInformation(request, subscription.organization);
    this.setPlanInformation(request, subscription.plan);
    this.setPaymentInformation(request, subscription.payment);
    await this.billingApiService.restartSubscription(organizationId, request);
  }
}
