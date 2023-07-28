import { OrganizationApiKeyRequest } from "../../../admin-console/models/request/organization-api-key.request";
import { OrganizationSsoRequest } from "../../../auth/models/request/organization-sso.request";
import { SecretVerificationRequest } from "../../../auth/models/request/secret-verification.request";
import { ApiKeyResponse } from "../../../auth/models/response/api-key.response";
import { OrganizationSsoResponse } from "../../../auth/models/response/organization-sso.response";
import { OrganizationSmSubscriptionUpdateRequest } from "../../../billing/models/request/organization-sm-subscription-update.request";
import { OrganizationSubscriptionUpdateRequest } from "../../../billing/models/request/organization-subscription-update.request";
import { OrganizationTaxInfoUpdateRequest } from "../../../billing/models/request/organization-tax-info-update.request";
import { PaymentRequest } from "../../../billing/models/request/payment.request";
import { SecretsManagerSubscribeRequest } from "../../../billing/models/request/sm-subscribe.request";
import { BillingResponse } from "../../../billing/models/response/billing.response";
import { OrganizationSubscriptionResponse } from "../../../billing/models/response/organization-subscription.response";
import { PaymentResponse } from "../../../billing/models/response/payment.response";
import { TaxInfoResponse } from "../../../billing/models/response/tax-info.response";
import { ImportDirectoryRequest } from "../../../models/request/import-directory.request";
import { SeatRequest } from "../../../models/request/seat.request";
import { StorageRequest } from "../../../models/request/storage.request";
import { VerifyBankRequest } from "../../../models/request/verify-bank.request";
import { ListResponse } from "../../../models/response/list.response";
import { OrganizationApiKeyType } from "../../enums";
import { OrganizationCreateRequest } from "../../models/request/organization-create.request";
import { OrganizationKeysRequest } from "../../models/request/organization-keys.request";
import { OrganizationUpdateRequest } from "../../models/request/organization-update.request";
import { OrganizationUpgradeRequest } from "../../models/request/organization-upgrade.request";
import { OrganizationApiKeyInformationResponse } from "../../models/response/organization-api-key-information.response";
import { OrganizationAutoEnrollStatusResponse } from "../../models/response/organization-auto-enroll-status.response";
import { OrganizationKeysResponse } from "../../models/response/organization-keys.response";
import { OrganizationResponse } from "../../models/response/organization.response";

export class OrganizationApiServiceAbstraction {
  get: (id: string) => Promise<OrganizationResponse>;
  getBilling: (id: string) => Promise<BillingResponse>;
  getSubscription: (id: string) => Promise<OrganizationSubscriptionResponse>;
  getLicense: (id: string, installationId: string) => Promise<unknown>;
  getAutoEnrollStatus: (identifier: string) => Promise<OrganizationAutoEnrollStatusResponse>;
  create: (request: OrganizationCreateRequest) => Promise<OrganizationResponse>;
  createLicense: (data: FormData) => Promise<OrganizationResponse>;
  save: (id: string, request: OrganizationUpdateRequest) => Promise<OrganizationResponse>;
  updatePayment: (id: string, request: PaymentRequest) => Promise<void>;
  upgrade: (id: string, request: OrganizationUpgradeRequest) => Promise<PaymentResponse>;
  updatePasswordManagerSeats: (
    id: string,
    request: OrganizationSubscriptionUpdateRequest
  ) => Promise<void>;
  updateSecretsManagerSubscription: (
    id: string,
    request: OrganizationSmSubscriptionUpdateRequest
  ) => Promise<void>;
  updateSeats: (id: string, request: SeatRequest) => Promise<PaymentResponse>;
  updateStorage: (id: string, request: StorageRequest) => Promise<PaymentResponse>;
  verifyBank: (id: string, request: VerifyBankRequest) => Promise<void>;
  cancel: (id: string) => Promise<void>;
  reinstate: (id: string) => Promise<void>;
  leave: (id: string) => Promise<void>;
  delete: (id: string, request: SecretVerificationRequest) => Promise<void>;
  updateLicense: (id: string, data: FormData) => Promise<void>;
  importDirectory: (organizationId: string, request: ImportDirectoryRequest) => Promise<void>;
  getOrCreateApiKey: (id: string, request: OrganizationApiKeyRequest) => Promise<ApiKeyResponse>;
  getApiKeyInformation: (
    id: string,
    organizationApiKeyType?: OrganizationApiKeyType
  ) => Promise<ListResponse<OrganizationApiKeyInformationResponse>>;
  rotateApiKey: (id: string, request: OrganizationApiKeyRequest) => Promise<ApiKeyResponse>;
  getTaxInfo: (id: string) => Promise<TaxInfoResponse>;
  updateTaxInfo: (id: string, request: OrganizationTaxInfoUpdateRequest) => Promise<void>;
  getKeys: (id: string) => Promise<OrganizationKeysResponse>;
  updateKeys: (id: string, request: OrganizationKeysRequest) => Promise<OrganizationKeysResponse>;
  getSso: (id: string) => Promise<OrganizationSsoResponse>;
  updateSso: (id: string, request: OrganizationSsoRequest) => Promise<OrganizationSsoResponse>;
  selfHostedSyncLicense: (id: string) => Promise<void>;
  subscribeToSecretsManager: (id: string, request: SecretsManagerSubscribeRequest) => Promise<void>;
}
