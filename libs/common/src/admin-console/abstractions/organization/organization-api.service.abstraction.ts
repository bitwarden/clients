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

export abstract class OrganizationApiServiceAbstraction {
  abstract get(id: string): Promise<OrganizationResponse>;
  abstract getBilling(id: string): Promise<BillingResponse>;
  abstract getBillingHistory(id: string): Promise<BillingHistoryResponse>;
  abstract getSubscription(id: string): Promise<OrganizationSubscriptionResponse>;
  abstract getLicense(id: string, installationId: string): Promise<unknown>;
  abstract getAutoEnrollStatus(identifier: string): Promise<OrganizationAutoEnrollStatusResponse>;
  abstract create(request: OrganizationCreateRequest): Promise<OrganizationResponse>;
  abstract createWithoutPayment(
    request: OrganizationNoPaymentMethodCreateRequest,
  ): Promise<OrganizationResponse>;
  abstract createLicense(data: FormData): Promise<OrganizationResponse>;
  abstract save(id: string, request: OrganizationUpdateRequest): Promise<OrganizationResponse>;
  abstract upgrade(id: string, request: OrganizationUpgradeRequest): Promise<PaymentResponse>;
  abstract updatePasswordManagerSeats(
    id: string,
    request: OrganizationSubscriptionUpdateRequest,
  ): Promise<ProfileOrganizationResponse>;
  abstract updateSecretsManagerSubscription(
    id: string,
    request: OrganizationSmSubscriptionUpdateRequest,
  ): Promise<ProfileOrganizationResponse>;
  abstract updateSeats(id: string, request: SeatRequest): Promise<PaymentResponse>;
  abstract updateStorage(id: string, request: StorageRequest): Promise<PaymentResponse>;
  abstract reinstate(id: string): Promise<void>;
  abstract leave(id: string): Promise<void>;
  abstract delete(id: string, request: SecretVerificationRequest): Promise<void>;
  abstract deleteUsingToken(
    organizationId: string,
    request: OrganizationVerifyDeleteRecoverRequest,
  ): Promise<any>;
  abstract updateLicense(id: string, data: FormData): Promise<void>;
  abstract importDirectory(organizationId: string, request: ImportDirectoryRequest): Promise<void>;
  abstract getOrCreateApiKey(
    id: string,
    request: OrganizationApiKeyRequest,
  ): Promise<ApiKeyResponse>;
  abstract getApiKeyInformation(
    id: string,
    organizationApiKeyType?: OrganizationApiKeyType,
  ): Promise<ListResponse<OrganizationApiKeyInformationResponse>>;
  abstract rotateApiKey(id: string, request: OrganizationApiKeyRequest): Promise<ApiKeyResponse>;
  abstract getKeys(id: string): Promise<OrganizationKeysResponse>;
  abstract updateKeys(
    id: string,
    request: OrganizationKeysRequest,
  ): Promise<OrganizationKeysResponse>;
  abstract getSso(id: string): Promise<OrganizationSsoResponse>;
  abstract updateSso(id: string, request: OrganizationSsoRequest): Promise<OrganizationSsoResponse>;
  abstract selfHostedSyncLicense(id: string): Promise<void>;
  abstract subscribeToSecretsManager(
    id: string,
    request: SecretsManagerSubscribeRequest,
  ): Promise<ProfileOrganizationResponse>;
  abstract updateCollectionManagement(
    id: string,
    request: OrganizationCollectionManagementUpdateRequest,
  ): Promise<OrganizationResponse>;
}
