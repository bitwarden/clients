import { ApiService as ApiServiceAbstraction } from "../abstractions/api.service";
import { AppIdService } from "../abstractions/appId.service";
import { EnvironmentService } from "../abstractions/environment.service";
import { PlatformUtilsService } from "../abstractions/platformUtils.service";
import { TokenService } from "../abstractions/token.service";
import { DeviceType } from "../enums/deviceType";
import { OrganizationApiKeyType } from "../enums/organizationApiKeyType";
import { OrganizationConnectionType } from "../enums/organizationConnectionType";
import { PolicyType } from "../enums/policyType";
import { Utils } from "../misc/utils";
import { SetKeyConnectorKeyRequest } from "../models/request/account/setKeyConnectorKeyRequest";
import { VerifyOTPRequest } from "../models/request/account/verifyOTPRequest";
import { AttachmentRequest } from "../models/request/attachmentRequest";
import { BitPayInvoiceRequest } from "../models/request/bitPayInvoiceRequest";
import { CipherBulkDeleteRequest } from "../models/request/cipherBulkDeleteRequest";
import { CipherBulkMoveRequest } from "../models/request/cipherBulkMoveRequest";
import { CipherBulkShareRequest } from "../models/request/cipherBulkShareRequest";
import { CipherCollectionsRequest } from "../models/request/cipherCollectionsRequest";
import { CipherCreateRequest } from "../models/request/cipherCreateRequest";
import { CipherRequest } from "../models/request/cipherRequest";
import { CipherShareRequest } from "../models/request/cipherShareRequest";
import { CollectionRequest } from "../models/request/collectionRequest";
import { DeleteRecoverRequest } from "../models/request/deleteRecoverRequest";
import { DeviceRequest } from "../models/request/deviceRequest";
import { DeviceVerificationRequest } from "../models/request/deviceVerificationRequest";
import { EmailRequest } from "../models/request/emailRequest";
import { EmailTokenRequest } from "../models/request/emailTokenRequest";
import { EmergencyAccessAcceptRequest } from "../models/request/emergencyAccessAcceptRequest";
import { EmergencyAccessConfirmRequest } from "../models/request/emergencyAccessConfirmRequest";
import { EmergencyAccessInviteRequest } from "../models/request/emergencyAccessInviteRequest";
import { EmergencyAccessPasswordRequest } from "../models/request/emergencyAccessPasswordRequest";
import { EmergencyAccessUpdateRequest } from "../models/request/emergencyAccessUpdateRequest";
import { EventRequest } from "../models/request/eventRequest";
import { GroupRequest } from "../models/request/groupRequest";
import { IapCheckRequest } from "../models/request/iapCheckRequest";
import { ApiTokenRequest } from "../models/request/identityToken/apiTokenRequest";
import { PasswordTokenRequest } from "../models/request/identityToken/passwordTokenRequest";
import { SsoTokenRequest } from "../models/request/identityToken/ssoTokenRequest";
import { TokenRequestTwoFactor } from "../models/request/identityToken/tokenRequestTwoFactor";
import { ImportCiphersRequest } from "../models/request/importCiphersRequest";
import { ImportDirectoryRequest } from "../models/request/importDirectoryRequest";
import { ImportOrganizationCiphersRequest } from "../models/request/importOrganizationCiphersRequest";
import { KdfRequest } from "../models/request/kdfRequest";
import { KeyConnectorUserKeyRequest } from "../models/request/keyConnectorUserKeyRequest";
import { KeysRequest } from "../models/request/keysRequest";
import { OrganizationSponsorshipCreateRequest } from "../models/request/organization/organizationSponsorshipCreateRequest";
import { OrganizationSponsorshipRedeemRequest } from "../models/request/organization/organizationSponsorshipRedeemRequest";
import { OrganizationSsoRequest } from "../models/request/organization/organizationSsoRequest";
import { OrganizationApiKeyRequest } from "../models/request/organizationApiKeyRequest";
import { OrganizationConnectionRequest } from "../models/request/organizationConnectionRequest";
import { OrganizationCreateRequest } from "../models/request/organizationCreateRequest";
import { OrganizationImportRequest } from "../models/request/organizationImportRequest";
import { OrganizationKeysRequest } from "../models/request/organizationKeysRequest";
import { OrganizationSubscriptionUpdateRequest } from "../models/request/organizationSubscriptionUpdateRequest";
import { OrganizationTaxInfoUpdateRequest } from "../models/request/organizationTaxInfoUpdateRequest";
import { OrganizationUpdateRequest } from "../models/request/organizationUpdateRequest";
import { OrganizationUpgradeRequest } from "../models/request/organizationUpgradeRequest";
import { OrganizationUserAcceptRequest } from "../models/request/organizationUserAcceptRequest";
import { OrganizationUserBulkConfirmRequest } from "../models/request/organizationUserBulkConfirmRequest";
import { OrganizationUserBulkRequest } from "../models/request/organizationUserBulkRequest";
import { OrganizationUserConfirmRequest } from "../models/request/organizationUserConfirmRequest";
import { OrganizationUserInviteRequest } from "../models/request/organizationUserInviteRequest";
import { OrganizationUserResetPasswordEnrollmentRequest } from "../models/request/organizationUserResetPasswordEnrollmentRequest";
import { OrganizationUserResetPasswordRequest } from "../models/request/organizationUserResetPasswordRequest";
import { OrganizationUserUpdateGroupsRequest } from "../models/request/organizationUserUpdateGroupsRequest";
import { OrganizationUserUpdateRequest } from "../models/request/organizationUserUpdateRequest";
import { PasswordHintRequest } from "../models/request/passwordHintRequest";
import { PasswordRequest } from "../models/request/passwordRequest";
import { PaymentRequest } from "../models/request/paymentRequest";
import { PolicyRequest } from "../models/request/policyRequest";
import { PreloginRequest } from "../models/request/preloginRequest";
import { ProviderAddOrganizationRequest } from "../models/request/provider/providerAddOrganizationRequest";
import { ProviderOrganizationCreateRequest } from "../models/request/provider/providerOrganizationCreateRequest";
import { ProviderUserAcceptRequest } from "../models/request/provider/providerUserAcceptRequest";
import { ProviderUserBulkConfirmRequest } from "../models/request/provider/providerUserBulkConfirmRequest";
import { ProviderUserBulkRequest } from "../models/request/provider/providerUserBulkRequest";
import { ProviderUserConfirmRequest } from "../models/request/provider/providerUserConfirmRequest";
import { ProviderUserInviteRequest } from "../models/request/provider/providerUserInviteRequest";
import { ProviderUserUpdateRequest } from "../models/request/provider/providerUserUpdateRequest";
import { RegisterRequest } from "../models/request/registerRequest";
import { SeatRequest } from "../models/request/seatRequest";
import { SecretVerificationRequest } from "../models/request/secretVerificationRequest";
import { SelectionReadOnlyRequest } from "../models/request/selectionReadOnlyRequest";
import { SendAccessRequest } from "../models/request/sendAccessRequest";
import { SendRequest } from "../models/request/sendRequest";
import { SetPasswordRequest } from "../models/request/setPasswordRequest";
import { StorageRequest } from "../models/request/storageRequest";
import { TaxInfoUpdateRequest } from "../models/request/taxInfoUpdateRequest";
import { TwoFactorEmailRequest } from "../models/request/twoFactorEmailRequest";
import { TwoFactorProviderRequest } from "../models/request/twoFactorProviderRequest";
import { TwoFactorRecoveryRequest } from "../models/request/twoFactorRecoveryRequest";
import { UpdateDomainsRequest } from "../models/request/updateDomainsRequest";
import { UpdateKeyRequest } from "../models/request/updateKeyRequest";
import { UpdateProfileRequest } from "../models/request/updateProfileRequest";
import { UpdateTempPasswordRequest } from "../models/request/updateTempPasswordRequest";
import { UpdateTwoFactorAuthenticatorRequest } from "../models/request/updateTwoFactorAuthenticatorRequest";
import { UpdateTwoFactorDuoRequest } from "../models/request/updateTwoFactorDuoRequest";
import { UpdateTwoFactorEmailRequest } from "../models/request/updateTwoFactorEmailRequest";
import { UpdateTwoFactorWebAuthnDeleteRequest } from "../models/request/updateTwoFactorWebAuthnDeleteRequest";
import { UpdateTwoFactorWebAuthnRequest } from "../models/request/updateTwoFactorWebAuthnRequest";
import { UpdateTwoFactorYubioOtpRequest } from "../models/request/updateTwoFactorYubioOtpRequest";
import { VerifyBankRequest } from "../models/request/verifyBankRequest";
import { VerifyDeleteRecoverRequest } from "../models/request/verifyDeleteRecoverRequest";
import { VerifyEmailRequest } from "../models/request/verifyEmailRequest";
import { ApiKeyResponse } from "../models/response/apiKeyResponse";
import { AttachmentResponse } from "../models/response/attachmentResponse";
import { AttachmentUploadDataResponse } from "../models/response/attachmentUploadDataResponse";
import { BillingHistoryResponse } from "../models/response/billingHistoryResponse";
import { BillingPaymentResponse } from "../models/response/billingPaymentResponse";
import { BillingResponse } from "../models/response/billingResponse";
import { BreachAccountResponse } from "../models/response/breachAccountResponse";
import { CipherResponse } from "../models/response/cipherResponse";
import {
  CollectionGroupDetailsResponse,
  CollectionResponse,
} from "../models/response/collectionResponse";
import { DeviceVerificationResponse } from "../models/response/deviceVerificationResponse";
import { DomainsResponse } from "../models/response/domainsResponse";
import {
  EmergencyAccessGranteeDetailsResponse,
  EmergencyAccessGrantorDetailsResponse,
  EmergencyAccessTakeoverResponse,
  EmergencyAccessViewResponse,
} from "../models/response/emergencyAccessResponse";
import { ErrorResponse } from "../models/response/errorResponse";
import { EventResponse } from "../models/response/eventResponse";
import { GroupDetailsResponse, GroupResponse } from "../models/response/groupResponse";
import { IdentityCaptchaResponse } from "../models/response/identityCaptchaResponse";
import { IdentityTokenResponse } from "../models/response/identityTokenResponse";
import { IdentityTwoFactorResponse } from "../models/response/identityTwoFactorResponse";
import { KeyConnectorUserKeyResponse } from "../models/response/keyConnectorUserKeyResponse";
import { ListResponse } from "../models/response/listResponse";
import { OrganizationSsoResponse } from "../models/response/organization/organizationSsoResponse";
import { OrganizationApiKeyInformationResponse } from "../models/response/organizationApiKeyInformationResponse";
import { OrganizationAutoEnrollStatusResponse } from "../models/response/organizationAutoEnrollStatusResponse";
import {
  OrganizationConnectionConfigApis,
  OrganizationConnectionResponse,
} from "../models/response/organizationConnectionResponse";
import { OrganizationExportResponse } from "../models/response/organizationExportResponse";
import { OrganizationKeysResponse } from "../models/response/organizationKeysResponse";
import { OrganizationResponse } from "../models/response/organizationResponse";
import { OrganizationSponsorshipSyncStatusResponse } from "../models/response/organizationSponsorshipSyncStatusResponse";
import { OrganizationSubscriptionResponse } from "../models/response/organizationSubscriptionResponse";
import { OrganizationUserBulkPublicKeyResponse } from "../models/response/organizationUserBulkPublicKeyResponse";
import { OrganizationUserBulkResponse } from "../models/response/organizationUserBulkResponse";
import {
  OrganizationUserDetailsResponse,
  OrganizationUserResetPasswordDetailsReponse,
  OrganizationUserUserDetailsResponse,
} from "../models/response/organizationUserResponse";
import { PaymentResponse } from "../models/response/paymentResponse";
import { PlanResponse } from "../models/response/planResponse";
import { PolicyResponse } from "../models/response/policyResponse";
import { PreloginResponse } from "../models/response/preloginResponse";
import { ProfileResponse } from "../models/response/profileResponse";
import {
  ProviderOrganizationOrganizationDetailsResponse,
  ProviderOrganizationResponse,
} from "../models/response/provider/providerOrganizationResponse";
import { ProviderUserBulkPublicKeyResponse } from "../models/response/provider/providerUserBulkPublicKeyResponse";
import { ProviderUserBulkResponse } from "../models/response/provider/providerUserBulkResponse";
import {
  ProviderUserResponse,
  ProviderUserUserDetailsResponse,
} from "../models/response/provider/providerUserResponse";
import { SelectionReadOnlyResponse } from "../models/response/selectionReadOnlyResponse";
import { SendAccessResponse } from "../models/response/sendAccessResponse";
import { SendFileDownloadDataResponse } from "../models/response/sendFileDownloadDataResponse";
import { SendFileUploadDataResponse } from "../models/response/sendFileUploadDataResponse";
import { SendResponse } from "../models/response/sendResponse";
import { SsoPreValidateResponse } from "../models/response/ssoPreValidateResponse";
import { SubscriptionResponse } from "../models/response/subscriptionResponse";
import { SyncResponse } from "../models/response/syncResponse";
import { TaxInfoResponse } from "../models/response/taxInfoResponse";
import { TaxRateResponse } from "../models/response/taxRateResponse";
import { TwoFactorAuthenticatorResponse } from "../models/response/twoFactorAuthenticatorResponse";
import { TwoFactorDuoResponse } from "../models/response/twoFactorDuoResponse";
import { TwoFactorEmailResponse } from "../models/response/twoFactorEmailResponse";
import { TwoFactorProviderResponse } from "../models/response/twoFactorProviderResponse";
import { TwoFactorRecoverResponse } from "../models/response/twoFactorRescoverResponse";
import {
  TwoFactorWebAuthnResponse,
  ChallengeResponse,
} from "../models/response/twoFactorWebAuthnResponse";
import { TwoFactorYubiKeyResponse } from "../models/response/twoFactorYubiKeyResponse";
import { UserKeyResponse } from "../models/response/userKeyResponse";
import { SendAccessView } from "../models/view/sendAccessView";

export class ApiService implements ApiServiceAbstraction {
  private device: DeviceType;
  private deviceType: string;
  private isWebClient = false;
  private isDesktopClient = false;

  constructor(
    private tokenService: TokenService,
    private platformUtilsService: PlatformUtilsService,
    private environmentService: EnvironmentService,
    private appIdService: AppIdService,
    private logoutCallback: (expired: boolean) => Promise<void>,
    private customUserAgent: string = null
  ) {
    this.device = platformUtilsService.getDevice();
    this.deviceType = this.device.toString();
    this.isWebClient =
      this.device === DeviceType.IEBrowser ||
      this.device === DeviceType.ChromeBrowser ||
      this.device === DeviceType.EdgeBrowser ||
      this.device === DeviceType.FirefoxBrowser ||
      this.device === DeviceType.OperaBrowser ||
      this.device === DeviceType.SafariBrowser ||
      this.device === DeviceType.UnknownBrowser ||
      this.device === DeviceType.VivaldiBrowser;
    this.isDesktopClient =
      this.device === DeviceType.WindowsDesktop ||
      this.device === DeviceType.MacOsDesktop ||
      this.device === DeviceType.LinuxDesktop;
  }

  // Auth APIs

  async postIdentityToken(
    request: ApiTokenRequest | PasswordTokenRequest | SsoTokenRequest
  ): Promise<IdentityTokenResponse | IdentityTwoFactorResponse | IdentityCaptchaResponse> {
    const headers = new Headers({
      "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      Accept: "application/json",
      "Device-Type": this.deviceType,
    });
    if (this.customUserAgent != null) {
      headers.set("User-Agent", this.customUserAgent);
    }
    request.alterIdentityTokenHeaders(headers);

    const identityToken =
      request instanceof ApiTokenRequest
        ? request.toIdentityToken()
        : request.toIdentityToken(this.platformUtilsService.getClientType());

    const response = await this.fetch(
      new Request(this.environmentService.getIdentityUrl() + "/connect/token", {
        body: this.qsStringify(identityToken),
        credentials: this.getCredentials(),
        cache: "no-store",
        headers: headers,
        method: "POST",
      })
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
        await this.tokenService.clearTwoFactorToken();
        return new IdentityTwoFactorResponse(responseJson);
      } else if (
        response.status === 400 &&
        responseJson.HCaptcha_SiteKey &&
        Object.keys(responseJson.HCaptcha_SiteKey).length
      ) {
        return new IdentityCaptchaResponse(responseJson);
      }
    }

    return Promise.reject(new ErrorResponse(responseJson, response.status, true));
  }

  async refreshIdentityToken(): Promise<any> {
    try {
      await this.doAuthRefresh();
    } catch (e) {
      return Promise.reject(null);
    }
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

  putTaxInfo(request: TaxInfoUpdateRequest): Promise<any> {
    return this.send("PUT", "/accounts/tax", request, true, false);
  }

  async postPrelogin(request: PreloginRequest): Promise<PreloginResponse> {
    const r = await this.send(
      "POST",
      "/accounts/prelogin",
      request,
      false,
      true,
      this.platformUtilsService.isDev()
        ? this.environmentService.getIdentityUrl()
        : this.environmentService.getApiUrl()
    );
    return new PreloginResponse(r);
  }

  postEmailToken(request: EmailTokenRequest): Promise<any> {
    return this.send("POST", "/accounts/email-token", request, true, false);
  }

  postEmail(request: EmailRequest): Promise<any> {
    return this.send("POST", "/accounts/email", request, true, false);
  }

  postPassword(request: PasswordRequest): Promise<any> {
    return this.send("POST", "/accounts/password", request, true, false);
  }

  setPassword(request: SetPasswordRequest): Promise<any> {
    return this.send("POST", "/accounts/set-password", request, true, false);
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

  postRegister(request: RegisterRequest): Promise<any> {
    return this.send(
      "POST",
      "/accounts/register",
      request,
      false,
      false,
      this.platformUtilsService.isDev()
        ? this.environmentService.getIdentityUrl()
        : this.environmentService.getApiUrl()
    );
  }

  async postPremium(data: FormData): Promise<PaymentResponse> {
    const r = await this.send("POST", "/accounts/premium", data, true, true);
    return new PaymentResponse(r);
  }

  async postIapCheck(request: IapCheckRequest): Promise<any> {
    return this.send("POST", "/accounts/iap-check", request, true, false);
  }

  postReinstatePremium(): Promise<any> {
    return this.send("POST", "/accounts/reinstate-premium", null, true, false);
  }

  postCancelPremium(): Promise<any> {
    return this.send("POST", "/accounts/cancel-premium", null, true, false);
  }

  async postAccountStorage(request: StorageRequest): Promise<PaymentResponse> {
    const r = await this.send("POST", "/accounts/storage", request, true, true);
    return new PaymentResponse(r);
  }

  postAccountPayment(request: PaymentRequest): Promise<any> {
    return this.send("POST", "/accounts/payment", request, true, false);
  }

  postAccountLicense(data: FormData): Promise<any> {
    return this.send("POST", "/accounts/license", data, true, false);
  }

  postAccountKeys(request: KeysRequest): Promise<any> {
    return this.send("POST", "/accounts/keys", request, true, false);
  }

  postAccountKey(request: UpdateKeyRequest): Promise<any> {
    return this.send("POST", "/accounts/key", request, true, false);
  }

  postAccountVerifyEmail(): Promise<any> {
    return this.send("POST", "/accounts/verify-email", null, true, false);
  }

  postAccountVerifyEmailToken(request: VerifyEmailRequest): Promise<any> {
    return this.send("POST", "/accounts/verify-email-token", request, false, false);
  }

  postAccountVerifyPassword(request: SecretVerificationRequest): Promise<any> {
    return this.send("POST", "/accounts/verify-password", request, true, false);
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

  async deleteSsoUser(organizationId: string): Promise<any> {
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
    request: SecretVerificationRequest
  ): Promise<ApiKeyResponse> {
    const r = await this.send("POST", "/accounts/rotate-api-key", request, true, true);
    return new ApiKeyResponse(r);
  }

  putUpdateTempPassword(request: UpdateTempPasswordRequest): Promise<any> {
    return this.send("PUT", "/accounts/update-temp-password", request, true, false);
  }

  postAccountRequestOTP(): Promise<void> {
    return this.send("POST", "/accounts/request-otp", null, true, false);
  }

  postAccountVerifyOTP(request: VerifyOTPRequest): Promise<void> {
    return this.send("POST", "/accounts/verify-otp", request, true, false);
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

  // Send APIs

  async getSend(id: string): Promise<SendResponse> {
    const r = await this.send("GET", "/sends/" + id, null, true, true);
    return new SendResponse(r);
  }

  async postSendAccess(
    id: string,
    request: SendAccessRequest,
    apiUrl?: string
  ): Promise<SendAccessResponse> {
    const addSendIdHeader = (headers: Headers) => {
      headers.set("Send-Id", id);
    };
    const r = await this.send(
      "POST",
      "/sends/access/" + id,
      request,
      false,
      true,
      apiUrl,
      addSendIdHeader
    );
    return new SendAccessResponse(r);
  }

  async getSendFileDownloadData(
    send: SendAccessView,
    request: SendAccessRequest,
    apiUrl?: string
  ): Promise<SendFileDownloadDataResponse> {
    const addSendIdHeader = (headers: Headers) => {
      headers.set("Send-Id", send.id);
    };
    const r = await this.send(
      "POST",
      "/sends/" + send.id + "/access/file/" + send.file.id,
      request,
      false,
      true,
      apiUrl,
      addSendIdHeader
    );
    return new SendFileDownloadDataResponse(r);
  }

  async getSends(): Promise<ListResponse<SendResponse>> {
    const r = await this.send("GET", "/sends", null, true, true);
    return new ListResponse(r, SendResponse);
  }

  async postSend(request: SendRequest): Promise<SendResponse> {
    const r = await this.send("POST", "/sends", request, true, true);
    return new SendResponse(r);
  }

  async postFileTypeSend(request: SendRequest): Promise<SendFileUploadDataResponse> {
    const r = await this.send("POST", "/sends/file/v2", request, true, true);
    return new SendFileUploadDataResponse(r);
  }

  async renewSendFileUploadUrl(
    sendId: string,
    fileId: string
  ): Promise<SendFileUploadDataResponse> {
    const r = await this.send("GET", "/sends/" + sendId + "/file/" + fileId, null, true, true);
    return new SendFileUploadDataResponse(r);
  }

  postSendFile(sendId: string, fileId: string, data: FormData): Promise<any> {
    return this.send("POST", "/sends/" + sendId + "/file/" + fileId, data, true, false);
  }

  /**
   * @deprecated Mar 25 2021: This method has been deprecated in favor of direct uploads.
   * This method still exists for backward compatibility with old server versions.
   */
  async postSendFileLegacy(data: FormData): Promise<SendResponse> {
    const r = await this.send("POST", "/sends/file", data, true, true);
    return new SendResponse(r);
  }

  async putSend(id: string, request: SendRequest): Promise<SendResponse> {
    const r = await this.send("PUT", "/sends/" + id, request, true, true);
    return new SendResponse(r);
  }

  async putSendRemovePassword(id: string): Promise<SendResponse> {
    const r = await this.send("PUT", "/sends/" + id + "/remove-password", null, true, true);
    return new SendResponse(r);
  }

  deleteSend(id: string): Promise<any> {
    return this.send("DELETE", "/sends/" + id, null, true, false);
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
      true
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

  putShareCiphers(request: CipherBulkShareRequest): Promise<any> {
    return this.send("PUT", "/ciphers/share", request, true, false);
  }

  putCipherCollections(id: string, request: CipherCollectionsRequest): Promise<any> {
    return this.send("PUT", "/ciphers/" + id + "/collections", request, true, false);
  }

  putCipherCollectionsAdmin(id: string, request: CipherCollectionsRequest): Promise<any> {
    return this.send("PUT", "/ciphers/" + id + "/collections-admin", request, true, false);
  }

  postPurgeCiphers(
    request: SecretVerificationRequest,
    organizationId: string = null
  ): Promise<any> {
    let path = "/ciphers/purge";
    if (organizationId != null) {
      path += "?organizationId=" + organizationId;
    }
    return this.send("POST", path, request, true, false);
  }

  postImportCiphers(request: ImportCiphersRequest): Promise<any> {
    return this.send("POST", "/ciphers/import", request, true, false);
  }

  postImportOrganizationCiphers(
    organizationId: string,
    request: ImportOrganizationCiphersRequest
  ): Promise<any> {
    return this.send(
      "POST",
      "/ciphers/import-organization?organizationId=" + organizationId,
      request,
      true,
      false
    );
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
    request: CipherBulkDeleteRequest
  ): Promise<ListResponse<CipherResponse>> {
    const r = await this.send("PUT", "/ciphers/restore", request, true, true);
    return new ListResponse<CipherResponse>(r, CipherResponse);
  }

  // Attachments APIs

  async getAttachmentData(
    cipherId: string,
    attachmentId: string,
    emergencyAccessId?: string
  ): Promise<AttachmentResponse> {
    const path =
      (emergencyAccessId != null ? "/emergency-access/" + emergencyAccessId + "/" : "/ciphers/") +
      cipherId +
      "/attachment/" +
      attachmentId;
    const r = await this.send("GET", path, null, true, true);
    return new AttachmentResponse(r);
  }

  async postCipherAttachment(
    id: string,
    request: AttachmentRequest
  ): Promise<AttachmentUploadDataResponse> {
    const r = await this.send("POST", "/ciphers/" + id + "/attachment/v2", request, true, true);
    return new AttachmentUploadDataResponse(r);
  }

  /**
   * @deprecated Mar 25 2021: This method has been deprecated in favor of direct uploads.
   * This method still exists for backward compatibility with old server versions.
   */
  async postCipherAttachmentLegacy(id: string, data: FormData): Promise<CipherResponse> {
    const r = await this.send("POST", "/ciphers/" + id + "/attachment", data, true, true);
    return new CipherResponse(r);
  }

  /**
   * @deprecated Mar 25 2021: This method has been deprecated in favor of direct uploads.
   * This method still exists for backward compatibility with old server versions.
   */
  async postCipherAttachmentAdminLegacy(id: string, data: FormData): Promise<CipherResponse> {
    const r = await this.send("POST", "/ciphers/" + id + "/attachment-admin", data, true, true);
    return new CipherResponse(r);
  }

  deleteCipherAttachment(id: string, attachmentId: string): Promise<any> {
    return this.send("DELETE", "/ciphers/" + id + "/attachment/" + attachmentId, null, true, false);
  }

  deleteCipherAttachmentAdmin(id: string, attachmentId: string): Promise<any> {
    return this.send(
      "DELETE",
      "/ciphers/" + id + "/attachment/" + attachmentId + "/admin",
      null,
      true,
      false
    );
  }

  postShareCipherAttachment(
    id: string,
    attachmentId: string,
    data: FormData,
    organizationId: string
  ): Promise<any> {
    return this.send(
      "POST",
      "/ciphers/" + id + "/attachment/" + attachmentId + "/share?organizationId=" + organizationId,
      data,
      true,
      false
    );
  }

  async renewAttachmentUploadUrl(
    id: string,
    attachmentId: string
  ): Promise<AttachmentUploadDataResponse> {
    const r = await this.send(
      "GET",
      "/ciphers/" + id + "/attachment/" + attachmentId + "/renew",
      null,
      true,
      true
    );
    return new AttachmentUploadDataResponse(r);
  }

  postAttachmentFile(id: string, attachmentId: string, data: FormData): Promise<any> {
    return this.send("POST", "/ciphers/" + id + "/attachment/" + attachmentId, data, true, false);
  }

  // Collections APIs

  async getCollectionDetails(
    organizationId: string,
    id: string
  ): Promise<CollectionGroupDetailsResponse> {
    const r = await this.send(
      "GET",
      "/organizations/" + organizationId + "/collections/" + id + "/details",
      null,
      true,
      true
    );
    return new CollectionGroupDetailsResponse(r);
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
      true
    );
    return new ListResponse(r, CollectionResponse);
  }

  async getCollectionUsers(
    organizationId: string,
    id: string
  ): Promise<SelectionReadOnlyResponse[]> {
    const r = await this.send(
      "GET",
      "/organizations/" + organizationId + "/collections/" + id + "/users",
      null,
      true,
      true
    );
    return r.map((dr: any) => new SelectionReadOnlyResponse(dr));
  }

  async postCollection(
    organizationId: string,
    request: CollectionRequest
  ): Promise<CollectionResponse> {
    const r = await this.send(
      "POST",
      "/organizations/" + organizationId + "/collections",
      request,
      true,
      true
    );
    return new CollectionResponse(r);
  }

  async putCollection(
    organizationId: string,
    id: string,
    request: CollectionRequest
  ): Promise<CollectionResponse> {
    const r = await this.send(
      "PUT",
      "/organizations/" + organizationId + "/collections/" + id,
      request,
      true,
      true
    );
    return new CollectionResponse(r);
  }

  async putCollectionUsers(
    organizationId: string,
    id: string,
    request: SelectionReadOnlyRequest[]
  ): Promise<any> {
    await this.send(
      "PUT",
      "/organizations/" + organizationId + "/collections/" + id + "/users",
      request,
      true,
      false
    );
  }

  deleteCollection(organizationId: string, id: string): Promise<any> {
    return this.send(
      "DELETE",
      "/organizations/" + organizationId + "/collections/" + id,
      null,
      true,
      false
    );
  }

  deleteCollectionUser(
    organizationId: string,
    id: string,
    organizationUserId: string
  ): Promise<any> {
    return this.send(
      "DELETE",
      "/organizations/" + organizationId + "/collections/" + id + "/user/" + organizationUserId,
      null,
      true,
      false
    );
  }

  // Groups APIs

  async getGroupDetails(organizationId: string, id: string): Promise<GroupDetailsResponse> {
    const r = await this.send(
      "GET",
      "/organizations/" + organizationId + "/groups/" + id + "/details",
      null,
      true,
      true
    );
    return new GroupDetailsResponse(r);
  }

  async getGroups(organizationId: string): Promise<ListResponse<GroupResponse>> {
    const r = await this.send(
      "GET",
      "/organizations/" + organizationId + "/groups",
      null,
      true,
      true
    );
    return new ListResponse(r, GroupResponse);
  }

  async getGroupUsers(organizationId: string, id: string): Promise<string[]> {
    const r = await this.send(
      "GET",
      "/organizations/" + organizationId + "/groups/" + id + "/users",
      null,
      true,
      true
    );
    return r;
  }

  async postGroup(organizationId: string, request: GroupRequest): Promise<GroupResponse> {
    const r = await this.send(
      "POST",
      "/organizations/" + organizationId + "/groups",
      request,
      true,
      true
    );
    return new GroupResponse(r);
  }

  async putGroup(
    organizationId: string,
    id: string,
    request: GroupRequest
  ): Promise<GroupResponse> {
    const r = await this.send(
      "PUT",
      "/organizations/" + organizationId + "/groups/" + id,
      request,
      true,
      true
    );
    return new GroupResponse(r);
  }

  async putGroupUsers(organizationId: string, id: string, request: string[]): Promise<any> {
    await this.send(
      "PUT",
      "/organizations/" + organizationId + "/groups/" + id + "/users",
      request,
      true,
      false
    );
  }

  deleteGroup(organizationId: string, id: string): Promise<any> {
    return this.send(
      "DELETE",
      "/organizations/" + organizationId + "/groups/" + id,
      null,
      true,
      false
    );
  }

  deleteGroupUser(organizationId: string, id: string, organizationUserId: string): Promise<any> {
    return this.send(
      "DELETE",
      "/organizations/" + organizationId + "/groups/" + id + "/user/" + organizationUserId,
      null,
      true,
      false
    );
  }

  // Policy APIs

  async getPolicy(organizationId: string, type: PolicyType): Promise<PolicyResponse> {
    const r = await this.send(
      "GET",
      "/organizations/" + organizationId + "/policies/" + type,
      null,
      true,
      true
    );
    return new PolicyResponse(r);
  }

  async getPolicies(organizationId: string): Promise<ListResponse<PolicyResponse>> {
    const r = await this.send(
      "GET",
      "/organizations/" + organizationId + "/policies",
      null,
      true,
      true
    );
    return new ListResponse(r, PolicyResponse);
  }

  async getPoliciesByToken(
    organizationId: string,
    token: string,
    email: string,
    organizationUserId: string
  ): Promise<ListResponse<PolicyResponse>> {
    const r = await this.send(
      "GET",
      "/organizations/" +
        organizationId +
        "/policies/token?" +
        "token=" +
        encodeURIComponent(token) +
        "&email=" +
        encodeURIComponent(email) +
        "&organizationUserId=" +
        organizationUserId,
      null,
      false,
      true
    );
    return new ListResponse(r, PolicyResponse);
  }

  async getPoliciesByInvitedUser(
    organizationId: string,
    userId: string
  ): Promise<ListResponse<PolicyResponse>> {
    const r = await this.send(
      "GET",
      "/organizations/" + organizationId + "/policies/invited-user?" + "userId=" + userId,
      null,
      false,
      true
    );
    return new ListResponse(r, PolicyResponse);
  }

  async putPolicy(
    organizationId: string,
    type: PolicyType,
    request: PolicyRequest
  ): Promise<PolicyResponse> {
    const r = await this.send(
      "PUT",
      "/organizations/" + organizationId + "/policies/" + type,
      request,
      true,
      true
    );
    return new PolicyResponse(r);
  }

  // Organization User APIs

  async getOrganizationUser(
    organizationId: string,
    id: string
  ): Promise<OrganizationUserDetailsResponse> {
    const r = await this.send(
      "GET",
      "/organizations/" + organizationId + "/users/" + id,
      null,
      true,
      true
    );
    return new OrganizationUserDetailsResponse(r);
  }

  async getOrganizationUserGroups(organizationId: string, id: string): Promise<string[]> {
    const r = await this.send(
      "GET",
      "/organizations/" + organizationId + "/users/" + id + "/groups",
      null,
      true,
      true
    );
    return r;
  }

  async getOrganizationUsers(
    organizationId: string
  ): Promise<ListResponse<OrganizationUserUserDetailsResponse>> {
    const r = await this.send(
      "GET",
      "/organizations/" + organizationId + "/users",
      null,
      true,
      true
    );
    return new ListResponse(r, OrganizationUserUserDetailsResponse);
  }

  async getOrganizationUserResetPasswordDetails(
    organizationId: string,
    id: string
  ): Promise<OrganizationUserResetPasswordDetailsReponse> {
    const r = await this.send(
      "GET",
      "/organizations/" + organizationId + "/users/" + id + "/reset-password-details",
      null,
      true,
      true
    );
    return new OrganizationUserResetPasswordDetailsReponse(r);
  }

  async getOrganizationAutoEnrollStatus(
    identifier: string
  ): Promise<OrganizationAutoEnrollStatusResponse> {
    const r = await this.send(
      "GET",
      "/organizations/" + identifier + "/auto-enroll-status",
      null,
      true,
      true
    );
    return new OrganizationAutoEnrollStatusResponse(r);
  }

  postOrganizationUserInvite(
    organizationId: string,
    request: OrganizationUserInviteRequest
  ): Promise<any> {
    return this.send(
      "POST",
      "/organizations/" + organizationId + "/users/invite",
      request,
      true,
      false
    );
  }

  postOrganizationUserReinvite(organizationId: string, id: string): Promise<any> {
    return this.send(
      "POST",
      "/organizations/" + organizationId + "/users/" + id + "/reinvite",
      null,
      true,
      false
    );
  }

  async postManyOrganizationUserReinvite(
    organizationId: string,
    request: OrganizationUserBulkRequest
  ): Promise<ListResponse<OrganizationUserBulkResponse>> {
    const r = await this.send(
      "POST",
      "/organizations/" + organizationId + "/users/reinvite",
      request,
      true,
      true
    );
    return new ListResponse(r, OrganizationUserBulkResponse);
  }

  postOrganizationUserAccept(
    organizationId: string,
    id: string,
    request: OrganizationUserAcceptRequest
  ): Promise<any> {
    return this.send(
      "POST",
      "/organizations/" + organizationId + "/users/" + id + "/accept",
      request,
      true,
      false
    );
  }

  postOrganizationUserConfirm(
    organizationId: string,
    id: string,
    request: OrganizationUserConfirmRequest
  ): Promise<any> {
    return this.send(
      "POST",
      "/organizations/" + organizationId + "/users/" + id + "/confirm",
      request,
      true,
      false
    );
  }

  async postOrganizationUsersPublicKey(
    organizationId: string,
    request: OrganizationUserBulkRequest
  ): Promise<ListResponse<OrganizationUserBulkPublicKeyResponse>> {
    const r = await this.send(
      "POST",
      "/organizations/" + organizationId + "/users/public-keys",
      request,
      true,
      true
    );
    return new ListResponse(r, OrganizationUserBulkPublicKeyResponse);
  }

  async postOrganizationUserBulkConfirm(
    organizationId: string,
    request: OrganizationUserBulkConfirmRequest
  ): Promise<ListResponse<OrganizationUserBulkResponse>> {
    const r = await this.send(
      "POST",
      "/organizations/" + organizationId + "/users/confirm",
      request,
      true,
      true
    );
    return new ListResponse(r, OrganizationUserBulkResponse);
  }

  putOrganizationUser(
    organizationId: string,
    id: string,
    request: OrganizationUserUpdateRequest
  ): Promise<any> {
    return this.send(
      "PUT",
      "/organizations/" + organizationId + "/users/" + id,
      request,
      true,
      false
    );
  }

  putOrganizationUserGroups(
    organizationId: string,
    id: string,
    request: OrganizationUserUpdateGroupsRequest
  ): Promise<any> {
    return this.send(
      "PUT",
      "/organizations/" + organizationId + "/users/" + id + "/groups",
      request,
      true,
      false
    );
  }

  putOrganizationUserResetPasswordEnrollment(
    organizationId: string,
    userId: string,
    request: OrganizationUserResetPasswordEnrollmentRequest
  ): Promise<any> {
    return this.send(
      "PUT",
      "/organizations/" + organizationId + "/users/" + userId + "/reset-password-enrollment",
      request,
      true,
      false
    );
  }

  putOrganizationUserResetPassword(
    organizationId: string,
    id: string,
    request: OrganizationUserResetPasswordRequest
  ): Promise<any> {
    return this.send(
      "PUT",
      "/organizations/" + organizationId + "/users/" + id + "/reset-password",
      request,
      true,
      false
    );
  }

  deleteOrganizationUser(organizationId: string, id: string): Promise<any> {
    return this.send(
      "DELETE",
      "/organizations/" + organizationId + "/users/" + id,
      null,
      true,
      false
    );
  }

  async deleteManyOrganizationUsers(
    organizationId: string,
    request: OrganizationUserBulkRequest
  ): Promise<ListResponse<OrganizationUserBulkResponse>> {
    const r = await this.send(
      "DELETE",
      "/organizations/" + organizationId + "/users",
      request,
      true,
      true
    );
    return new ListResponse(r, OrganizationUserBulkResponse);
  }

  revokeOrganizationUser(organizationId: string, id: string): Promise<any> {
    return this.send(
      "PUT",
      "/organizations/" + organizationId + "/users/" + id + "/revoke",
      null,
      true,
      false
    );
  }

  async revokeManyOrganizationUsers(
    organizationId: string,
    request: OrganizationUserBulkRequest
  ): Promise<ListResponse<OrganizationUserBulkResponse>> {
    const r = await this.send(
      "PUT",
      "/organizations/" + organizationId + "/users/revoke",
      request,
      true,
      true
    );
    return new ListResponse(r, OrganizationUserBulkResponse);
  }

  restoreOrganizationUser(organizationId: string, id: string): Promise<any> {
    return this.send(
      "PUT",
      "/organizations/" + organizationId + "/users/" + id + "/restore",
      null,
      true,
      false
    );
  }

  async restoreManyOrganizationUsers(
    organizationId: string,
    request: OrganizationUserBulkRequest
  ): Promise<ListResponse<OrganizationUserBulkResponse>> {
    const r = await this.send(
      "PUT",
      "/organizations/" + organizationId + "/users/restore",
      request,
      true,
      true
    );
    return new ListResponse(r, OrganizationUserBulkResponse);
  }

  // Plan APIs

  async getPlans(): Promise<ListResponse<PlanResponse>> {
    const r = await this.send("GET", "/plans/", null, false, true);
    return new ListResponse(r, PlanResponse);
  }

  async postImportDirectory(organizationId: string, request: ImportDirectoryRequest): Promise<any> {
    return this.send("POST", "/organizations/" + organizationId + "/import", request, true, false);
  }

  async postPublicImportDirectory(request: OrganizationImportRequest): Promise<any> {
    return this.send("POST", "/public/organization/import", request, true, false);
  }

  async getTaxRates(): Promise<ListResponse<TaxRateResponse>> {
    const r = await this.send("GET", "/plans/sales-tax-rates/", null, true, true);
    return new ListResponse(r, TaxRateResponse);
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
    const path = this.isDesktopClient || this.isWebClient ? "/sync?excludeDomains=true" : "/sync";
    const r = await this.send("GET", path, null, true, true);
    return new SyncResponse(r);
  }

  // Two-factor APIs

  async getTwoFactorProviders(): Promise<ListResponse<TwoFactorProviderResponse>> {
    const r = await this.send("GET", "/two-factor", null, true, true);
    return new ListResponse(r, TwoFactorProviderResponse);
  }

  async getTwoFactorOrganizationProviders(
    organizationId: string
  ): Promise<ListResponse<TwoFactorProviderResponse>> {
    const r = await this.send(
      "GET",
      "/organizations/" + organizationId + "/two-factor",
      null,
      true,
      true
    );
    return new ListResponse(r, TwoFactorProviderResponse);
  }

  async getTwoFactorAuthenticator(
    request: SecretVerificationRequest
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
    request: SecretVerificationRequest
  ): Promise<TwoFactorDuoResponse> {
    const r = await this.send(
      "POST",
      "/organizations/" + organizationId + "/two-factor/get-duo",
      request,
      true,
      true
    );
    return new TwoFactorDuoResponse(r);
  }

  async getTwoFactorYubiKey(request: SecretVerificationRequest): Promise<TwoFactorYubiKeyResponse> {
    const r = await this.send("POST", "/two-factor/get-yubikey", request, true, true);
    return new TwoFactorYubiKeyResponse(r);
  }

  async getTwoFactorWebAuthn(
    request: SecretVerificationRequest
  ): Promise<TwoFactorWebAuthnResponse> {
    const r = await this.send("POST", "/two-factor/get-webauthn", request, true, true);
    return new TwoFactorWebAuthnResponse(r);
  }

  async getTwoFactorWebAuthnChallenge(
    request: SecretVerificationRequest
  ): Promise<ChallengeResponse> {
    const r = await this.send("POST", "/two-factor/get-webauthn-challenge", request, true, true);
    return new ChallengeResponse(r);
  }

  async getTwoFactorRecover(request: SecretVerificationRequest): Promise<TwoFactorRecoverResponse> {
    const r = await this.send("POST", "/two-factor/get-recover", request, true, true);
    return new TwoFactorRecoverResponse(r);
  }

  async putTwoFactorAuthenticator(
    request: UpdateTwoFactorAuthenticatorRequest
  ): Promise<TwoFactorAuthenticatorResponse> {
    const r = await this.send("PUT", "/two-factor/authenticator", request, true, true);
    return new TwoFactorAuthenticatorResponse(r);
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
    request: UpdateTwoFactorDuoRequest
  ): Promise<TwoFactorDuoResponse> {
    const r = await this.send(
      "PUT",
      "/organizations/" + organizationId + "/two-factor/duo",
      request,
      true,
      true
    );
    return new TwoFactorDuoResponse(r);
  }

  async putTwoFactorYubiKey(
    request: UpdateTwoFactorYubioOtpRequest
  ): Promise<TwoFactorYubiKeyResponse> {
    const r = await this.send("PUT", "/two-factor/yubikey", request, true, true);
    return new TwoFactorYubiKeyResponse(r);
  }

  async putTwoFactorWebAuthn(
    request: UpdateTwoFactorWebAuthnRequest
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
    request: UpdateTwoFactorWebAuthnDeleteRequest
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
    request: TwoFactorProviderRequest
  ): Promise<TwoFactorProviderResponse> {
    const r = await this.send(
      "PUT",
      "/organizations/" + organizationId + "/two-factor/disable",
      request,
      true,
      true
    );
    return new TwoFactorProviderResponse(r);
  }

  postTwoFactorRecover(request: TwoFactorRecoveryRequest): Promise<any> {
    return this.send("POST", "/two-factor/recover", request, false, false);
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
      true
    );
    return new DeviceVerificationResponse(r);
  }

  async putDeviceVerificationSettings(
    request: DeviceVerificationRequest
  ): Promise<DeviceVerificationResponse> {
    const r = await this.send(
      "PUT",
      "/two-factor/device-verification-settings",
      request,
      true,
      true
    );
    return new DeviceVerificationResponse(r);
  }

  // Emergency Access APIs

  async getEmergencyAccessTrusted(): Promise<ListResponse<EmergencyAccessGranteeDetailsResponse>> {
    const r = await this.send("GET", "/emergency-access/trusted", null, true, true);
    return new ListResponse(r, EmergencyAccessGranteeDetailsResponse);
  }

  async getEmergencyAccessGranted(): Promise<ListResponse<EmergencyAccessGrantorDetailsResponse>> {
    const r = await this.send("GET", "/emergency-access/granted", null, true, true);
    return new ListResponse(r, EmergencyAccessGrantorDetailsResponse);
  }

  async getEmergencyAccess(id: string): Promise<EmergencyAccessGranteeDetailsResponse> {
    const r = await this.send("GET", "/emergency-access/" + id, null, true, true);
    return new EmergencyAccessGranteeDetailsResponse(r);
  }

  async getEmergencyGrantorPolicies(id: string): Promise<ListResponse<PolicyResponse>> {
    const r = await this.send("GET", "/emergency-access/" + id + "/policies", null, true, true);
    return new ListResponse(r, PolicyResponse);
  }

  putEmergencyAccess(id: string, request: EmergencyAccessUpdateRequest): Promise<any> {
    return this.send("PUT", "/emergency-access/" + id, request, true, false);
  }

  deleteEmergencyAccess(id: string): Promise<any> {
    return this.send("DELETE", "/emergency-access/" + id, null, true, false);
  }

  postEmergencyAccessInvite(request: EmergencyAccessInviteRequest): Promise<any> {
    return this.send("POST", "/emergency-access/invite", request, true, false);
  }

  postEmergencyAccessReinvite(id: string): Promise<any> {
    return this.send("POST", "/emergency-access/" + id + "/reinvite", null, true, false);
  }

  postEmergencyAccessAccept(id: string, request: EmergencyAccessAcceptRequest): Promise<any> {
    return this.send("POST", "/emergency-access/" + id + "/accept", request, true, false);
  }

  postEmergencyAccessConfirm(id: string, request: EmergencyAccessConfirmRequest): Promise<any> {
    return this.send("POST", "/emergency-access/" + id + "/confirm", request, true, false);
  }

  postEmergencyAccessInitiate(id: string): Promise<any> {
    return this.send("POST", "/emergency-access/" + id + "/initiate", null, true, false);
  }

  postEmergencyAccessApprove(id: string): Promise<any> {
    return this.send("POST", "/emergency-access/" + id + "/approve", null, true, false);
  }

  postEmergencyAccessReject(id: string): Promise<any> {
    return this.send("POST", "/emergency-access/" + id + "/reject", null, true, false);
  }

  async postEmergencyAccessTakeover(id: string): Promise<EmergencyAccessTakeoverResponse> {
    const r = await this.send("POST", "/emergency-access/" + id + "/takeover", null, true, true);
    return new EmergencyAccessTakeoverResponse(r);
  }

  async postEmergencyAccessPassword(
    id: string,
    request: EmergencyAccessPasswordRequest
  ): Promise<any> {
    await this.send("POST", "/emergency-access/" + id + "/password", request, true, true);
  }

  async postEmergencyAccessView(id: string): Promise<EmergencyAccessViewResponse> {
    const r = await this.send("POST", "/emergency-access/" + id + "/view", null, true, true);
    return new EmergencyAccessViewResponse(r);
  }

  // Organization APIs

  async getOrganization(id: string): Promise<OrganizationResponse> {
    const r = await this.send("GET", "/organizations/" + id, null, true, true);
    return new OrganizationResponse(r);
  }

  async getOrganizationBilling(id: string): Promise<BillingResponse> {
    const r = await this.send("GET", "/organizations/" + id + "/billing", null, true, true);
    return new BillingResponse(r);
  }

  async getOrganizationSubscription(id: string): Promise<OrganizationSubscriptionResponse> {
    const r = await this.send("GET", "/organizations/" + id + "/subscription", null, true, true);
    return new OrganizationSubscriptionResponse(r);
  }

  async getCloudCommunicationsEnabled(): Promise<boolean> {
    const r = await this.send("GET", "/organizations/connections/enabled", null, true, true);
    return r as boolean;
  }

  async getOrganizationConnection<TConfig extends OrganizationConnectionConfigApis>(
    id: string,
    type: OrganizationConnectionType,
    configType: { new (response: any): TConfig }
  ): Promise<OrganizationConnectionResponse<TConfig>> {
    const r = await this.send("GET", `/organizations/connections/${id}/${type}`, null, true, true);
    return new OrganizationConnectionResponse(r, configType);
  }

  async createOrganizationConnection<TConfig extends OrganizationConnectionConfigApis>(
    request: OrganizationConnectionRequest,
    configType: { new (response: any): TConfig }
  ): Promise<OrganizationConnectionResponse<TConfig>> {
    const r = await this.send("POST", "/organizations/connections/", request, true, true);
    return new OrganizationConnectionResponse(r, configType);
  }

  async updateOrganizationConnection<TConfig extends OrganizationConnectionConfigApis>(
    request: OrganizationConnectionRequest,
    configType: { new (response: any): TConfig },
    organizationConnectionId?: string
  ): Promise<OrganizationConnectionResponse<TConfig>> {
    const r = await this.send(
      "PUT",
      "/organizations/connections/" + organizationConnectionId,
      request,
      true,
      true
    );
    return new OrganizationConnectionResponse(r, configType);
  }

  async deleteOrganizationConnection(id: string): Promise<void> {
    return this.send("DELETE", "/organizations/connections/" + id, null, true, false);
  }

  async getOrganizationLicense(id: string, installationId: string): Promise<any> {
    return this.send(
      "GET",
      "/organizations/" + id + "/license?installationId=" + installationId,
      null,
      true,
      true
    );
  }

  async getOrganizationTaxInfo(id: string): Promise<TaxInfoResponse> {
    const r = await this.send("GET", "/organizations/" + id + "/tax", null, true, true);
    return new TaxInfoResponse(r);
  }

  async getOrganizationSso(id: string): Promise<OrganizationSsoResponse> {
    const r = await this.send("GET", "/organizations/" + id + "/sso", null, true, true);
    return new OrganizationSsoResponse(r);
  }

  async postOrganization(request: OrganizationCreateRequest): Promise<OrganizationResponse> {
    const r = await this.send("POST", "/organizations", request, true, true);
    return new OrganizationResponse(r);
  }

  async putOrganization(
    id: string,
    request: OrganizationUpdateRequest
  ): Promise<OrganizationResponse> {
    const r = await this.send("PUT", "/organizations/" + id, request, true, true);
    return new OrganizationResponse(r);
  }

  async putOrganizationTaxInfo(
    id: string,
    request: OrganizationTaxInfoUpdateRequest
  ): Promise<any> {
    return this.send("PUT", "/organizations/" + id + "/tax", request, true, false);
  }

  postLeaveOrganization(id: string): Promise<any> {
    return this.send("POST", "/organizations/" + id + "/leave", null, true, false);
  }

  async postOrganizationLicense(data: FormData): Promise<OrganizationResponse> {
    const r = await this.send("POST", "/organizations/license", data, true, true);
    return new OrganizationResponse(r);
  }

  async postOrganizationLicenseUpdate(id: string, data: FormData): Promise<any> {
    return this.send("POST", "/organizations/" + id + "/license", data, true, false);
  }

  async postOrganizationApiKey(
    id: string,
    request: OrganizationApiKeyRequest
  ): Promise<ApiKeyResponse> {
    const r = await this.send("POST", "/organizations/" + id + "/api-key", request, true, true);
    return new ApiKeyResponse(r);
  }

  async getOrganizationApiKeyInformation(
    id: string,
    type: OrganizationApiKeyType = null
  ): Promise<ListResponse<OrganizationApiKeyInformationResponse>> {
    const uri =
      type === null
        ? "/organizations/" + id + "/api-key-information"
        : "/organizations/" + id + "/api-key-information/" + type;
    const r = await this.send("GET", uri, null, true, true);
    return new ListResponse(r, OrganizationApiKeyInformationResponse);
  }

  async postOrganizationRotateApiKey(
    id: string,
    request: OrganizationApiKeyRequest
  ): Promise<ApiKeyResponse> {
    const r = await this.send(
      "POST",
      "/organizations/" + id + "/rotate-api-key",
      request,
      true,
      true
    );
    return new ApiKeyResponse(r);
  }

  async postOrganizationSso(
    id: string,
    request: OrganizationSsoRequest
  ): Promise<OrganizationSsoResponse> {
    const r = await this.send("POST", "/organizations/" + id + "/sso", request, true, true);
    return new OrganizationSsoResponse(r);
  }

  async postOrganizationUpgrade(
    id: string,
    request: OrganizationUpgradeRequest
  ): Promise<PaymentResponse> {
    const r = await this.send("POST", "/organizations/" + id + "/upgrade", request, true, true);
    return new PaymentResponse(r);
  }

  async postOrganizationUpdateSubscription(
    id: string,
    request: OrganizationSubscriptionUpdateRequest
  ): Promise<void> {
    return this.send("POST", "/organizations/" + id + "/subscription", request, true, false);
  }

  async postOrganizationSeat(id: string, request: SeatRequest): Promise<PaymentResponse> {
    const r = await this.send("POST", "/organizations/" + id + "/seat", request, true, true);
    return new PaymentResponse(r);
  }

  async postOrganizationStorage(id: string, request: StorageRequest): Promise<PaymentResponse> {
    const r = await this.send("POST", "/organizations/" + id + "/storage", request, true, true);
    return new PaymentResponse(r);
  }

  postOrganizationPayment(id: string, request: PaymentRequest): Promise<any> {
    return this.send("POST", "/organizations/" + id + "/payment", request, true, false);
  }

  postOrganizationVerifyBank(id: string, request: VerifyBankRequest): Promise<any> {
    return this.send("POST", "/organizations/" + id + "/verify-bank", request, true, false);
  }

  postOrganizationCancel(id: string): Promise<any> {
    return this.send("POST", "/organizations/" + id + "/cancel", null, true, false);
  }

  postOrganizationReinstate(id: string): Promise<any> {
    return this.send("POST", "/organizations/" + id + "/reinstate", null, true, false);
  }

  deleteOrganization(id: string, request: SecretVerificationRequest): Promise<any> {
    return this.send("DELETE", "/organizations/" + id, request, true, false);
  }

  async getOrganizationKeys(id: string): Promise<OrganizationKeysResponse> {
    const r = await this.send("GET", "/organizations/" + id + "/keys", null, true, true);
    return new OrganizationKeysResponse(r);
  }

  async postOrganizationKeys(
    id: string,
    request: OrganizationKeysRequest
  ): Promise<OrganizationKeysResponse> {
    const r = await this.send("POST", "/organizations/" + id + "/keys", request, true, true);
    return new OrganizationKeysResponse(r);
  }

  // Provider User APIs

  async getProviderUsers(
    providerId: string
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
      false
    );
  }

  async postManyProviderUserReinvite(
    providerId: string,
    request: ProviderUserBulkRequest
  ): Promise<ListResponse<ProviderUserBulkResponse>> {
    const r = await this.send(
      "POST",
      "/providers/" + providerId + "/users/reinvite",
      request,
      true,
      true
    );
    return new ListResponse(r, ProviderUserBulkResponse);
  }

  async postProviderUserBulkConfirm(
    providerId: string,
    request: ProviderUserBulkConfirmRequest
  ): Promise<ListResponse<ProviderUserBulkResponse>> {
    const r = await this.send(
      "POST",
      "/providers/" + providerId + "/users/confirm",
      request,
      true,
      true
    );
    return new ListResponse(r, ProviderUserBulkResponse);
  }

  async deleteManyProviderUsers(
    providerId: string,
    request: ProviderUserBulkRequest
  ): Promise<ListResponse<ProviderUserBulkResponse>> {
    const r = await this.send("DELETE", "/providers/" + providerId + "/users", request, true, true);
    return new ListResponse(r, ProviderUserBulkResponse);
  }

  postProviderUserAccept(
    providerId: string,
    id: string,
    request: ProviderUserAcceptRequest
  ): Promise<any> {
    return this.send(
      "POST",
      "/providers/" + providerId + "/users/" + id + "/accept",
      request,
      true,
      false
    );
  }

  postProviderUserConfirm(
    providerId: string,
    id: string,
    request: ProviderUserConfirmRequest
  ): Promise<any> {
    return this.send(
      "POST",
      "/providers/" + providerId + "/users/" + id + "/confirm",
      request,
      true,
      false
    );
  }

  async postProviderUsersPublicKey(
    providerId: string,
    request: ProviderUserBulkRequest
  ): Promise<ListResponse<ProviderUserBulkPublicKeyResponse>> {
    const r = await this.send(
      "POST",
      "/providers/" + providerId + "/users/public-keys",
      request,
      true,
      true
    );
    return new ListResponse(r, ProviderUserBulkPublicKeyResponse);
  }

  putProviderUser(
    providerId: string,
    id: string,
    request: ProviderUserUpdateRequest
  ): Promise<any> {
    return this.send("PUT", "/providers/" + providerId + "/users/" + id, request, true, false);
  }

  deleteProviderUser(providerId: string, id: string): Promise<any> {
    return this.send("DELETE", "/providers/" + providerId + "/users/" + id, null, true, false);
  }

  // Provider Organization APIs

  async getProviderClients(
    providerId: string
  ): Promise<ListResponse<ProviderOrganizationOrganizationDetailsResponse>> {
    const r = await this.send(
      "GET",
      "/providers/" + providerId + "/organizations",
      null,
      true,
      true
    );
    return new ListResponse(r, ProviderOrganizationOrganizationDetailsResponse);
  }

  postProviderAddOrganization(
    providerId: string,
    request: ProviderAddOrganizationRequest
  ): Promise<any> {
    return this.send(
      "POST",
      "/providers/" + providerId + "/organizations/add",
      request,
      true,
      false
    );
  }

  async postProviderCreateOrganization(
    providerId: string,
    request: ProviderOrganizationCreateRequest
  ): Promise<ProviderOrganizationResponse> {
    const r = await this.send(
      "POST",
      "/providers/" + providerId + "/organizations",
      request,
      true,
      true
    );
    return new ProviderOrganizationResponse(r);
  }

  deleteProviderOrganization(providerId: string, id: string): Promise<any> {
    return this.send(
      "DELETE",
      "/providers/" + providerId + "/organizations/" + id,
      null,
      true,
      false
    );
  }

  // Event APIs

  async getEvents(start: string, end: string, token: string): Promise<ListResponse<EventResponse>> {
    const r = await this.send(
      "GET",
      this.addEventParameters("/events", start, end, token),
      null,
      true,
      true
    );
    return new ListResponse(r, EventResponse);
  }

  async getEventsCipher(
    id: string,
    start: string,
    end: string,
    token: string
  ): Promise<ListResponse<EventResponse>> {
    const r = await this.send(
      "GET",
      this.addEventParameters("/ciphers/" + id + "/events", start, end, token),
      null,
      true,
      true
    );
    return new ListResponse(r, EventResponse);
  }

  async getEventsOrganization(
    id: string,
    start: string,
    end: string,
    token: string
  ): Promise<ListResponse<EventResponse>> {
    const r = await this.send(
      "GET",
      this.addEventParameters("/organizations/" + id + "/events", start, end, token),
      null,
      true,
      true
    );
    return new ListResponse(r, EventResponse);
  }

  async getEventsOrganizationUser(
    organizationId: string,
    id: string,
    start: string,
    end: string,
    token: string
  ): Promise<ListResponse<EventResponse>> {
    const r = await this.send(
      "GET",
      this.addEventParameters(
        "/organizations/" + organizationId + "/users/" + id + "/events",
        start,
        end,
        token
      ),
      null,
      true,
      true
    );
    return new ListResponse(r, EventResponse);
  }

  async getEventsProvider(
    id: string,
    start: string,
    end: string,
    token: string
  ): Promise<ListResponse<EventResponse>> {
    const r = await this.send(
      "GET",
      this.addEventParameters("/providers/" + id + "/events", start, end, token),
      null,
      true,
      true
    );
    return new ListResponse(r, EventResponse);
  }

  async getEventsProviderUser(
    providerId: string,
    id: string,
    start: string,
    end: string,
    token: string
  ): Promise<ListResponse<EventResponse>> {
    const r = await this.send(
      "GET",
      this.addEventParameters(
        "/providers/" + providerId + "/users/" + id + "/events",
        start,
        end,
        token
      ),
      null,
      true,
      true
    );
    return new ListResponse(r, EventResponse);
  }

  async postEventsCollect(request: EventRequest[]): Promise<any> {
    const authHeader = await this.getActiveBearerToken();
    const headers = new Headers({
      "Device-Type": this.deviceType,
      Authorization: "Bearer " + authHeader,
      "Content-Type": "application/json; charset=utf-8",
    });
    if (this.customUserAgent != null) {
      headers.set("User-Agent", this.customUserAgent);
    }
    const response = await this.fetch(
      new Request(this.environmentService.getEventsUrl() + "/collect", {
        cache: "no-store",
        credentials: this.getCredentials(),
        method: "POST",
        body: JSON.stringify(request),
        headers: headers,
      })
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

  // HIBP APIs

  async getHibpBreach(username: string): Promise<BreachAccountResponse[]> {
    const r = await this.send("GET", "/hibp/breach?username=" + username, null, true, true);
    return r.map((a: any) => new BreachAccountResponse(a));
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

  async getUserKeyFromKeyConnector(keyConnectorUrl: string): Promise<KeyConnectorUserKeyResponse> {
    const authHeader = await this.getActiveBearerToken();

    const response = await this.fetch(
      new Request(keyConnectorUrl + "/user-keys", {
        cache: "no-store",
        method: "GET",
        headers: new Headers({
          Accept: "application/json",
          Authorization: "Bearer " + authHeader,
        }),
      })
    );

    if (response.status !== 200) {
      const error = await this.handleError(response, false, true);
      return Promise.reject(error);
    }

    return new KeyConnectorUserKeyResponse(await response.json());
  }

  async postUserKeyToKeyConnector(
    keyConnectorUrl: string,
    request: KeyConnectorUserKeyRequest
  ): Promise<void> {
    const authHeader = await this.getActiveBearerToken();

    const response = await this.fetch(
      new Request(keyConnectorUrl + "/user-keys", {
        cache: "no-store",
        method: "POST",
        headers: new Headers({
          Accept: "application/json",
          Authorization: "Bearer " + authHeader,
          "Content-Type": "application/json; charset=utf-8",
        }),
        body: JSON.stringify(request),
      })
    );

    if (response.status !== 200) {
      const error = await this.handleError(response, false, true);
      return Promise.reject(error);
    }
  }

  async getKeyConnectorAlive(keyConnectorUrl: string) {
    const response = await this.fetch(
      new Request(keyConnectorUrl + "/alive", {
        cache: "no-store",
        method: "GET",
        headers: new Headers({
          Accept: "application/json",
          "Content-Type": "application/json; charset=utf-8",
        }),
      })
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
      true
    );
    return new OrganizationExportResponse(r);
  }

  // Helpers

  async getActiveBearerToken(): Promise<string> {
    let accessToken = await this.tokenService.getToken();
    if (await this.tokenService.tokenNeedsRefresh()) {
      await this.doAuthRefresh();
      accessToken = await this.tokenService.getToken();
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
      await this.platformUtilsService.getApplicationVersion()
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

    const path = `/account/prevalidate?domainHint=${encodeURIComponent(identifier)}`;
    const response = await this.fetch(
      new Request(this.environmentService.getIdentityUrl() + path, {
        cache: "no-store",
        credentials: this.getCredentials(),
        headers: headers,
        method: "GET",
      })
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
    request: OrganizationSponsorshipCreateRequest
  ): Promise<void> {
    return await this.send(
      "POST",
      "/organization/sponsorship/" +
        (this.platformUtilsService.isSelfHost() ? "self-hosted/" : "") +
        sponsoredOrgId +
        "/families-for-enterprise",
      request,
      true,
      false
    );
  }

  async getSponsorshipSyncStatus(
    sponsoredOrgId: string
  ): Promise<OrganizationSponsorshipSyncStatusResponse> {
    const response = await this.send(
      "GET",
      "/organization/sponsorship/" + sponsoredOrgId + "/sync-status",
      null,
      true,
      true
    );
    return new OrganizationSponsorshipSyncStatusResponse(response);
  }

  async deleteRevokeSponsorship(sponsoringOrganizationId: string): Promise<void> {
    return await this.send(
      "DELETE",
      "/organization/sponsorship/" +
        (this.platformUtilsService.isSelfHost() ? "self-hosted/" : "") +
        sponsoringOrganizationId,
      null,
      true,
      false
    );
  }

  async deleteRemoveSponsorship(sponsoringOrgId: string): Promise<void> {
    return await this.send(
      "DELETE",
      "/organization/sponsorship/sponsored/" + sponsoringOrgId,
      null,
      true,
      false
    );
  }

  async postPreValidateSponsorshipToken(sponsorshipToken: string): Promise<boolean> {
    const r = await this.send(
      "POST",
      "/organization/sponsorship/validate-token?sponsorshipToken=" +
        encodeURIComponent(sponsorshipToken),
      null,
      true,
      true
    );
    return r as boolean;
  }

  async postRedeemSponsorship(
    sponsorshipToken: string,
    request: OrganizationSponsorshipRedeemRequest
  ): Promise<void> {
    return await this.send(
      "POST",
      "/organization/sponsorship/redeem?sponsorshipToken=" + encodeURIComponent(sponsorshipToken),
      request,
      true,
      false
    );
  }

  async postResendSponsorshipOffer(sponsoringOrgId: string): Promise<void> {
    return await this.send(
      "POST",
      "/organization/sponsorship/" + sponsoringOrgId + "/families-for-enterprise/resend",
      null,
      true,
      false
    );
  }

  protected async doAuthRefresh(): Promise<void> {
    const refreshToken = await this.tokenService.getRefreshToken();
    if (refreshToken != null && refreshToken !== "") {
      return this.doRefreshToken();
    }

    const clientId = await this.tokenService.getClientId();
    const clientSecret = await this.tokenService.getClientSecret();
    if (!Utils.isNullOrWhitespace(clientId) && !Utils.isNullOrWhitespace(clientSecret)) {
      return this.doApiTokenRefresh();
    }

    throw new Error("Cannot refresh token, no refresh token or api keys are stored");
  }

  protected async doRefreshToken(): Promise<void> {
    const refreshToken = await this.tokenService.getRefreshToken();
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

    const decodedToken = await this.tokenService.decodeToken();
    const response = await this.fetch(
      new Request(this.environmentService.getIdentityUrl() + "/connect/token", {
        body: this.qsStringify({
          grant_type: "refresh_token",
          client_id: decodedToken.client_id,
          refresh_token: refreshToken,
        }),
        cache: "no-store",
        credentials: this.getCredentials(),
        headers: headers,
        method: "POST",
      })
    );

    if (response.status === 200) {
      const responseJson = await response.json();
      const tokenResponse = new IdentityTokenResponse(responseJson);
      await this.tokenService.setTokens(
        tokenResponse.accessToken,
        tokenResponse.refreshToken,
        null
      );
    } else {
      const error = await this.handleError(response, true, true);
      return Promise.reject(error);
    }
  }

  protected async doApiTokenRefresh(): Promise<void> {
    const clientId = await this.tokenService.getClientId();
    const clientSecret = await this.tokenService.getClientSecret();

    const appId = await this.appIdService.getAppId();
    const deviceRequest = new DeviceRequest(appId, this.platformUtilsService);

    const tokenRequest = new ApiTokenRequest(
      clientId,
      clientSecret,
      new TokenRequestTwoFactor(),
      deviceRequest
    );

    const response = await this.postIdentityToken(tokenRequest);
    if (!(response instanceof IdentityTokenResponse)) {
      throw new Error("Invalid response received when refreshing api token");
    }

    await this.tokenService.setToken(response.accessToken);
  }

  async send(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body: any,
    authed: boolean,
    hasResponse: boolean,
    apiUrl?: string,
    alterHeaders?: (headers: Headers) => void
  ): Promise<any> {
    apiUrl = Utils.isNullOrWhitespace(apiUrl) ? this.environmentService.getApiUrl() : apiUrl;

    const requestUrl = apiUrl + path;
    // Prevent directory traversal from malicious paths
    if (new URL(requestUrl).href !== requestUrl) {
      return Promise.reject("Invalid request url path.");
    }

    const headers = new Headers({
      "Device-Type": this.deviceType,
    });
    if (this.customUserAgent != null) {
      headers.set("User-Agent", this.customUserAgent);
    }

    const requestInit: RequestInit = {
      cache: "no-store",
      credentials: this.getCredentials(),
      method: method,
    };

    if (authed) {
      const authHeader = await this.getActiveBearerToken();
      headers.set("Authorization", "Bearer " + authHeader);
    }
    if (body != null) {
      if (typeof body === "string") {
        requestInit.body = body;
        headers.set("Content-Type", "application/x-www-form-urlencoded; charset=utf-8");
      } else if (typeof body === "object") {
        if (body instanceof FormData) {
          requestInit.body = body;
        } else {
          headers.set("Content-Type", "application/json; charset=utf-8");
          requestInit.body = JSON.stringify(body);
        }
      }
    }
    if (hasResponse) {
      headers.set("Accept", "application/json");
    }
    if (alterHeaders != null) {
      alterHeaders(headers);
    }

    requestInit.headers = headers;
    const response = await this.fetch(new Request(requestUrl, requestInit));

    if (hasResponse && response.status === 200) {
      const responseJson = await response.json();
      return responseJson;
    } else if (response.status !== 200) {
      const error = await this.handleError(response, false, authed);
      return Promise.reject(error);
    }
  }

  private async handleError(
    response: Response,
    tokenError: boolean,
    authed: boolean
  ): Promise<ErrorResponse> {
    if (
      authed &&
      ((tokenError && response.status === 400) ||
        response.status === 401 ||
        response.status === 403)
    ) {
      await this.logoutCallback(true);
      return null;
    }

    let responseJson: any = null;
    if (this.isJsonResponse(response)) {
      responseJson = await response.json();
    } else if (this.isTextResponse(response)) {
      responseJson = { Message: await response.text() };
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

  private getCredentials(): RequestCredentials {
    if (!this.isWebClient || this.environmentService.hasBaseUrl()) {
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

  private isTextResponse(response: Response): boolean {
    const typeHeader = response.headers.get("content-type");
    return typeHeader != null && typeHeader.indexOf("text") > -1;
  }
}
