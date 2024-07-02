import { OrganizationConnectionType } from "../admin-console/enums";
import { OrganizationSponsorshipCreateRequest } from "../admin-console/models/request/organization/organization-sponsorship-create.request";
import { OrganizationSponsorshipRedeemRequest } from "../admin-console/models/request/organization/organization-sponsorship-redeem.request";
import { OrganizationConnectionRequest } from "../admin-console/models/request/organization-connection.request";
import { ProviderAddOrganizationRequest } from "../admin-console/models/request/provider/provider-add-organization.request";
import { ProviderOrganizationCreateRequest } from "../admin-console/models/request/provider/provider-organization-create.request";
import { ProviderUserAcceptRequest } from "../admin-console/models/request/provider/provider-user-accept.request";
import { ProviderUserBulkConfirmRequest } from "../admin-console/models/request/provider/provider-user-bulk-confirm.request";
import { ProviderUserBulkRequest } from "../admin-console/models/request/provider/provider-user-bulk.request";
import { ProviderUserConfirmRequest } from "../admin-console/models/request/provider/provider-user-confirm.request";
import { ProviderUserInviteRequest } from "../admin-console/models/request/provider/provider-user-invite.request";
import { ProviderUserUpdateRequest } from "../admin-console/models/request/provider/provider-user-update.request";
import { SelectionReadOnlyRequest } from "../admin-console/models/request/selection-read-only.request";
import {
  OrganizationConnectionConfigApis,
  OrganizationConnectionResponse,
} from "../admin-console/models/response/organization-connection.response";
import { OrganizationExportResponse } from "../admin-console/models/response/organization-export.response";
import { OrganizationSponsorshipSyncStatusResponse } from "../admin-console/models/response/organization-sponsorship-sync-status.response";
import {
  ProviderOrganizationOrganizationDetailsResponse,
  ProviderOrganizationResponse,
} from "../admin-console/models/response/provider/provider-organization.response";
import { ProviderUserBulkPublicKeyResponse } from "../admin-console/models/response/provider/provider-user-bulk-public-key.response";
import { ProviderUserBulkResponse } from "../admin-console/models/response/provider/provider-user-bulk.response";
import {
  ProviderUserResponse,
  ProviderUserUserDetailsResponse,
} from "../admin-console/models/response/provider/provider-user.response";
import { SelectionReadOnlyResponse } from "../admin-console/models/response/selection-read-only.response";
import { CreateAuthRequest } from "../auth/models/request/create-auth.request";
import { DeviceVerificationRequest } from "../auth/models/request/device-verification.request";
import { EmailTokenRequest } from "../auth/models/request/email-token.request";
import { EmailRequest } from "../auth/models/request/email.request";
import { PasswordTokenRequest } from "../auth/models/request/identity-token/password-token.request";
import { SsoTokenRequest } from "../auth/models/request/identity-token/sso-token.request";
import { UserApiTokenRequest } from "../auth/models/request/identity-token/user-api-token.request";
import { WebAuthnLoginTokenRequest } from "../auth/models/request/identity-token/webauthn-login-token.request";
import { KeyConnectorUserKeyRequest } from "../auth/models/request/key-connector-user-key.request";
import { PasswordHintRequest } from "../auth/models/request/password-hint.request";
import { PasswordRequest } from "../auth/models/request/password.request";
import { PasswordlessAuthRequest } from "../auth/models/request/passwordless-auth.request";
import { SecretVerificationRequest } from "../auth/models/request/secret-verification.request";
import { SetKeyConnectorKeyRequest } from "../auth/models/request/set-key-connector-key.request";
import { SetPasswordRequest } from "../auth/models/request/set-password.request";
import { TwoFactorEmailRequest } from "../auth/models/request/two-factor-email.request";
import { TwoFactorProviderRequest } from "../auth/models/request/two-factor-provider.request";
import { TwoFactorRecoveryRequest } from "../auth/models/request/two-factor-recovery.request";
import { UpdateProfileRequest } from "../auth/models/request/update-profile.request";
import { UpdateTempPasswordRequest } from "../auth/models/request/update-temp-password.request";
import { UpdateTwoFactorAuthenticatorRequest } from "../auth/models/request/update-two-factor-authenticator.request";
import { UpdateTwoFactorDuoRequest } from "../auth/models/request/update-two-factor-duo.request";
import { UpdateTwoFactorEmailRequest } from "../auth/models/request/update-two-factor-email.request";
import { UpdateTwoFactorWebAuthnDeleteRequest } from "../auth/models/request/update-two-factor-web-authn-delete.request";
import { UpdateTwoFactorWebAuthnRequest } from "../auth/models/request/update-two-factor-web-authn.request";
import { UpdateTwoFactorYubikeyOtpRequest } from "../auth/models/request/update-two-factor-yubikey-otp.request";
import { ApiKeyResponse } from "../auth/models/response/api-key.response";
import { AuthRequestResponse } from "../auth/models/response/auth-request.response";
import { DeviceVerificationResponse } from "../auth/models/response/device-verification.response";
import { IdentityCaptchaResponse } from "../auth/models/response/identity-captcha.response";
import { IdentityTokenResponse } from "../auth/models/response/identity-token.response";
import { IdentityTwoFactorResponse } from "../auth/models/response/identity-two-factor.response";
import { KeyConnectorUserKeyResponse } from "../auth/models/response/key-connector-user-key.response";
import { PreloginResponse } from "../auth/models/response/prelogin.response";
import { RegisterResponse } from "../auth/models/response/register.response";
import { SsoPreValidateResponse } from "../auth/models/response/sso-pre-validate.response";
import { TwoFactorAuthenticatorResponse } from "../auth/models/response/two-factor-authenticator.response";
import { TwoFactorDuoResponse } from "../auth/models/response/two-factor-duo.response";
import { TwoFactorEmailResponse } from "../auth/models/response/two-factor-email.response";
import { TwoFactorProviderResponse } from "../auth/models/response/two-factor-provider.response";
import { TwoFactorRecoverResponse } from "../auth/models/response/two-factor-recover.response";
import {
  ChallengeResponse,
  TwoFactorWebAuthnResponse,
} from "../auth/models/response/two-factor-web-authn.response";
import { TwoFactorYubiKeyResponse } from "../auth/models/response/two-factor-yubi-key.response";
import { BitPayInvoiceRequest } from "../billing/models/request/bit-pay-invoice.request";
import { PaymentRequest } from "../billing/models/request/payment.request";
import { TaxInfoUpdateRequest } from "../billing/models/request/tax-info-update.request";
import { BillingHistoryResponse } from "../billing/models/response/billing-history.response";
import { BillingPaymentResponse } from "../billing/models/response/billing-payment.response";
import { PaymentResponse } from "../billing/models/response/payment.response";
import { PlanResponse } from "../billing/models/response/plan.response";
import { SubscriptionResponse } from "../billing/models/response/subscription.response";
import { TaxInfoResponse } from "../billing/models/response/tax-info.response";
import { TaxRateResponse } from "../billing/models/response/tax-rate.response";
import { DeleteRecoverRequest } from "../models/request/delete-recover.request";
import { EventRequest } from "../models/request/event.request";
import { KdfRequest } from "../models/request/kdf.request";
import { KeysRequest } from "../models/request/keys.request";
import { OrganizationImportRequest } from "../models/request/organization-import.request";
import { PreloginRequest } from "../models/request/prelogin.request";
import { RegisterRequest } from "../models/request/register.request";
import { StorageRequest } from "../models/request/storage.request";
import { UpdateAvatarRequest } from "../models/request/update-avatar.request";
import { UpdateDomainsRequest } from "../models/request/update-domains.request";
import { VerifyDeleteRecoverRequest } from "../models/request/verify-delete-recover.request";
import { VerifyEmailRequest } from "../models/request/verify-email.request";
import { BreachAccountResponse } from "../models/response/breach-account.response";
import { DomainsResponse } from "../models/response/domains.response";
import { EventResponse } from "../models/response/event.response";
import { ListResponse } from "../models/response/list.response";
import { ProfileResponse } from "../models/response/profile.response";
import { UserKeyResponse } from "../models/response/user-key.response";
import { SyncResponse } from "../platform/sync";
import { UserId } from "../types/guid";
import { AttachmentRequest } from "../vault/models/request/attachment.request";
import { CipherBulkDeleteRequest } from "../vault/models/request/cipher-bulk-delete.request";
import { CipherBulkMoveRequest } from "../vault/models/request/cipher-bulk-move.request";
import { CipherBulkRestoreRequest } from "../vault/models/request/cipher-bulk-restore.request";
import { CipherBulkShareRequest } from "../vault/models/request/cipher-bulk-share.request";
import { CipherCollectionsRequest } from "../vault/models/request/cipher-collections.request";
import { CipherCreateRequest } from "../vault/models/request/cipher-create.request";
import { CipherPartialRequest } from "../vault/models/request/cipher-partial.request";
import { CipherShareRequest } from "../vault/models/request/cipher-share.request";
import { CipherRequest } from "../vault/models/request/cipher.request";
import { CollectionRequest } from "../vault/models/request/collection.request";
import { AttachmentUploadDataResponse } from "../vault/models/response/attachment-upload-data.response";
import { AttachmentResponse } from "../vault/models/response/attachment.response";
import { CipherResponse } from "../vault/models/response/cipher.response";
import {
  CollectionAccessDetailsResponse,
  CollectionDetailsResponse,
  CollectionResponse,
} from "../vault/models/response/collection.response";
import { OptionalCipherResponse } from "../vault/models/response/optional-cipher.response";

/**
 * @deprecated The `ApiService` class is deprecated and calls should be extracted into individual
 * api services. The `send` method is still allowed to be used within api services. For background
 * of this decision please read https://contributing.bitwarden.com/architecture/adr/refactor-api-service.
 */
export abstract class ApiService {
  send: (
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body: any,
    authed: boolean,
    hasResponse: boolean,
    apiUrl?: string,
    alterHeaders?: (headers: Headers) => void,
  ) => Promise<any>;

  postIdentityToken: (
    request:
      | PasswordTokenRequest
      | SsoTokenRequest
      | UserApiTokenRequest
      | WebAuthnLoginTokenRequest,
  ) => Promise<IdentityTokenResponse | IdentityTwoFactorResponse | IdentityCaptchaResponse>;
  refreshIdentityToken: () => Promise<any>;

  getProfile: () => Promise<ProfileResponse>;
  getUserSubscription: () => Promise<SubscriptionResponse>;
  getTaxInfo: () => Promise<TaxInfoResponse>;
  putProfile: (request: UpdateProfileRequest) => Promise<ProfileResponse>;
  putAvatar: (request: UpdateAvatarRequest) => Promise<ProfileResponse>;
  putTaxInfo: (request: TaxInfoUpdateRequest) => Promise<any>;
  postPrelogin: (request: PreloginRequest) => Promise<PreloginResponse>;
  postEmailToken: (request: EmailTokenRequest) => Promise<any>;
  postEmail: (request: EmailRequest) => Promise<any>;
  postPassword: (request: PasswordRequest) => Promise<any>;
  setPassword: (request: SetPasswordRequest) => Promise<any>;
  postSetKeyConnectorKey: (request: SetKeyConnectorKeyRequest) => Promise<any>;
  postSecurityStamp: (request: SecretVerificationRequest) => Promise<any>;
  getAccountRevisionDate: () => Promise<number>;
  postPasswordHint: (request: PasswordHintRequest) => Promise<any>;
  postRegister: (request: RegisterRequest) => Promise<RegisterResponse>;
  postPremium: (data: FormData) => Promise<PaymentResponse>;
  postReinstatePremium: () => Promise<any>;
  postAccountStorage: (request: StorageRequest) => Promise<PaymentResponse>;
  postAccountPayment: (request: PaymentRequest) => Promise<void>;
  postAccountLicense: (data: FormData) => Promise<any>;
  postAccountKeys: (request: KeysRequest) => Promise<any>;
  postAccountVerifyEmail: () => Promise<any>;
  postAccountVerifyEmailToken: (request: VerifyEmailRequest) => Promise<any>;
  postAccountRecoverDelete: (request: DeleteRecoverRequest) => Promise<any>;
  postAccountRecoverDeleteToken: (request: VerifyDeleteRecoverRequest) => Promise<any>;
  postAccountKdf: (request: KdfRequest) => Promise<any>;
  postUserApiKey: (id: string, request: SecretVerificationRequest) => Promise<ApiKeyResponse>;
  postUserRotateApiKey: (id: string, request: SecretVerificationRequest) => Promise<ApiKeyResponse>;
  putUpdateTempPassword: (request: UpdateTempPasswordRequest) => Promise<any>;
  postConvertToKeyConnector: () => Promise<void>;
  //passwordless
  postAuthRequest: (request: CreateAuthRequest) => Promise<AuthRequestResponse>;
  postAdminAuthRequest: (request: CreateAuthRequest) => Promise<AuthRequestResponse>;
  getAuthResponse: (id: string, accessCode: string) => Promise<AuthRequestResponse>;
  getAuthRequest: (id: string) => Promise<AuthRequestResponse>;
  putAuthRequest: (id: string, request: PasswordlessAuthRequest) => Promise<AuthRequestResponse>;
  getAuthRequests: () => Promise<ListResponse<AuthRequestResponse>>;
  getLastAuthRequest: () => Promise<AuthRequestResponse>;

  getUserBillingHistory: () => Promise<BillingHistoryResponse>;
  getUserBillingPayment: () => Promise<BillingPaymentResponse>;

  getCipher: (id: string) => Promise<CipherResponse>;
  getFullCipherDetails: (id: string) => Promise<CipherResponse>;
  getCipherAdmin: (id: string) => Promise<CipherResponse>;
  getAttachmentData: (
    cipherId: string,
    attachmentId: string,
    emergencyAccessId?: string,
  ) => Promise<AttachmentResponse>;
  getCiphersOrganization: (organizationId: string) => Promise<ListResponse<CipherResponse>>;
  postCipher: (request: CipherRequest) => Promise<CipherResponse>;
  postCipherCreate: (request: CipherCreateRequest) => Promise<CipherResponse>;
  postCipherAdmin: (request: CipherCreateRequest) => Promise<CipherResponse>;
  putCipher: (id: string, request: CipherRequest) => Promise<CipherResponse>;
  putPartialCipher: (id: string, request: CipherPartialRequest) => Promise<CipherResponse>;
  putCipherAdmin: (id: string, request: CipherRequest) => Promise<CipherResponse>;
  deleteCipher: (id: string) => Promise<any>;
  deleteCipherAdmin: (id: string) => Promise<any>;
  deleteManyCiphers: (request: CipherBulkDeleteRequest) => Promise<any>;
  deleteManyCiphersAdmin: (request: CipherBulkDeleteRequest) => Promise<any>;
  putMoveCiphers: (request: CipherBulkMoveRequest) => Promise<any>;
  putShareCipher: (id: string, request: CipherShareRequest) => Promise<CipherResponse>;
  putShareCiphers: (request: CipherBulkShareRequest) => Promise<any>;
  putCipherCollections: (
    id: string,
    request: CipherCollectionsRequest,
  ) => Promise<OptionalCipherResponse>;
  putCipherCollectionsAdmin: (id: string, request: CipherCollectionsRequest) => Promise<any>;
  postPurgeCiphers: (request: SecretVerificationRequest, organizationId?: string) => Promise<any>;
  putDeleteCipher: (id: string) => Promise<any>;
  putDeleteCipherAdmin: (id: string) => Promise<any>;
  putDeleteManyCiphers: (request: CipherBulkDeleteRequest) => Promise<any>;
  putDeleteManyCiphersAdmin: (request: CipherBulkDeleteRequest) => Promise<any>;
  putRestoreCipher: (id: string) => Promise<CipherResponse>;
  putRestoreCipherAdmin: (id: string) => Promise<CipherResponse>;
  putRestoreManyCiphers: (
    request: CipherBulkRestoreRequest,
  ) => Promise<ListResponse<CipherResponse>>;
  putRestoreManyCiphersAdmin: (
    request: CipherBulkRestoreRequest,
  ) => Promise<ListResponse<CipherResponse>>;

  /**
   * @deprecated Mar 25 2021: This method has been deprecated in favor of direct uploads.
   * This method still exists for backward compatibility with old server versions.
   */
  postCipherAttachmentLegacy: (id: string, data: FormData) => Promise<CipherResponse>;
  /**
   * @deprecated Mar 25 2021: This method has been deprecated in favor of direct uploads.
   * This method still exists for backward compatibility with old server versions.
   */
  postCipherAttachmentAdminLegacy: (id: string, data: FormData) => Promise<CipherResponse>;
  postCipherAttachment: (
    id: string,
    request: AttachmentRequest,
  ) => Promise<AttachmentUploadDataResponse>;
  deleteCipherAttachment: (id: string, attachmentId: string) => Promise<any>;
  deleteCipherAttachmentAdmin: (id: string, attachmentId: string) => Promise<any>;
  postShareCipherAttachment: (
    id: string,
    attachmentId: string,
    data: FormData,
    organizationId: string,
  ) => Promise<any>;
  renewAttachmentUploadUrl: (
    id: string,
    attachmentId: string,
  ) => Promise<AttachmentUploadDataResponse>;
  postAttachmentFile: (id: string, attachmentId: string, data: FormData) => Promise<any>;

  getUserCollections: () => Promise<ListResponse<CollectionResponse>>;
  getCollections: (organizationId: string) => Promise<ListResponse<CollectionResponse>>;
  getCollectionUsers: (organizationId: string, id: string) => Promise<SelectionReadOnlyResponse[]>;
  getCollectionAccessDetails: (
    organizationId: string,
    id: string,
  ) => Promise<CollectionAccessDetailsResponse>;
  getManyCollectionsWithAccessDetails: (
    orgId: string,
  ) => Promise<ListResponse<CollectionAccessDetailsResponse>>;
  postCollection: (
    organizationId: string,
    request: CollectionRequest,
  ) => Promise<CollectionDetailsResponse>;
  putCollectionUsers: (
    organizationId: string,
    id: string,
    request: SelectionReadOnlyRequest[],
  ) => Promise<any>;
  putCollection: (
    organizationId: string,
    id: string,
    request: CollectionRequest,
  ) => Promise<CollectionDetailsResponse>;
  deleteCollection: (organizationId: string, id: string) => Promise<any>;
  deleteManyCollections: (organizationId: string, collectionIds: string[]) => Promise<any>;
  deleteCollectionUser: (
    organizationId: string,
    id: string,
    organizationUserId: string,
  ) => Promise<any>;

  getGroupUsers: (organizationId: string, id: string) => Promise<string[]>;
  deleteGroupUser: (organizationId: string, id: string, organizationUserId: string) => Promise<any>;

  getSync: () => Promise<SyncResponse>;
  postPublicImportDirectory: (request: OrganizationImportRequest) => Promise<any>;

  getSettingsDomains: () => Promise<DomainsResponse>;
  putSettingsDomains: (request: UpdateDomainsRequest) => Promise<DomainsResponse>;

  getTwoFactorProviders: () => Promise<ListResponse<TwoFactorProviderResponse>>;
  getTwoFactorOrganizationProviders: (
    organizationId: string,
  ) => Promise<ListResponse<TwoFactorProviderResponse>>;
  getTwoFactorAuthenticator: (
    request: SecretVerificationRequest,
  ) => Promise<TwoFactorAuthenticatorResponse>;
  getTwoFactorEmail: (request: SecretVerificationRequest) => Promise<TwoFactorEmailResponse>;
  getTwoFactorDuo: (request: SecretVerificationRequest) => Promise<TwoFactorDuoResponse>;
  getTwoFactorOrganizationDuo: (
    organizationId: string,
    request: SecretVerificationRequest,
  ) => Promise<TwoFactorDuoResponse>;
  getTwoFactorYubiKey: (request: SecretVerificationRequest) => Promise<TwoFactorYubiKeyResponse>;
  getTwoFactorWebAuthn: (request: SecretVerificationRequest) => Promise<TwoFactorWebAuthnResponse>;
  getTwoFactorWebAuthnChallenge: (request: SecretVerificationRequest) => Promise<ChallengeResponse>;
  getTwoFactorRecover: (request: SecretVerificationRequest) => Promise<TwoFactorRecoverResponse>;
  putTwoFactorAuthenticator: (
    request: UpdateTwoFactorAuthenticatorRequest,
  ) => Promise<TwoFactorAuthenticatorResponse>;
  putTwoFactorEmail: (request: UpdateTwoFactorEmailRequest) => Promise<TwoFactorEmailResponse>;
  putTwoFactorDuo: (request: UpdateTwoFactorDuoRequest) => Promise<TwoFactorDuoResponse>;
  putTwoFactorOrganizationDuo: (
    organizationId: string,
    request: UpdateTwoFactorDuoRequest,
  ) => Promise<TwoFactorDuoResponse>;
  putTwoFactorYubiKey: (
    request: UpdateTwoFactorYubikeyOtpRequest,
  ) => Promise<TwoFactorYubiKeyResponse>;
  putTwoFactorWebAuthn: (
    request: UpdateTwoFactorWebAuthnRequest,
  ) => Promise<TwoFactorWebAuthnResponse>;
  deleteTwoFactorWebAuthn: (
    request: UpdateTwoFactorWebAuthnDeleteRequest,
  ) => Promise<TwoFactorWebAuthnResponse>;
  putTwoFactorDisable: (request: TwoFactorProviderRequest) => Promise<TwoFactorProviderResponse>;
  putTwoFactorOrganizationDisable: (
    organizationId: string,
    request: TwoFactorProviderRequest,
  ) => Promise<TwoFactorProviderResponse>;
  postTwoFactorRecover: (request: TwoFactorRecoveryRequest) => Promise<any>;
  postTwoFactorEmailSetup: (request: TwoFactorEmailRequest) => Promise<any>;
  postTwoFactorEmail: (request: TwoFactorEmailRequest) => Promise<any>;
  getDeviceVerificationSettings: () => Promise<DeviceVerificationResponse>;
  putDeviceVerificationSettings: (
    request: DeviceVerificationRequest,
  ) => Promise<DeviceVerificationResponse>;

  getCloudCommunicationsEnabled: () => Promise<boolean>;
  abstract getOrganizationConnection<TConfig extends OrganizationConnectionConfigApis>(
    id: string,
    type: OrganizationConnectionType,
    configType: { new (response: any): TConfig },
  ): Promise<OrganizationConnectionResponse<TConfig>>;
  abstract createOrganizationConnection<TConfig extends OrganizationConnectionConfigApis>(
    request: OrganizationConnectionRequest,
    configType: { new (response: any): TConfig },
  ): Promise<OrganizationConnectionResponse<TConfig>>;
  abstract updateOrganizationConnection<TConfig extends OrganizationConnectionConfigApis>(
    request: OrganizationConnectionRequest,
    configType: { new (response: any): TConfig },
    organizationConnectionId: string,
  ): Promise<OrganizationConnectionResponse<TConfig>>;
  deleteOrganizationConnection: (id: string) => Promise<void>;
  getPlans: () => Promise<ListResponse<PlanResponse>>;
  getTaxRates: () => Promise<ListResponse<TaxRateResponse>>;

  getProviderUsers: (providerId: string) => Promise<ListResponse<ProviderUserUserDetailsResponse>>;
  getProviderUser: (providerId: string, id: string) => Promise<ProviderUserResponse>;
  postProviderUserInvite: (providerId: string, request: ProviderUserInviteRequest) => Promise<any>;
  postProviderUserReinvite: (providerId: string, id: string) => Promise<any>;
  postManyProviderUserReinvite: (
    providerId: string,
    request: ProviderUserBulkRequest,
  ) => Promise<ListResponse<ProviderUserBulkResponse>>;
  postProviderUserAccept: (
    providerId: string,
    id: string,
    request: ProviderUserAcceptRequest,
  ) => Promise<any>;
  postProviderUserConfirm: (
    providerId: string,
    id: string,
    request: ProviderUserConfirmRequest,
  ) => Promise<any>;
  postProviderUsersPublicKey: (
    providerId: string,
    request: ProviderUserBulkRequest,
  ) => Promise<ListResponse<ProviderUserBulkPublicKeyResponse>>;
  postProviderUserBulkConfirm: (
    providerId: string,
    request: ProviderUserBulkConfirmRequest,
  ) => Promise<ListResponse<ProviderUserBulkResponse>>;
  putProviderUser: (
    providerId: string,
    id: string,
    request: ProviderUserUpdateRequest,
  ) => Promise<any>;
  deleteProviderUser: (organizationId: string, id: string) => Promise<any>;
  deleteManyProviderUsers: (
    providerId: string,
    request: ProviderUserBulkRequest,
  ) => Promise<ListResponse<ProviderUserBulkResponse>>;
  getProviderClients: (
    providerId: string,
  ) => Promise<ListResponse<ProviderOrganizationOrganizationDetailsResponse>>;
  postProviderAddOrganization: (
    providerId: string,
    request: ProviderAddOrganizationRequest,
  ) => Promise<any>;
  postProviderCreateOrganization: (
    providerId: string,
    request: ProviderOrganizationCreateRequest,
  ) => Promise<ProviderOrganizationResponse>;
  deleteProviderOrganization: (providerId: string, organizationId: string) => Promise<any>;

  getEvents: (start: string, end: string, token: string) => Promise<ListResponse<EventResponse>>;
  getEventsCipher: (
    id: string,
    start: string,
    end: string,
    token: string,
  ) => Promise<ListResponse<EventResponse>>;
  getEventsOrganization: (
    id: string,
    start: string,
    end: string,
    token: string,
  ) => Promise<ListResponse<EventResponse>>;
  getEventsOrganizationUser: (
    organizationId: string,
    id: string,
    start: string,
    end: string,
    token: string,
  ) => Promise<ListResponse<EventResponse>>;
  getEventsProvider: (
    id: string,
    start: string,
    end: string,
    token: string,
  ) => Promise<ListResponse<EventResponse>>;
  getEventsProviderUser: (
    providerId: string,
    id: string,
    start: string,
    end: string,
    token: string,
  ) => Promise<ListResponse<EventResponse>>;

  /**
   * Posts events for a user
   * @param request The array of events to upload
   * @param userId The optional user id the events belong to. If no user id is provided the active user id is used.
   */
  postEventsCollect: (request: EventRequest[], userId?: UserId) => Promise<any>;

  deleteSsoUser: (organizationId: string) => Promise<void>;
  getSsoUserIdentifier: () => Promise<string>;

  getUserPublicKey: (id: string) => Promise<UserKeyResponse>;

  getHibpBreach: (username: string) => Promise<BreachAccountResponse[]>;

  postBitPayInvoice: (request: BitPayInvoiceRequest) => Promise<string>;
  postSetupPayment: () => Promise<string>;

  getActiveBearerToken: () => Promise<string>;
  fetch: (request: Request) => Promise<Response>;
  nativeFetch: (request: Request) => Promise<Response>;

  preValidateSso: (identifier: string) => Promise<SsoPreValidateResponse>;

  postCreateSponsorship: (
    sponsorshipOrgId: string,
    request: OrganizationSponsorshipCreateRequest,
  ) => Promise<void>;
  getSponsorshipSyncStatus: (
    sponsoredOrgId: string,
  ) => Promise<OrganizationSponsorshipSyncStatusResponse>;
  deleteRevokeSponsorship: (sponsoringOrganizationId: string) => Promise<void>;
  deleteRemoveSponsorship: (sponsoringOrgId: string) => Promise<void>;
  postPreValidateSponsorshipToken: (sponsorshipToken: string) => Promise<boolean>;
  postRedeemSponsorship: (
    sponsorshipToken: string,
    request: OrganizationSponsorshipRedeemRequest,
  ) => Promise<void>;
  postResendSponsorshipOffer: (sponsoringOrgId: string) => Promise<void>;

  getMasterKeyFromKeyConnector: (keyConnectorUrl: string) => Promise<KeyConnectorUserKeyResponse>;
  postUserKeyToKeyConnector: (
    keyConnectorUrl: string,
    request: KeyConnectorUserKeyRequest,
  ) => Promise<void>;
  getKeyConnectorAlive: (keyConnectorUrl: string) => Promise<void>;
  getOrganizationExport: (organizationId: string) => Promise<OrganizationExportResponse>;
}
