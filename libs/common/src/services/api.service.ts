// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, map } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import {
  CollectionAccessDetailsResponse,
  CollectionDetailsResponse,
  CollectionResponse,
  CreateCollectionRequest,
  UpdateCollectionRequest,
} from "@bitwarden/admin-console/common";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { LogoutReason } from "@bitwarden/auth/common";

import { ApiService as ApiServiceAbstraction } from "../abstractions/api.service";
import { OrganizationConnectionType } from "../admin-console/enums";
import { CollectionBulkDeleteRequest } from "../admin-console/models/request/collection-bulk-delete.request";
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
import {
  OrganizationConnectionConfigApis,
  OrganizationConnectionResponse,
} from "../admin-console/models/response/organization-connection.response";
import { OrganizationExportResponse } from "../admin-console/models/response/organization-export.response";
import { OrganizationSponsorshipSyncStatusResponse } from "../admin-console/models/response/organization-sponsorship-sync-status.response";
import { PreValidateSponsorshipResponse } from "../admin-console/models/response/pre-validate-sponsorship.response";
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
import { AccountService } from "../auth/abstractions/account.service";
import { TokenService } from "../auth/abstractions/token.service";
import { DeviceVerificationRequest } from "../auth/models/request/device-verification.request";
import { DisableTwoFactorAuthenticatorRequest } from "../auth/models/request/disable-two-factor-authenticator.request";
import { EmailTokenRequest } from "../auth/models/request/email-token.request";
import { EmailRequest } from "../auth/models/request/email.request";
import { DeviceRequest } from "../auth/models/request/identity-token/device.request";
import { PasswordTokenRequest } from "../auth/models/request/identity-token/password-token.request";
import { SsoTokenRequest } from "../auth/models/request/identity-token/sso-token.request";
import { TokenTwoFactorRequest } from "../auth/models/request/identity-token/token-two-factor.request";
import { UserApiTokenRequest } from "../auth/models/request/identity-token/user-api-token.request";
import { WebAuthnLoginTokenRequest } from "../auth/models/request/identity-token/webauthn-login-token.request";
import { PasswordHintRequest } from "../auth/models/request/password-hint.request";
import { PasswordlessAuthRequest } from "../auth/models/request/passwordless-auth.request";
import { SecretVerificationRequest } from "../auth/models/request/secret-verification.request";
import { TwoFactorEmailRequest } from "../auth/models/request/two-factor-email.request";
import { TwoFactorProviderRequest } from "../auth/models/request/two-factor-provider.request";
import { UpdateProfileRequest } from "../auth/models/request/update-profile.request";
import { UpdateTwoFactorAuthenticatorRequest } from "../auth/models/request/update-two-factor-authenticator.request";
import { UpdateTwoFactorDuoRequest } from "../auth/models/request/update-two-factor-duo.request";
import { UpdateTwoFactorEmailRequest } from "../auth/models/request/update-two-factor-email.request";
import { UpdateTwoFactorWebAuthnDeleteRequest } from "../auth/models/request/update-two-factor-web-authn-delete.request";
import { UpdateTwoFactorWebAuthnRequest } from "../auth/models/request/update-two-factor-web-authn.request";
import { UpdateTwoFactorYubikeyOtpRequest } from "../auth/models/request/update-two-factor-yubikey-otp.request";
import { ApiKeyResponse } from "../auth/models/response/api-key.response";
import { AuthRequestResponse } from "../auth/models/response/auth-request.response";
import { DeviceVerificationResponse } from "../auth/models/response/device-verification.response";
import { IdentityDeviceVerificationResponse } from "../auth/models/response/identity-device-verification.response";
import { IdentityTokenResponse } from "../auth/models/response/identity-token.response";
import { IdentityTwoFactorResponse } from "../auth/models/response/identity-two-factor.response";
import { KeyConnectorUserKeyResponse } from "../auth/models/response/key-connector-user-key.response";
import { PreloginResponse } from "../auth/models/response/prelogin.response";
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
import { ClientType, DeviceType } from "../enums";
import { KeyConnectorUserKeyRequest } from "../key-management/key-connector/models/key-connector-user-key.request";
import { SetKeyConnectorKeyRequest } from "../key-management/key-connector/models/set-key-connector-key.request";
import { VaultTimeoutSettingsService } from "../key-management/vault-timeout";
import { VaultTimeoutAction } from "../key-management/vault-timeout/enums/vault-timeout-action.enum";
import { DeleteRecoverRequest } from "../models/request/delete-recover.request";
import { EventRequest } from "../models/request/event.request";
import { KdfRequest } from "../models/request/kdf.request";
import { KeysRequest } from "../models/request/keys.request";
import { PreloginRequest } from "../models/request/prelogin.request";
import { StorageRequest } from "../models/request/storage.request";
import { UpdateAvatarRequest } from "../models/request/update-avatar.request";
import { UpdateDomainsRequest } from "../models/request/update-domains.request";
import { VerifyDeleteRecoverRequest } from "../models/request/verify-delete-recover.request";
import { VerifyEmailRequest } from "../models/request/verify-email.request";
import { DomainsResponse } from "../models/response/domains.response";
import { ErrorResponse } from "../models/response/error.response";
import { EventResponse } from "../models/response/event.response";
import { ListResponse } from "../models/response/list.response";
import { ProfileResponse } from "../models/response/profile.response";
import { UserKeyResponse } from "../models/response/user-key.response";
import { AppIdService } from "../platform/abstractions/app-id.service";
import { Environment, EnvironmentService } from "../platform/abstractions/environment.service";
import { LogService } from "../platform/abstractions/log.service";
import { PlatformUtilsService } from "../platform/abstractions/platform-utils.service";
import { flagEnabled } from "../platform/misc/flags";
import { Utils } from "../platform/misc/utils";
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
import { AttachmentUploadDataResponse } from "../vault/models/response/attachment-upload-data.response";
import { AttachmentResponse } from "../vault/models/response/attachment.response";
import { CipherResponse } from "../vault/models/response/cipher.response";
import { OptionalCipherResponse } from "../vault/models/response/optional-cipher.response";

export type HttpOperations = {
  createRequest: (url: string, request: RequestInit) => Request;
};

/**
 * @deprecated The `ApiService` class is deprecated and calls should be extracted into individual
 * api services. The `send` method is still allowed to be used within api services. For background
 * of this decision please read https://contributing.bitwarden.com/architecture/adr/refactor-api-service.
 */
export class ApiService implements ApiServiceAbstraction {
  private device: DeviceType;
  private deviceType: string;
  private refreshTokenPromise: Record<UserId, Promise<string>> = {};

  /**
   * The message (responseJson.ErrorModel.Message) that comes back from the server when a new device verification is required.
   */
  private static readonly NEW_DEVICE_VERIFICATION_REQUIRED_MESSAGE =
    "new device verification required";

  constructor(
    private tokenService: TokenService,
    private platformUtilsService: PlatformUtilsService,
    private environmentService: EnvironmentService,
    private appIdService: AppIdService,
    private refreshAccessTokenErrorCallback: () => void,
    private logService: LogService,
    private logoutCallback: (logoutReason: LogoutReason) => Promise<void>,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private readonly accountService: AccountService,
    private readonly httpOperations: HttpOperations,
    private customUserAgent: string = null,
  ) {
    this.device = platformUtilsService.getDevice();
    this.deviceType = this.device.toString();
  }

  // Auth APIs

  async postIdentityToken(
    request:
      | UserApiTokenRequest
      | PasswordTokenRequest
      | SsoTokenRequest
      | WebAuthnLoginTokenRequest,
  ): Promise<
    IdentityTokenResponse | IdentityTwoFactorResponse | IdentityDeviceVerificationResponse
  > {
    const headers = new Headers({
      "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      Accept: "application/json",
      "Device-Type": this.deviceType,
    });
    if (this.customUserAgent != null) {
      headers.set("User-Agent", this.customUserAgent);
    }

    const identityToken =
      request instanceof UserApiTokenRequest
        ? request.toIdentityToken()
        : request.toIdentityToken(this.platformUtilsService.getClientType());

    const env = await firstValueFrom(this.environmentService.environment$);

    const response = await this.fetch(
      this.httpOperations.createRequest(env.getIdentityUrl() + "/connect/token", {
        body: this.qsStringify(identityToken),
        credentials: await this.getCredentials(env),
        cache: "no-store",
        headers: headers,
        method: "POST",
      }),
    );

    let responseJson: any = null;
    if (this.isJsonResponse(response)) {
      responseJson = await response.json();
    }

    if (responseJson != null) {
      if (response.status === 200) {
        return new IdentityTokenResponse(responseJson);
      } else if (
        response.status === 400 &&
        responseJson.TwoFactorProviders2 &&
        Object.keys(responseJson.TwoFactorProviders2).length
      ) {
        return new IdentityTwoFactorResponse(responseJson);
      } else if (
        response.status === 400 &&
        responseJson?.ErrorModel?.Message === ApiService.NEW_DEVICE_VERIFICATION_REQUIRED_MESSAGE
      ) {
        return new IdentityDeviceVerificationResponse(responseJson);
      }
    }

    return Promise.reject(new ErrorResponse(responseJson, response.status, true));
  }

  async refreshIdentityToken(userId: UserId | null = null): Promise<any> {
    const normalizedUser = (userId ??= await this.getActiveUser());
    if (normalizedUser == null) {
      throw new Error("No user provided and no active user, cannot refresh the identity token.");
    }
    try {
      await this.refreshToken(normalizedUser);
    } catch (e) {
      this.logService.error("Error refreshing access token: ", e);
      throw e;
    }
  }

  // TODO: PM-3519: Create and move to AuthRequest Api service
  async getAuthRequest(id: string): Promise<AuthRequestResponse> {
    const path = `/auth-requests/${id}`;
    const r = await this.send("GET", path, null, true, true);
    return new AuthRequestResponse(r);
  }

  async putAuthRequest(id: string, request: PasswordlessAuthRequest): Promise<AuthRequestResponse> {
    const path = `/auth-requests/${id}`;
    const r = await this.send("PUT", path, request, true, true);
    return new AuthRequestResponse(r);
  }

  async getAuthRequests(): Promise<ListResponse<AuthRequestResponse>> {
    const path = `/auth-requests/`;
    const r = await this.send("GET", path, null, true, true);
    return new ListResponse(r, AuthRequestResponse);
  }

  async getLastAuthRequest(): Promise<AuthRequestResponse> {
    const requests = await this.getAuthRequests();
    const activeRequests = requests.data.filter((m) => !m.isAnswered && !m.isExpired);
    const lastRequest = activeRequests.sort((a: AuthRequestResponse, b: AuthRequestResponse) =>
      a.creationDate.localeCompare(b.creationDate),
    )[activeRequests.length - 1];
    return lastRequest;
  }

  // Account APIs

  async getProfile(): Promise<ProfileResponse> {
    const r = await this.send("GET", "/accounts/profile", null, true, true);
    return new ProfileResponse(r);
  }

  async getUserSubscription(): Promise<SubscriptionResponse> {
    const r = await this.send("GET", "/accounts/subscription", null, true, true);
    return new SubscriptionResponse(r);
  }

  async getTaxInfo(): Promise<TaxInfoResponse> {
    const r = await this.send("GET", "/accounts/tax", null, true, true);
    return new TaxInfoResponse(r);
  }

  async putProfile(request: UpdateProfileRequest): Promise<ProfileResponse> {
    const r = await this.send("PUT", "/accounts/profile", request, true, true);
    return new ProfileResponse(r);
  }

  async putAvatar(request: UpdateAvatarRequest): Promise<ProfileResponse> {
    const r = await this.send("PUT", "/accounts/avatar", request, true, true);
    return new ProfileResponse(r);
  }

  putTaxInfo(request: TaxInfoUpdateRequest): Promise<any> {
    return this.send("PUT", "/accounts/tax", request, true, false);
  }

  async postPrelogin(request: PreloginRequest): Promise<PreloginResponse> {
    const env = await firstValueFrom(this.environmentService.environment$);
    const r = await this.send(
      "POST",
      "/accounts/prelogin",
      request,
      false,
      true,
      env.getIdentityUrl(),
    );
    return new PreloginResponse(r);
  }

  postEmailToken(request: EmailTokenRequest): Promise<any> {
    return this.send("POST", "/accounts/email-token", request, true, false);
  }

  postEmail(request: EmailRequest): Promise<any> {
    return this.send("POST", "/accounts/email", request, true, false);
  }

  postSetKeyConnectorKey(request: SetKeyConnectorKeyRequest): Promise<any> {
    return this.send("POST", "/accounts/set-key-connector-key", request, true, false);
  }

  postSecurityStamp(request: SecretVerificationRequest): Promise<any> {
    return this.send("POST", "/accounts/security-stamp", request, true, false);
  }

  async getAccountRevisionDate(): Promise<number> {
    const r = await this.send("GET", "/accounts/revision-date", null, true, true);
    return r as number;
  }

  postPasswordHint(request: PasswordHintRequest): Promise<any> {
    return this.send("POST", "/accounts/password-hint", request, false, false);
  }

  async postPremium(data: FormData): Promise<PaymentResponse> {
    const r = await this.send("POST", "/accounts/premium", data, true, true);
    return new PaymentResponse(r);
  }

  postReinstatePremium(): Promise<any> {
    return this.send("POST", "/accounts/reinstate-premium", null, true, false);
  }

  async postAccountStorage(request: StorageRequest): Promise<PaymentResponse> {
    const r = await this.send("POST", "/accounts/storage", request, true, true);
    return new PaymentResponse(r);
  }

  postAccountPayment(request: PaymentRequest): Promise<void> {
    return this.send("POST", "/accounts/payment", request, true, false);
  }

  postAccountLicense(data: FormData): Promise<any> {
    return this.send("POST", "/accounts/license", data, true, false);
  }

  postAccountKeys(request: KeysRequest): Promise<any> {
    return this.send("POST", "/accounts/keys", request, true, false);
  }

  postAccountVerifyEmail(): Promise<any> {
    return this.send("POST", "/accounts/verify-email", null, true, false);
  }

  postAccountVerifyEmailToken(request: VerifyEmailRequest): Promise<any> {
    return this.send("POST", "/accounts/verify-email-token", request, false, false);
  }

  postAccountRecoverDelete(request: DeleteRecoverRequest): Promise<any> {
    return this.send("POST", "/accounts/delete-recover", request, false, false);
  }

  postAccountRecoverDeleteToken(request: VerifyDeleteRecoverRequest): Promise<any> {
    return this.send("POST", "/accounts/delete-recover-token", request, false, false);
  }

  postAccountKdf(request: KdfRequest): Promise<any> {
    return this.send("POST", "/accounts/kdf", request, true, false);
  }

  async deleteSsoUser(organizationId: string): Promise<void> {
    return this.send("DELETE", "/accounts/sso/" + organizationId, null, true, false);
  }

  async getSsoUserIdentifier(): Promise<string> {
    return this.send("GET", "/accounts/sso/user-identifier", null, true, true);
  }

  async postUserApiKey(id: string, request: SecretVerificationRequest): Promise<ApiKeyResponse> {
    const r = await this.send("POST", "/accounts/api-key", request, true, true);
    return new ApiKeyResponse(r);
  }

  async postUserRotateApiKey(
    id: string,
    request: SecretVerificationRequest,
  ): Promise<ApiKeyResponse> {
    const r = await this.send("POST", "/accounts/rotate-api-key", request, true, true);
    return new ApiKeyResponse(r);
  }

  postConvertToKeyConnector(): Promise<void> {
    return this.send("POST", "/accounts/convert-to-key-connector", null, true, false);
  }

  // Account Billing APIs

  async getUserBillingHistory(): Promise<BillingHistoryResponse> {
    const r = await this.send("GET", "/accounts/billing/history", null, true, true);
    return new BillingHistoryResponse(r);
  }

  async getUserBillingPayment(): Promise<BillingPaymentResponse> {
    const r = await this.send("GET", "/accounts/billing/payment-method", null, true, true);
    return new BillingPaymentResponse(r);
  }

  // Cipher APIs

  async getCipher(id: string): Promise<CipherResponse> {
    const r = await this.send("GET", "/ciphers/" + id, null, true, true);
    return new CipherResponse(r);
  }

  async getFullCipherDetails(id: string): Promise<CipherResponse> {
    const r = await this.send("GET", "/ciphers/" + id + "/details", null, true, true);
    return new CipherResponse(r);
  }

  async getCipherAdmin(id: string): Promise<CipherResponse> {
    const r = await this.send("GET", "/ciphers/" + id + "/admin", null, true, true);
    return new CipherResponse(r);
  }

  async getCiphersOrganization(organizationId: string): Promise<ListResponse<CipherResponse>> {
    const r = await this.send(
      "GET",
      "/ciphers/organization-details?organizationId=" + organizationId,
      null,
      true,
      true,
    );
    return new ListResponse(r, CipherResponse);
  }

  async postCipher(request: CipherRequest): Promise<CipherResponse> {
    const r = await this.send("POST", "/ciphers", request, true, true);
    return new CipherResponse(r);
  }

  async postCipherCreate(request: CipherCreateRequest): Promise<CipherResponse> {
    const r = await this.send("POST", "/ciphers/create", request, true, true);
    return new CipherResponse(r);
  }

  async postCipherAdmin(request: CipherCreateRequest): Promise<CipherResponse> {
    const r = await this.send("POST", "/ciphers/admin", request, true, true);
    return new CipherResponse(r);
  }

  async putCipher(id: string, request: CipherRequest): Promise<CipherResponse> {
    const r = await this.send("PUT", "/ciphers/" + id, request, true, true);
    return new CipherResponse(r);
  }

  async putPartialCipher(id: string, request: CipherPartialRequest): Promise<CipherResponse> {
    const r = await this.send("PUT", "/ciphers/" + id + "/partial", request, true, true);
    return new CipherResponse(r);
  }

  async putCipherAdmin(id: string, request: CipherRequest): Promise<CipherResponse> {
    const r = await this.send("PUT", "/ciphers/" + id + "/admin", request, true, true);
    return new CipherResponse(r);
  }

  deleteCipher(id: string): Promise<any> {
    return this.send("DELETE", "/ciphers/" + id, null, true, false);
  }

  deleteCipherAdmin(id: string): Promise<any> {
    return this.send("DELETE", "/ciphers/" + id + "/admin", null, true, false);
  }

  deleteManyCiphers(request: CipherBulkDeleteRequest): Promise<any> {
    return this.send("DELETE", "/ciphers", request, true, false);
  }

  deleteManyCiphersAdmin(request: CipherBulkDeleteRequest): Promise<any> {
    return this.send("DELETE", "/ciphers/admin", request, true, false);
  }

  putMoveCiphers(request: CipherBulkMoveRequest): Promise<any> {
    return this.send("PUT", "/ciphers/move", request, true, false);
  }

  async putShareCipher(id: string, request: CipherShareRequest): Promise<CipherResponse> {
    const r = await this.send("PUT", "/ciphers/" + id + "/share", request, true, true);
    return new CipherResponse(r);
  }

  async putShareCiphers(request: CipherBulkShareRequest): Promise<ListResponse<CipherResponse>> {
    const r = await this.send("PUT", "/ciphers/share", request, true, true);
    return new ListResponse<CipherResponse>(r, CipherResponse);
  }

  async putCipherCollections(
    id: string,
    request: CipherCollectionsRequest,
  ): Promise<OptionalCipherResponse> {
    const response = await this.send(
      "PUT",
      "/ciphers/" + id + "/collections_v2",
      request,
      true,
      true,
    );
    return new OptionalCipherResponse(response);
  }

  putCipherCollectionsAdmin(id: string, request: CipherCollectionsRequest): Promise<any> {
    return this.send("PUT", "/ciphers/" + id + "/collections-admin", request, true, true);
  }

  postPurgeCiphers(
    request: SecretVerificationRequest,
    organizationId: string = null,
  ): Promise<any> {
    let path = "/ciphers/purge";
    if (organizationId != null) {
      path += "?organizationId=" + organizationId;
    }
    return this.send("POST", path, request, true, false);
  }

  putDeleteCipher(id: string): Promise<any> {
    return this.send("PUT", "/ciphers/" + id + "/delete", null, true, false);
  }

  putDeleteCipherAdmin(id: string): Promise<any> {
    return this.send("PUT", "/ciphers/" + id + "/delete-admin", null, true, false);
  }

  putDeleteManyCiphers(request: CipherBulkDeleteRequest): Promise<any> {
    return this.send("PUT", "/ciphers/delete", request, true, false);
  }

  putDeleteManyCiphersAdmin(request: CipherBulkDeleteRequest): Promise<any> {
    return this.send("PUT", "/ciphers/delete-admin", request, true, false);
  }

  async putRestoreCipher(id: string): Promise<CipherResponse> {
    const r = await this.send("PUT", "/ciphers/" + id + "/restore", null, true, true);
    return new CipherResponse(r);
  }

  async putRestoreCipherAdmin(id: string): Promise<CipherResponse> {
    const r = await this.send("PUT", "/ciphers/" + id + "/restore-admin", null, true, true);
    return new CipherResponse(r);
  }

  async putRestoreManyCiphers(
    request: CipherBulkRestoreRequest,
  ): Promise<ListResponse<CipherResponse>> {
    const r = await this.send("PUT", "/ciphers/restore", request, true, true);
    return new ListResponse<CipherResponse>(r, CipherResponse);
  }

  async putRestoreManyCiphersAdmin(
    request: CipherBulkRestoreRequest,
  ): Promise<ListResponse<CipherResponse>> {
    const r = await this.send("PUT", "/ciphers/restore-admin", request, true, true);
    return new ListResponse<CipherResponse>(r, CipherResponse);
  }

  // Attachments APIs

  async getAttachmentData(
    cipherId: string,
    attachmentId: string,
    emergencyAccessId?: string,
  ): Promise<AttachmentResponse> {
    const path =
      (emergencyAccessId != null ? "/emergency-access/" + emergencyAccessId + "/" : "/ciphers/") +
      cipherId +
      "/attachment/" +
      attachmentId;
    const r = await this.send("GET", path, null, true, true);
    return new AttachmentResponse(r);
  }

  async getAttachmentDataAdmin(
    cipherId: string,
    attachmentId: string,
  ): Promise<AttachmentResponse> {
    const path = "/ciphers/" + cipherId + "/attachment/" + attachmentId + "/admin";
    const r = await this.send("GET", path, null, true, true);
    return new AttachmentResponse(r);
  }

  async postCipherAttachment(
    id: string,
    request: AttachmentRequest,
  ): Promise<AttachmentUploadDataResponse> {
    const r = await this.send("POST", "/ciphers/" + id + "/attachment/v2", request, true, true);
    return new AttachmentUploadDataResponse(r);
  }

  deleteCipherAttachment(id: string, attachmentId: string): Promise<any> {
    return this.send("DELETE", "/ciphers/" + id + "/attachment/" + attachmentId, null, true, true);
  }

  deleteCipherAttachmentAdmin(id: string, attachmentId: string): Promise<any> {
    return this.send(
      "DELETE",
      "/ciphers/" + id + "/attachment/" + attachmentId + "/admin",
      null,
      true,
      true,
    );
  }

  postShareCipherAttachment(
    id: string,
    attachmentId: string,
    data: FormData,
    organizationId: string,
  ): Promise<any> {
    return this.send(
      "POST",
      "/ciphers/" + id + "/attachment/" + attachmentId + "/share?organizationId=" + organizationId,
      data,
      true,
      false,
    );
  }

  async renewAttachmentUploadUrl(
    id: string,
    attachmentId: string,
  ): Promise<AttachmentUploadDataResponse> {
    const r = await this.send(
      "GET",
      "/ciphers/" + id + "/attachment/" + attachmentId + "/renew",
      null,
      true,
      true,
    );
    return new AttachmentUploadDataResponse(r);
  }

  postAttachmentFile(id: string, attachmentId: string, data: FormData): Promise<any> {
    return this.send("POST", "/ciphers/" + id + "/attachment/" + attachmentId, data, true, false);
  }

  // Collections APIs

  async getCollectionAccessDetails(
    organizationId: string,
    id: string,
  ): Promise<CollectionAccessDetailsResponse> {
    const r = await this.send(
      "GET",
      "/organizations/" + organizationId + "/collections/" + id + "/details",
      null,
      true,
      true,
    );
    return new CollectionAccessDetailsResponse(r);
  }

  async getUserCollections(): Promise<ListResponse<CollectionResponse>> {
    const r = await this.send("GET", "/collections", null, true, true);
    return new ListResponse(r, CollectionResponse);
  }

  async getCollections(organizationId: string): Promise<ListResponse<CollectionResponse>> {
    const r = await this.send(
      "GET",
      "/organizations/" + organizationId + "/collections",
      null,
      true,
      true,
    );
    return new ListResponse(r, CollectionResponse);
  }

  async getManyCollectionsWithAccessDetails(
    organizationId: string,
  ): Promise<ListResponse<CollectionAccessDetailsResponse>> {
    const r = await this.send(
      "GET",
      "/organizations/" + organizationId + "/collections/details",
      null,
      true,
      true,
    );
    return new ListResponse(r, CollectionAccessDetailsResponse);
  }

  async getCollectionUsers(
    organizationId: string,
    id: string,
  ): Promise<SelectionReadOnlyResponse[]> {
    const r = await this.send(
      "GET",
      "/organizations/" + organizationId + "/collections/" + id + "/users",
      null,
      true,
      true,
    );
    return r.map((dr: any) => new SelectionReadOnlyResponse(dr));
  }

  async postCollection(
    organizationId: string,
    request: CreateCollectionRequest,
  ): Promise<CollectionDetailsResponse> {
    const r = await this.send(
      "POST",
      "/organizations/" + organizationId + "/collections",
      request,
      true,
      true,
    );
    return new CollectionAccessDetailsResponse(r);
  }

  async putCollection(
    organizationId: string,
    id: string,
    request: UpdateCollectionRequest,
  ): Promise<CollectionDetailsResponse> {
    const r = await this.send(
      "PUT",
      "/organizations/" + organizationId + "/collections/" + id,
      request,
      true,
      true,
    );
    return new CollectionAccessDetailsResponse(r);
  }

  deleteCollection(organizationId: string, id: string): Promise<any> {
    return this.send(
      "DELETE",
      "/organizations/" + organizationId + "/collections/" + id,
      null,
      true,
      false,
    );
  }

  deleteManyCollections(organizationId: string, collectionIds: string[]): Promise<any> {
    return this.send(
      "DELETE",
      "/organizations/" + organizationId + "/collections",
      new CollectionBulkDeleteRequest(collectionIds),
      true,
      false,
    );
  }

  // Groups APIs

  async getGroupUsers(organizationId: string, id: string): Promise<string[]> {
    const r = await this.send(
      "GET",
      "/organizations/" + organizationId + "/groups/" + id + "/users",
      null,
      true,
      true,
    );
    return r;
  }

  deleteGroupUser(organizationId: string, id: string, organizationUserId: string): Promise<any> {
    return this.send(
      "DELETE",
      "/organizations/" + organizationId + "/groups/" + id + "/user/" + organizationUserId,
      null,
      true,
      false,
    );
  }

  // Plan APIs

  async getPlans(): Promise<ListResponse<PlanResponse>> {
    const r = await this.send("GET", "/plans", null, false, true);
    return new ListResponse(r, PlanResponse);
  }

  // Settings APIs

  async getSettingsDomains(): Promise<DomainsResponse> {
    const r = await this.send("GET", "/settings/domains", null, true, true);
    return new DomainsResponse(r);
  }

  async putSettingsDomains(request: UpdateDomainsRequest): Promise<DomainsResponse> {
    const r = await this.send("PUT", "/settings/domains", request, true, true);
    return new DomainsResponse(r);
  }

  // Sync APIs

  async getSync(): Promise<SyncResponse> {
    const path = !this.platformUtilsService.supportsAutofill()
      ? "/sync?excludeDomains=true"
      : "/sync";
    const r = await this.send("GET", path, null, true, true);
    return new SyncResponse(r);
  }

  // Two-factor APIs

  async getTwoFactorProviders(): Promise<ListResponse<TwoFactorProviderResponse>> {
    const r = await this.send("GET", "/two-factor", null, true, true);
    return new ListResponse(r, TwoFactorProviderResponse);
  }

  async getTwoFactorOrganizationProviders(
    organizationId: string,
  ): Promise<ListResponse<TwoFactorProviderResponse>> {
    const r = await this.send(
      "GET",
      "/organizations/" + organizationId + "/two-factor",
      null,
      true,
      true,
    );
    return new ListResponse(r, TwoFactorProviderResponse);
  }

  async getTwoFactorAuthenticator(
    request: SecretVerificationRequest,
  ): Promise<TwoFactorAuthenticatorResponse> {
    const r = await this.send("POST", "/two-factor/get-authenticator", request, true, true);
    return new TwoFactorAuthenticatorResponse(r);
  }

  async getTwoFactorEmail(request: SecretVerificationRequest): Promise<TwoFactorEmailResponse> {
    const r = await this.send("POST", "/two-factor/get-email", request, true, true);
    return new TwoFactorEmailResponse(r);
  }

  async getTwoFactorDuo(request: SecretVerificationRequest): Promise<TwoFactorDuoResponse> {
    const r = await this.send("POST", "/two-factor/get-duo", request, true, true);
    return new TwoFactorDuoResponse(r);
  }

  async getTwoFactorOrganizationDuo(
    organizationId: string,
    request: SecretVerificationRequest,
  ): Promise<TwoFactorDuoResponse> {
    const r = await this.send(
      "POST",
      "/organizations/" + organizationId + "/two-factor/get-duo",
      request,
      true,
      true,
    );
    return new TwoFactorDuoResponse(r);
  }

  async getTwoFactorYubiKey(request: SecretVerificationRequest): Promise<TwoFactorYubiKeyResponse> {
    const r = await this.send("POST", "/two-factor/get-yubikey", request, true, true);
    return new TwoFactorYubiKeyResponse(r);
  }

  async getTwoFactorWebAuthn(
    request: SecretVerificationRequest,
  ): Promise<TwoFactorWebAuthnResponse> {
    const r = await this.send("POST", "/two-factor/get-webauthn", request, true, true);
    return new TwoFactorWebAuthnResponse(r);
  }

  async getTwoFactorWebAuthnChallenge(
    request: SecretVerificationRequest,
  ): Promise<ChallengeResponse> {
    const r = await this.send("POST", "/two-factor/get-webauthn-challenge", request, true, true);
    return new ChallengeResponse(r);
  }

  async getTwoFactorRecover(request: SecretVerificationRequest): Promise<TwoFactorRecoverResponse> {
    const r = await this.send("POST", "/two-factor/get-recover", request, true, true);
    return new TwoFactorRecoverResponse(r);
  }

  async putTwoFactorAuthenticator(
    request: UpdateTwoFactorAuthenticatorRequest,
  ): Promise<TwoFactorAuthenticatorResponse> {
    const r = await this.send("PUT", "/two-factor/authenticator", request, true, true);
    return new TwoFactorAuthenticatorResponse(r);
  }

  async deleteTwoFactorAuthenticator(
    request: DisableTwoFactorAuthenticatorRequest,
  ): Promise<TwoFactorProviderResponse> {
    const r = await this.send("DELETE", "/two-factor/authenticator", request, true, true);
    return new TwoFactorProviderResponse(r);
  }

  async putTwoFactorEmail(request: UpdateTwoFactorEmailRequest): Promise<TwoFactorEmailResponse> {
    const r = await this.send("PUT", "/two-factor/email", request, true, true);
    return new TwoFactorEmailResponse(r);
  }

  async putTwoFactorDuo(request: UpdateTwoFactorDuoRequest): Promise<TwoFactorDuoResponse> {
    const r = await this.send("PUT", "/two-factor/duo", request, true, true);
    return new TwoFactorDuoResponse(r);
  }

  async putTwoFactorOrganizationDuo(
    organizationId: string,
    request: UpdateTwoFactorDuoRequest,
  ): Promise<TwoFactorDuoResponse> {
    const r = await this.send(
      "PUT",
      "/organizations/" + organizationId + "/two-factor/duo",
      request,
      true,
      true,
    );
    return new TwoFactorDuoResponse(r);
  }

  async putTwoFactorYubiKey(
    request: UpdateTwoFactorYubikeyOtpRequest,
  ): Promise<TwoFactorYubiKeyResponse> {
    const r = await this.send("PUT", "/two-factor/yubikey", request, true, true);
    return new TwoFactorYubiKeyResponse(r);
  }

  async putTwoFactorWebAuthn(
    request: UpdateTwoFactorWebAuthnRequest,
  ): Promise<TwoFactorWebAuthnResponse> {
    const response = request.deviceResponse.response as AuthenticatorAttestationResponse;
    const data: any = Object.assign({}, request);

    data.deviceResponse = {
      id: request.deviceResponse.id,
      rawId: btoa(request.deviceResponse.id),
      type: request.deviceResponse.type,
      extensions: request.deviceResponse.getClientExtensionResults(),
      response: {
        AttestationObject: Utils.fromBufferToB64(response.attestationObject),
        clientDataJson: Utils.fromBufferToB64(response.clientDataJSON),
      },
    };

    const r = await this.send("PUT", "/two-factor/webauthn", data, true, true);
    return new TwoFactorWebAuthnResponse(r);
  }

  async deleteTwoFactorWebAuthn(
    request: UpdateTwoFactorWebAuthnDeleteRequest,
  ): Promise<TwoFactorWebAuthnResponse> {
    const r = await this.send("DELETE", "/two-factor/webauthn", request, true, true);
    return new TwoFactorWebAuthnResponse(r);
  }

  async putTwoFactorDisable(request: TwoFactorProviderRequest): Promise<TwoFactorProviderResponse> {
    const r = await this.send("PUT", "/two-factor/disable", request, true, true);
    return new TwoFactorProviderResponse(r);
  }

  async putTwoFactorOrganizationDisable(
    organizationId: string,
    request: TwoFactorProviderRequest,
  ): Promise<TwoFactorProviderResponse> {
    const r = await this.send(
      "PUT",
      "/organizations/" + organizationId + "/two-factor/disable",
      request,
      true,
      true,
    );
    return new TwoFactorProviderResponse(r);
  }

  postTwoFactorEmailSetup(request: TwoFactorEmailRequest): Promise<any> {
    return this.send("POST", "/two-factor/send-email", request, true, false);
  }

  postTwoFactorEmail(request: TwoFactorEmailRequest): Promise<any> {
    return this.send("POST", "/two-factor/send-email-login", request, false, false);
  }

  async getDeviceVerificationSettings(): Promise<DeviceVerificationResponse> {
    const r = await this.send(
      "GET",
      "/two-factor/get-device-verification-settings",
      null,
      true,
      true,
    );
    return new DeviceVerificationResponse(r);
  }

  async putDeviceVerificationSettings(
    request: DeviceVerificationRequest,
  ): Promise<DeviceVerificationResponse> {
    const r = await this.send(
      "PUT",
      "/two-factor/device-verification-settings",
      request,
      true,
      true,
    );
    return new DeviceVerificationResponse(r);
  }

  // Organization APIs

  async getCloudCommunicationsEnabled(): Promise<boolean> {
    const r = await this.send("GET", "/organizations/connections/enabled", null, true, true);
    return r as boolean;
  }

  async getOrganizationConnection<TConfig extends OrganizationConnectionConfigApis>(
    id: string,
    type: OrganizationConnectionType,
    configType: { new (response: any): TConfig },
  ): Promise<OrganizationConnectionResponse<TConfig>> {
    const r = await this.send("GET", `/organizations/connections/${id}/${type}`, null, true, true);
    return new OrganizationConnectionResponse(r, configType);
  }

  async createOrganizationConnection<TConfig extends OrganizationConnectionConfigApis>(
    request: OrganizationConnectionRequest,
    configType: { new (response: any): TConfig },
  ): Promise<OrganizationConnectionResponse<TConfig>> {
    const r = await this.send("POST", "/organizations/connections/", request, true, true);
    return new OrganizationConnectionResponse(r, configType);
  }

  async updateOrganizationConnection<TConfig extends OrganizationConnectionConfigApis>(
    request: OrganizationConnectionRequest,
    configType: { new (response: any): TConfig },
    organizationConnectionId?: string,
  ): Promise<OrganizationConnectionResponse<TConfig>> {
    const r = await this.send(
      "PUT",
      "/organizations/connections/" + organizationConnectionId,
      request,
      true,
      true,
    );
    return new OrganizationConnectionResponse(r, configType);
  }

  async deleteOrganizationConnection(id: string): Promise<void> {
    return this.send("DELETE", "/organizations/connections/" + id, null, true, false);
  }

  // Provider User APIs

  async getProviderUsers(
    providerId: string,
  ): Promise<ListResponse<ProviderUserUserDetailsResponse>> {
    const r = await this.send("GET", "/providers/" + providerId + "/users", null, true, true);
    return new ListResponse(r, ProviderUserUserDetailsResponse);
  }

  async getProviderUser(providerId: string, id: string): Promise<ProviderUserResponse> {
    const r = await this.send("GET", "/providers/" + providerId + "/users/" + id, null, true, true);
    return new ProviderUserResponse(r);
  }

  postProviderUserInvite(providerId: string, request: ProviderUserInviteRequest): Promise<any> {
    return this.send("POST", "/providers/" + providerId + "/users/invite", request, true, false);
  }

  postProviderUserReinvite(providerId: string, id: string): Promise<any> {
    return this.send(
      "POST",
      "/providers/" + providerId + "/users/" + id + "/reinvite",
      null,
      true,
      false,
    );
  }

  async postManyProviderUserReinvite(
    providerId: string,
    request: ProviderUserBulkRequest,
  ): Promise<ListResponse<ProviderUserBulkResponse>> {
    const r = await this.send(
      "POST",
      "/providers/" + providerId + "/users/reinvite",
      request,
      true,
      true,
    );
    return new ListResponse(r, ProviderUserBulkResponse);
  }

  async postProviderUserBulkConfirm(
    providerId: string,
    request: ProviderUserBulkConfirmRequest,
  ): Promise<ListResponse<ProviderUserBulkResponse>> {
    const r = await this.send(
      "POST",
      "/providers/" + providerId + "/users/confirm",
      request,
      true,
      true,
    );
    return new ListResponse(r, ProviderUserBulkResponse);
  }

  async deleteManyProviderUsers(
    providerId: string,
    request: ProviderUserBulkRequest,
  ): Promise<ListResponse<ProviderUserBulkResponse>> {
    const r = await this.send("DELETE", "/providers/" + providerId + "/users", request, true, true);
    return new ListResponse(r, ProviderUserBulkResponse);
  }

  postProviderUserAccept(
    providerId: string,
    id: string,
    request: ProviderUserAcceptRequest,
  ): Promise<any> {
    return this.send(
      "POST",
      "/providers/" + providerId + "/users/" + id + "/accept",
      request,
      true,
      false,
    );
  }

  postProviderUserConfirm(
    providerId: string,
    id: string,
    request: ProviderUserConfirmRequest,
  ): Promise<any> {
    return this.send(
      "POST",
      "/providers/" + providerId + "/users/" + id + "/confirm",
      request,
      true,
      false,
    );
  }

  async postProviderUsersPublicKey(
    providerId: string,
    request: ProviderUserBulkRequest,
  ): Promise<ListResponse<ProviderUserBulkPublicKeyResponse>> {
    const r = await this.send(
      "POST",
      "/providers/" + providerId + "/users/public-keys",
      request,
      true,
      true,
    );
    return new ListResponse(r, ProviderUserBulkPublicKeyResponse);
  }

  putProviderUser(
    providerId: string,
    id: string,
    request: ProviderUserUpdateRequest,
  ): Promise<any> {
    return this.send("PUT", "/providers/" + providerId + "/users/" + id, request, true, false);
  }

  deleteProviderUser(providerId: string, id: string): Promise<any> {
    return this.send("DELETE", "/providers/" + providerId + "/users/" + id, null, true, false);
  }

  // Provider Organization APIs

  async getProviderClients(
    providerId: string,
  ): Promise<ListResponse<ProviderOrganizationOrganizationDetailsResponse>> {
    const r = await this.send(
      "GET",
      "/providers/" + providerId + "/organizations",
      null,
      true,
      true,
    );
    return new ListResponse(r, ProviderOrganizationOrganizationDetailsResponse);
  }

  postProviderAddOrganization(
    providerId: string,
    request: ProviderAddOrganizationRequest,
  ): Promise<any> {
    return this.send(
      "POST",
      "/providers/" + providerId + "/organizations/add",
      request,
      true,
      false,
    );
  }

  async postProviderCreateOrganization(
    providerId: string,
    request: ProviderOrganizationCreateRequest,
  ): Promise<ProviderOrganizationResponse> {
    const r = await this.send(
      "POST",
      "/providers/" + providerId + "/organizations",
      request,
      true,
      true,
    );
    return new ProviderOrganizationResponse(r);
  }

  deleteProviderOrganization(providerId: string, id: string): Promise<any> {
    return this.send(
      "DELETE",
      "/providers/" + providerId + "/organizations/" + id,
      null,
      true,
      false,
    );
  }

  // Event APIs

  async getEvents(start: string, end: string, token: string): Promise<ListResponse<EventResponse>> {
    const r = await this.send(
      "GET",
      this.addEventParameters("/events", start, end, token),
      null,
      true,
      true,
    );
    return new ListResponse(r, EventResponse);
  }

  async getEventsCipher(
    id: string,
    start: string,
    end: string,
    token: string,
  ): Promise<ListResponse<EventResponse>> {
    const r = await this.send(
      "GET",
      this.addEventParameters("/ciphers/" + id + "/events", start, end, token),
      null,
      true,
      true,
    );
    return new ListResponse(r, EventResponse);
  }

  async getEventsSecret(
    orgId: string,
    id: string,
    start: string,
    end: string,
    token: string,
  ): Promise<ListResponse<EventResponse>> {
    const r = await this.send(
      "GET",
      this.addEventParameters(
        "/organization/" + orgId + "/secrets/" + id + "/events",
        start,
        end,
        token,
      ),
      null,
      true,
      true,
    );
    return new ListResponse(r, EventResponse);
  }

  async getEventsProject(
    orgId: string,
    id: string,
    start: string,
    end: string,
    token: string,
  ): Promise<ListResponse<EventResponse>> {
    const r = await this.send(
      "GET",
      this.addEventParameters(
        "/organization/" + orgId + "/projects/" + id + "/events",
        start,
        end,
        token,
      ),
      null,
      true,
      true,
    );
    return new ListResponse(r, EventResponse);
  }

  async getEventsOrganization(
    id: string,
    start: string,
    end: string,
    token: string,
  ): Promise<ListResponse<EventResponse>> {
    const r = await this.send(
      "GET",
      this.addEventParameters("/organizations/" + id + "/events", start, end, token),
      null,
      true,
      true,
    );
    return new ListResponse(r, EventResponse);
  }

  async getEventsOrganizationUser(
    organizationId: string,
    id: string,
    start: string,
    end: string,
    token: string,
  ): Promise<ListResponse<EventResponse>> {
    const r = await this.send(
      "GET",
      this.addEventParameters(
        "/organizations/" + organizationId + "/users/" + id + "/events",
        start,
        end,
        token,
      ),
      null,
      true,
      true,
    );
    return new ListResponse(r, EventResponse);
  }

  async getEventsProvider(
    id: string,
    start: string,
    end: string,
    token: string,
  ): Promise<ListResponse<EventResponse>> {
    const r = await this.send(
      "GET",
      this.addEventParameters("/providers/" + id + "/events", start, end, token),
      null,
      true,
      true,
    );
    return new ListResponse(r, EventResponse);
  }

  async getEventsProviderUser(
    providerId: string,
    id: string,
    start: string,
    end: string,
    token: string,
  ): Promise<ListResponse<EventResponse>> {
    const r = await this.send(
      "GET",
      this.addEventParameters(
        "/providers/" + providerId + "/users/" + id + "/events",
        start,
        end,
        token,
      ),
      null,
      true,
      true,
    );
    return new ListResponse(r, EventResponse);
  }

  async postEventsCollect(request: EventRequest[], userId?: UserId): Promise<any> {
    const authHeader = await this.tokenService.getAccessToken(userId);
    const headers = new Headers({
      "Device-Type": this.deviceType,
      Authorization: "Bearer " + authHeader,
      "Content-Type": "application/json; charset=utf-8",
    });
    if (this.customUserAgent != null) {
      headers.set("User-Agent", this.customUserAgent);
    }

    const env = await firstValueFrom(
      userId == null
        ? this.environmentService.environment$
        : this.environmentService.getEnvironment$(userId),
    );
    const response = await this.fetch(
      this.httpOperations.createRequest(env.getEventsUrl() + "/collect", {
        cache: "no-store",
        credentials: await this.getCredentials(env),
        method: "POST",
        body: JSON.stringify(request),
        headers: headers,
      }),
    );
    if (response.status !== 200) {
      return Promise.reject("Event post failed.");
    }
  }

  // User APIs

  async getUserPublicKey(id: string): Promise<UserKeyResponse> {
    const r = await this.send("GET", "/users/" + id + "/public-key", null, true, true);
    return new UserKeyResponse(r);
  }

  // Misc

  async postBitPayInvoice(request: BitPayInvoiceRequest): Promise<string> {
    const r = await this.send("POST", "/bitpay-invoice", request, true, true);
    return r as string;
  }

  async postSetupPayment(): Promise<string> {
    const r = await this.send("POST", "/setup-payment", null, true, true);
    return r as string;
  }

  // Key Connector

  async getMasterKeyFromKeyConnector(
    keyConnectorUrl: string,
  ): Promise<KeyConnectorUserKeyResponse> {
    const activeUser = await this.getActiveUser();
    if (activeUser == null) {
      throw new Error("No active user, cannot get master key from key connector.");
    }
    const authHeader = await this.getActiveBearerToken(activeUser);

    const response = await this.fetch(
      this.httpOperations.createRequest(keyConnectorUrl + "/user-keys", {
        cache: "no-store",
        method: "GET",
        headers: new Headers({
          Accept: "application/json",
          Authorization: "Bearer " + authHeader,
        }),
      }),
    );

    if (response.status !== 200) {
      const error = await this.handleError(response, false, true);
      return Promise.reject(error);
    }

    return new KeyConnectorUserKeyResponse(await response.json());
  }

  async postUserKeyToKeyConnector(
    keyConnectorUrl: string,
    request: KeyConnectorUserKeyRequest,
  ): Promise<void> {
    const activeUser = await this.getActiveUser();
    if (activeUser == null) {
      throw new Error("No active user, cannot post key to key connector.");
    }
    const authHeader = await this.getActiveBearerToken(activeUser);

    const response = await this.fetch(
      this.httpOperations.createRequest(keyConnectorUrl + "/user-keys", {
        cache: "no-store",
        method: "POST",
        headers: new Headers({
          Accept: "application/json",
          Authorization: "Bearer " + authHeader,
          "Content-Type": "application/json; charset=utf-8",
        }),
        body: JSON.stringify(request),
      }),
    );

    if (response.status !== 200) {
      const error = await this.handleError(response, false, true);
      return Promise.reject(error);
    }
  }

  async getKeyConnectorAlive(keyConnectorUrl: string) {
    const response = await this.fetch(
      this.httpOperations.createRequest(keyConnectorUrl + "/alive", {
        cache: "no-store",
        method: "GET",
        headers: new Headers({
          Accept: "application/json",
          "Content-Type": "application/json; charset=utf-8",
        }),
      }),
    );

    if (response.status !== 200) {
      const error = await this.handleError(response, false, true);
      return Promise.reject(error);
    }
  }

  async getOrganizationExport(organizationId: string): Promise<OrganizationExportResponse> {
    const r = await this.send(
      "GET",
      "/organizations/" + organizationId + "/export",
      null,
      true,
      true,
    );
    return new OrganizationExportResponse(r);
  }

  // Helpers

  async getActiveBearerToken(userId: UserId): Promise<string> {
    let accessToken = await this.tokenService.getAccessToken(userId);
    if (await this.tokenService.tokenNeedsRefresh(userId)) {
      accessToken = await this.refreshToken(userId);
    }
    return accessToken;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method === "GET") {
      request.headers.set("Cache-Control", "no-store");
      request.headers.set("Pragma", "no-cache");
    }
    request.headers.set("Bitwarden-Client-Name", this.platformUtilsService.getClientType());
    request.headers.set(
      "Bitwarden-Client-Version",
      await this.platformUtilsService.getApplicationVersionNumber(),
    );
    return this.nativeFetch(request);
  }

  nativeFetch(request: Request): Promise<Response> {
    return fetch(request);
  }

  async preValidateSso(identifier: string): Promise<SsoPreValidateResponse> {
    if (identifier == null || identifier === "") {
      throw new Error("Organization Identifier was not provided.");
    }
    const headers = new Headers({
      Accept: "application/json",
      "Device-Type": this.deviceType,
    });
    if (this.customUserAgent != null) {
      headers.set("User-Agent", this.customUserAgent);
    }

    const env = await firstValueFrom(this.environmentService.environment$);
    const path = `/sso/prevalidate?domainHint=${encodeURIComponent(identifier)}`;
    const response = await this.fetch(
      this.httpOperations.createRequest(env.getIdentityUrl() + path, {
        cache: "no-store",
        credentials: await this.getCredentials(env),
        headers: headers,
        method: "GET",
      }),
    );

    if (response.status === 200) {
      const body = await response.json();
      return new SsoPreValidateResponse(body);
    } else {
      const error = await this.handleError(response, false, true);
      return Promise.reject(error);
    }
  }

  async postCreateSponsorship(
    sponsoredOrgId: string,
    request: OrganizationSponsorshipCreateRequest,
  ): Promise<void> {
    return await this.send(
      "POST",
      "/organization/sponsorship/" +
        (this.platformUtilsService.isSelfHost() ? "self-hosted/" : "") +
        sponsoredOrgId +
        "/families-for-enterprise",
      request,
      true,
      false,
    );
  }

  async getSponsorshipSyncStatus(
    sponsoredOrgId: string,
  ): Promise<OrganizationSponsorshipSyncStatusResponse> {
    const response = await this.send(
      "GET",
      "/organization/sponsorship/" + sponsoredOrgId + "/sync-status",
      null,
      true,
      true,
    );
    return new OrganizationSponsorshipSyncStatusResponse(response);
  }

  async deleteRemoveSponsorship(sponsoringOrgId: string): Promise<void> {
    return await this.send(
      "DELETE",
      "/organization/sponsorship/sponsored/" + sponsoringOrgId,
      null,
      true,
      false,
    );
  }

  async postPreValidateSponsorshipToken(
    sponsorshipToken: string,
  ): Promise<PreValidateSponsorshipResponse> {
    const response = await this.send(
      "POST",
      "/organization/sponsorship/validate-token?sponsorshipToken=" +
        encodeURIComponent(sponsorshipToken),
      null,
      true,
      true,
    );

    return new PreValidateSponsorshipResponse(response);
  }

  async postRedeemSponsorship(
    sponsorshipToken: string,
    request: OrganizationSponsorshipRedeemRequest,
  ): Promise<void> {
    return await this.send(
      "POST",
      "/organization/sponsorship/redeem?sponsorshipToken=" + encodeURIComponent(sponsorshipToken),
      request,
      true,
      false,
    );
  }

  // Keep the running refreshTokenPromise to prevent parallel calls.
  protected refreshToken(userId: UserId): Promise<string> {
    if (this.refreshTokenPromise[userId] === undefined) {
      // TODO: Have different promise for each user
      this.refreshTokenPromise[userId] = this.internalRefreshToken(userId);
      void this.refreshTokenPromise[userId].finally(() => {
        delete this.refreshTokenPromise[userId];
      });
    }
    return this.refreshTokenPromise[userId];
  }

  private async internalRefreshToken(userId: UserId): Promise<string> {
    const refreshToken = await this.tokenService.getRefreshToken(userId);
    if (refreshToken != null && refreshToken !== "") {
      return await this.refreshAccessToken(userId);
    }

    const clientId = await this.tokenService.getClientId(userId);
    const clientSecret = await this.tokenService.getClientSecret(userId);
    if (!Utils.isNullOrWhitespace(clientId) && !Utils.isNullOrWhitespace(clientSecret)) {
      return await this.refreshApiToken(userId);
    }

    this.refreshAccessTokenErrorCallback();

    throw new Error("Cannot refresh access token, no refresh token or api keys are stored.");
  }

  private async refreshAccessToken(userId: UserId): Promise<string> {
    const refreshToken = await this.tokenService.getRefreshToken(userId);
    if (refreshToken == null || refreshToken === "") {
      throw new Error();
    }
    const headers = new Headers({
      "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      Accept: "application/json",
      "Device-Type": this.deviceType,
    });
    if (this.customUserAgent != null) {
      headers.set("User-Agent", this.customUserAgent);
    }

    const env = await firstValueFrom(this.environmentService.getEnvironment$(userId));
    const decodedToken = await this.tokenService.decodeAccessToken(userId);
    const response = await this.fetch(
      this.httpOperations.createRequest(env.getIdentityUrl() + "/connect/token", {
        body: this.qsStringify({
          grant_type: "refresh_token",
          client_id: decodedToken.client_id,
          refresh_token: refreshToken,
        }),
        cache: "no-store",
        credentials: await this.getCredentials(env),
        headers: headers,
        method: "POST",
      }),
    );

    if (response.status === 200) {
      const responseJson = await response.json();
      const tokenResponse = new IdentityTokenResponse(responseJson);

      const newDecodedAccessToken = await this.tokenService.decodeAccessToken(
        tokenResponse.accessToken,
      );
      const userId = newDecodedAccessToken.sub;

      const vaultTimeoutAction = await firstValueFrom(
        this.vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$(userId),
      );
      const vaultTimeout = await firstValueFrom(
        this.vaultTimeoutSettingsService.getVaultTimeoutByUserId$(userId),
      );

      const refreshedTokens = await this.tokenService.setTokens(
        tokenResponse.accessToken,
        vaultTimeoutAction as VaultTimeoutAction,
        vaultTimeout,
        tokenResponse.refreshToken,
      );
      return refreshedTokens.accessToken;
    } else {
      const error = await this.handleError(response, true, true);
      return Promise.reject(error);
    }
  }

  protected async refreshApiToken(userId: UserId): Promise<string> {
    const clientId = await this.tokenService.getClientId(userId);
    const clientSecret = await this.tokenService.getClientSecret(userId);

    const appId = await this.appIdService.getAppId();
    const deviceRequest = new DeviceRequest(appId, this.platformUtilsService);
    const tokenRequest = new UserApiTokenRequest(
      clientId,
      clientSecret,
      new TokenTwoFactorRequest(),
      deviceRequest,
    );

    const response = await this.postIdentityToken(tokenRequest);
    if (!(response instanceof IdentityTokenResponse)) {
      throw new Error("Invalid response received when refreshing api token");
    }

    const newDecodedAccessToken = await this.tokenService.decodeAccessToken(response.accessToken);

    if (newDecodedAccessToken.sub !== userId) {
      throw new Error(
        `Token was supposed to be refreshed for ${userId} but the token we got back was for ${newDecodedAccessToken.sub}`,
      );
    }

    const vaultTimeoutAction = await firstValueFrom(
      this.vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$(userId),
    );
    const vaultTimeout = await firstValueFrom(
      this.vaultTimeoutSettingsService.getVaultTimeoutByUserId$(userId),
    );

    const refreshedToken = await this.tokenService.setAccessToken(
      response.accessToken,
      vaultTimeoutAction as VaultTimeoutAction,
      vaultTimeout,
    );
    return refreshedToken;
  }

  async send(
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
    path: string,
    body: any,
    authedOrUserId: UserId | boolean,
    hasResponse: boolean,
    apiUrl?: string | null,
    alterHeaders?: (headers: Headers) => void,
  ): Promise<any> {
    if (authedOrUserId == null) {
      throw new Error("A user id was given but it was null, cannot complete API request.");
    }

    let userId: UserId | null = null;
    if (typeof authedOrUserId === "boolean" && authedOrUserId) {
      // Backwards compatible for authenticating the active user when `true` is passed in
      userId = await this.getActiveUser();
    } else if (typeof authedOrUserId === "string") {
      userId = authedOrUserId;
    }

    const env = await firstValueFrom(
      userId == null
        ? this.environmentService.environment$
        : this.environmentService.getEnvironment$(userId),
    );
    apiUrl = Utils.isNullOrWhitespace(apiUrl) ? env.getApiUrl() : apiUrl;

    // Prevent directory traversal from malicious paths
    const pathParts = path.split("?");
    const requestUrl =
      apiUrl + Utils.normalizePath(pathParts[0]) + (pathParts.length > 1 ? `?${pathParts[1]}` : "");

    const [requestHeaders, requestBody] = await this.buildHeadersAndBody(
      userId,
      hasResponse,
      body,
      alterHeaders,
    );

    const requestInit: RequestInit = {
      cache: "no-store",
      credentials: await this.getCredentials(env),
      method: method,
    };
    requestInit.headers = requestHeaders;
    requestInit.body = requestBody;
    const response = await this.fetch(this.httpOperations.createRequest(requestUrl, requestInit));

    const responseType = response.headers.get("content-type");
    const responseIsJson = responseType != null && responseType.indexOf("application/json") !== -1;
    const responseIsCsv = responseType != null && responseType.indexOf("text/csv") !== -1;
    if (hasResponse && response.status === 200 && responseIsJson) {
      const responseJson = await response.json();
      return responseJson;
    } else if (hasResponse && response.status === 200 && responseIsCsv) {
      return await response.text();
    } else if (response.status !== 200 && response.status !== 204) {
      const error = await this.handleError(response, false, userId != null);
      return Promise.reject(error);
    }
  }

  private async buildHeadersAndBody(
    userToAuthenticate: UserId | null,
    hasResponse: boolean,
    body: any,
    alterHeaders: (headers: Headers) => void,
  ): Promise<[Headers, any]> {
    let requestBody: any = null;
    const headers = new Headers({
      "Device-Type": this.deviceType,
    });

    if (flagEnabled("prereleaseBuild")) {
      headers.set("Is-Prerelease", "1");
    }
    if (this.customUserAgent != null) {
      headers.set("User-Agent", this.customUserAgent);
    }
    if (hasResponse) {
      headers.set("Accept", "application/json");
    }
    if (alterHeaders != null) {
      alterHeaders(headers);
    }
    if (userToAuthenticate != null) {
      const authHeader = await this.getActiveBearerToken(userToAuthenticate);
      headers.set("Authorization", "Bearer " + authHeader);
    } else {
      // For unauthenticated requests, we need to tell the server what the device is for flag targeting,
      // since it won't be able to get it from the access token.
      const appId = await this.appIdService.getAppId();
      headers.set("Device-Identifier", appId);
    }

    if (body != null) {
      if (typeof body === "string") {
        requestBody = body;
        headers.set("Content-Type", "application/x-www-form-urlencoded; charset=utf-8");
      } else if (typeof body === "object") {
        if (body instanceof FormData) {
          requestBody = body;
        } else {
          headers.set("Content-Type", "application/json; charset=utf-8");
          requestBody = JSON.stringify(body);
        }
      }
    }

    return [headers, requestBody];
  }

  private async handleError(
    response: Response,
    tokenError: boolean,
    authed: boolean,
  ): Promise<ErrorResponse> {
    let responseJson: any = null;
    if (this.isJsonResponse(response)) {
      responseJson = await response.json();
    } else if (this.isTextPlainResponse(response)) {
      responseJson = { Message: await response.text() };
    }

    if (authed) {
      if (
        response.status === 401 ||
        response.status === 403 ||
        (tokenError &&
          response.status === 400 &&
          responseJson != null &&
          responseJson.error === "invalid_grant")
      ) {
        await this.logoutCallback("invalidGrantError");
      }
    }

    return new ErrorResponse(responseJson, response.status, tokenError);
  }

  private qsStringify(params: any): string {
    return Object.keys(params)
      .map((key) => {
        return encodeURIComponent(key) + "=" + encodeURIComponent(params[key]);
      })
      .join("&");
  }

  private async getActiveUser(): Promise<UserId | null> {
    return await firstValueFrom(this.accountService.activeAccount$.pipe(map((a) => a?.id)));
  }

  private async getCredentials(env: Environment): Promise<RequestCredentials> {
    if (this.platformUtilsService.getClientType() !== ClientType.Web || env.hasBaseUrl()) {
      return "include";
    }
    return undefined;
  }

  private addEventParameters(base: string, start: string, end: string, token: string) {
    if (start != null) {
      base += "?start=" + start;
    }
    if (end != null) {
      base += base.indexOf("?") > -1 ? "&" : "?";
      base += "end=" + end;
    }
    if (token != null) {
      base += base.indexOf("?") > -1 ? "&" : "?";
      base += "continuationToken=" + token;
    }
    return base;
  }

  private isJsonResponse(response: Response): boolean {
    const typeHeader = response.headers.get("content-type");
    return typeHeader != null && typeHeader.indexOf("application/json") > -1;
  }

  private isTextPlainResponse(response: Response): boolean {
    const typeHeader = response.headers.get("content-type");
    return typeHeader != null && typeHeader.indexOf("text/plain") > -1;
  }
}
