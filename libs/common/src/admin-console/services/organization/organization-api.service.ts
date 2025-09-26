// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore

import { ApiService } from "../../../abstractions/api.service";
import { OrganizationApiKeyRequest } from "../../../admin-console/models/request/organization-api-key.request";
import { OrganizationSsoRequest } from "../../../auth/models/request/organization-sso.request";
import { SecretVerificationRequest } from "../../../auth/models/request/secret-verification.request";
import { ApiKeyResponse } from "../../../auth/models/response/api-key.response";
import { OrganizationSsoResponse } from "../../../auth/models/response/organization-sso.response";
import { OrganizationNoPaymentMethodCreateRequest } from "../../../billing/models/request/organization-no-payment-method-create-request";
import { OrganizationSmSubscriptionUpdateRequest } from "../../../billing/models/request/organization-sm-subscription-update.request";
import { OrganizationSubscriptionUpdateRequest } from "../../../billing/models/request/organization-subscription-update.request";
import { SecretsManagerSubscribeRequest } from "../../../billing/models/request/sm-subscribe.request";
import { BillingHistoryResponse } from "../../../billing/models/response/billing-history.response";
import { BillingResponse } from "../../../billing/models/response/billing.response";
import { OrganizationSubscriptionResponse } from "../../../billing/models/response/organization-subscription.response";
import { PaymentResponse } from "../../../billing/models/response/payment.response";
import { ImportDirectoryRequest } from "../../../models/request/import-directory.request";
import { SeatRequest } from "../../../models/request/seat.request";
import { StorageRequest } from "../../../models/request/storage.request";
import { ListResponse } from "../../../models/response/list.response";
import { SyncService } from "../../../vault/abstractions/sync/sync.service.abstraction";
import { OrganizationApiServiceAbstraction } from "../../abstractions/organization/organization-api.service.abstraction";
import { OrganizationApiKeyType } from "../../enums";
import { OrganizationCollectionManagementUpdateRequest } from "../../models/request/organization-collection-management-update.request";
import { OrganizationCreateRequest } from "../../models/request/organization-create.request";
import { OrganizationKeysRequest } from "../../models/request/organization-keys.request";
import { OrganizationUpdateRequest } from "../../models/request/organization-update.request";
import { OrganizationUpgradeRequest } from "../../models/request/organization-upgrade.request";
import { OrganizationVerifyDeleteRecoverRequest } from "../../models/request/organization-verify-delete-recover.request";
import { OrganizationApiKeyInformationResponse } from "../../models/response/organization-api-key-information.response";
import { OrganizationAutoEnrollStatusResponse } from "../../models/response/organization-auto-enroll-status.response";
import { OrganizationKeysResponse } from "../../models/response/organization-keys.response";
import { OrganizationResponse } from "../../models/response/organization.response";
import { ProfileOrganizationResponse } from "../../models/response/profile-organization.response";

export class OrganizationApiService implements OrganizationApiServiceAbstraction {
  constructor(
    private apiService: ApiService,
    private syncService: SyncService,
  ) {}

  async get(id: string): Promise<OrganizationResponse> {
    const r = await this.apiService.send("GET", "/organizations/" + id, null, true, true);
    return new OrganizationResponse(r);
  }

  async getBilling(id: string): Promise<BillingResponse> {
    const r = await this.apiService.send(
      "GET",
      "/organizations/" + id + "/billing",
      null,
      true,
      true,
    );
    return new BillingResponse(r);
  }

  async getBillingHistory(id: string): Promise<BillingHistoryResponse> {
    const r = await this.apiService.send(
      "GET",
      "/organizations/" + id + "/billing/history",
      null,
      true,
      true,
    );
    return new BillingHistoryResponse(r);
  }

  async getSubscription(id: string): Promise<OrganizationSubscriptionResponse> {
    const r = await this.apiService.send(
      "GET",
      "/organizations/" + id + "/subscription",
      null,
      true,
      true,
    );
    return new OrganizationSubscriptionResponse(r);
  }

  async getLicense(id: string, installationId: string): Promise<unknown> {
    return this.apiService.send(
      "GET",
      "/organizations/" + id + "/license?installationId=" + installationId,
      null,
      true,
      true,
    );
  }

  async getAutoEnrollStatus(identifier: string): Promise<OrganizationAutoEnrollStatusResponse> {
    const r = await this.apiService.send(
      "GET",
      "/organizations/" + identifier + "/auto-enroll-status",
      null,
      true,
      true,
    );
    return new OrganizationAutoEnrollStatusResponse(r);
  }

  async create(request: OrganizationCreateRequest): Promise<OrganizationResponse> {
    const r = await this.apiService.send("POST", "/organizations", request, true, true);
    // Forcing a sync will notify organization service that they need to repull
    await this.syncService.fullSync(true);
    return new OrganizationResponse(r);
  }

  async createWithoutPayment(
    request: OrganizationNoPaymentMethodCreateRequest,
  ): Promise<OrganizationResponse> {
    const r = await this.apiService.send(
      "POST",
      "/organizations/create-without-payment",
      request,
      true,
      true,
    );
    // Forcing a sync will notify organization service that they need to repull
    await this.syncService.fullSync(true);
    return new OrganizationResponse(r);
  }

  async createLicense(data: FormData): Promise<OrganizationResponse> {
    const r = await this.apiService.send(
      "POST",
      "/organizations/licenses/self-hosted",
      data,
      true,
      true,
    );
    return new OrganizationResponse(r);
  }

  async save(id: string, request: OrganizationUpdateRequest): Promise<OrganizationResponse> {
    const r = await this.apiService.send("PUT", "/organizations/" + id, request, true, true);
    const data = new OrganizationResponse(r);
    await this.syncService.fullSync(true);
    return data;
  }

  async upgrade(id: string, request: OrganizationUpgradeRequest): Promise<PaymentResponse> {
    const r = await this.apiService.send(
      "POST",
      "/organizations/" + id + "/upgrade",
      request,
      true,
      true,
    );
    return new PaymentResponse(r);
  }

  async updatePasswordManagerSeats(
    id: string,
    request: OrganizationSubscriptionUpdateRequest,
  ): Promise<ProfileOrganizationResponse> {
    const r = await this.apiService.send(
      "POST",
      "/organizations/" + id + "/subscription",
      request,
      true,
      true,
    );
    return new ProfileOrganizationResponse(r);
  }

  async updateSecretsManagerSubscription(
    id: string,
    request: OrganizationSmSubscriptionUpdateRequest,
  ): Promise<ProfileOrganizationResponse> {
    const r = await this.apiService.send(
      "POST",
      "/organizations/" + id + "/sm-subscription",
      request,
      true,
      true,
    );
    return new ProfileOrganizationResponse(r);
  }

  async updateSeats(id: string, request: SeatRequest): Promise<PaymentResponse> {
    const r = await this.apiService.send(
      "POST",
      "/organizations/" + id + "/seat",
      request,
      true,
      true,
    );
    return new PaymentResponse(r);
  }

  async updateStorage(id: string, request: StorageRequest): Promise<PaymentResponse> {
    const r = await this.apiService.send(
      "POST",
      "/organizations/" + id + "/storage",
      request,
      true,
      true,
    );
    return new PaymentResponse(r);
  }

  async reinstate(id: string): Promise<void> {
    return this.apiService.send("POST", "/organizations/" + id + "/reinstate", null, true, false);
  }

  async leave(id: string): Promise<void> {
    await this.apiService.send("POST", "/organizations/" + id + "/leave", null, true, false);
    await this.syncService.fullSync(true);
  }

  async delete(id: string, request: SecretVerificationRequest): Promise<void> {
    await this.apiService.send("DELETE", "/organizations/" + id, request, true, false);
    await this.syncService.fullSync(true);
  }

  deleteUsingToken(
    organizationId: string,
    request: OrganizationVerifyDeleteRecoverRequest,
  ): Promise<any> {
    return this.apiService.send(
      "POST",
      "/organizations/" + organizationId + "/delete-recover-token",
      request,
      false,
      false,
    );
  }

  async updateLicense(id: string, data: FormData): Promise<void> {
    await this.apiService.send(
      "POST",
      "/organizations/licenses/self-hosted/" + id,
      data,
      true,
      false,
    );
  }

  async importDirectory(organizationId: string, request: ImportDirectoryRequest): Promise<void> {
    return this.apiService.send(
      "POST",
      "/organizations/" + organizationId + "/import",
      request,
      true,
      false,
    );
  }

  async getOrCreateApiKey(id: string, request: OrganizationApiKeyRequest): Promise<ApiKeyResponse> {
    const r = await this.apiService.send(
      "POST",
      "/organizations/" + id + "/api-key",
      request,
      true,
      true,
    );
    return new ApiKeyResponse(r);
  }

  async getApiKeyInformation(
    id: string,
    organizationApiKeyType: OrganizationApiKeyType = null,
  ): Promise<ListResponse<OrganizationApiKeyInformationResponse>> {
    const uri =
      organizationApiKeyType === null
        ? "/organizations/" + id + "/api-key-information"
        : "/organizations/" + id + "/api-key-information/" + organizationApiKeyType;
    const r = await this.apiService.send("GET", uri, null, true, true);
    return new ListResponse(r, OrganizationApiKeyInformationResponse);
  }

  async rotateApiKey(id: string, request: OrganizationApiKeyRequest): Promise<ApiKeyResponse> {
    const r = await this.apiService.send(
      "POST",
      "/organizations/" + id + "/rotate-api-key",
      request,
      true,
      true,
    );
    return new ApiKeyResponse(r);
  }

  async getKeys(id: string): Promise<OrganizationKeysResponse> {
    const r = await this.apiService.send("GET", "/organizations/" + id + "/keys", null, true, true);
    return new OrganizationKeysResponse(r);
  }

  async updateKeys(
    id: string,
    request: OrganizationKeysRequest,
  ): Promise<OrganizationKeysResponse> {
    const r = await this.apiService.send(
      "POST",
      "/organizations/" + id + "/keys",
      request,
      true,
      true,
    );
    // Not broadcasting anything because data on this response doesn't correspond to `Organization`
    return new OrganizationKeysResponse(r);
  }

  async getSso(id: string): Promise<OrganizationSsoResponse> {
    const r = await this.apiService.send("GET", "/organizations/" + id + "/sso", null, true, true);
    return new OrganizationSsoResponse(r);
  }

  async updateSso(id: string, request: OrganizationSsoRequest): Promise<OrganizationSsoResponse> {
    const r = await this.apiService.send(
      "POST",
      "/organizations/" + id + "/sso",
      request,
      true,
      true,
    );
    // Not broadcasting anything because data on this response doesn't correspond to `Organization`
    return new OrganizationSsoResponse(r);
  }

  async selfHostedSyncLicense(id: string) {
    await this.apiService.send(
      "POST",
      "/organizations/licenses/self-hosted/" + id + "/sync/",
      null,
      true,
      false,
    );
  }

  async subscribeToSecretsManager(
    id: string,
    request: SecretsManagerSubscribeRequest,
  ): Promise<ProfileOrganizationResponse> {
    const r = await this.apiService.send(
      "POST",
      "/organizations/" + id + "/subscribe-secrets-manager",
      request,
      true,
      true,
    );
    return new ProfileOrganizationResponse(r);
  }

  async updateCollectionManagement(
    id: string,
    request: OrganizationCollectionManagementUpdateRequest,
  ): Promise<OrganizationResponse> {
    const r = await this.apiService.send(
      "PUT",
      "/organizations/" + id + "/collection-management",
      request,
      true,
      true,
    );
    const data = new OrganizationResponse(r);
    await this.syncService.fullSync(true);
    return data;
  }
}
