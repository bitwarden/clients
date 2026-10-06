// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, map } from "rxjs";

import { TwoFactorApiService } from "..";
import { ListResponse } from "../../../models/response/list.response";
import { I18nService } from "../../../platform/abstractions/i18n.service";
import { PlatformUtilsService } from "../../../platform/abstractions/platform-utils.service";
import { Utils } from "../../../platform/misc/utils";
import { GlobalStateProvider } from "../../../platform/state";
import { TwoFactorProviderType } from "../../enums/two-factor-provider-type";
import { SecretVerificationRequest } from "../../models/request/secret-verification.request";
import { IdentityTwoFactorResponse } from "../../models/response/identity-two-factor.response";
import {
  PROVIDERS,
  SELECTED_PROVIDER,
  TwoFactorProviderDetails,
  TwoFactorProviders,
  TwoFactorService as TwoFactorServiceAbstraction,
} from "../abstractions/two-factor.service";
import { TwoFactorAuthenticatorDeleteRequest } from "../request/two-factor-authenticator-delete.request";
import { TwoFactorAuthenticatorUpdateRequest } from "../request/two-factor-authenticator-update.request";
import { TwoFactorDuoDeleteRequest } from "../request/two-factor-duo-delete.request";
import { TwoFactorDuoUpdateRequest } from "../request/two-factor-duo-update.request";
import { TwoFactorEmailDeleteRequest } from "../request/two-factor-email-delete.request";
import { TwoFactorEmailLoginRequest } from "../request/two-factor-email-login.request";
import { TwoFactorEmailSetupRequest } from "../request/two-factor-email-setup.request";
import { TwoFactorEmailUpdateRequest } from "../request/two-factor-email-update.request";
import { TwoFactorOrganizationDuoDeleteRequest } from "../request/two-factor-organization-duo-delete.request";
import { TwoFactorWebAuthnChallengeRequest } from "../request/two-factor-web-authn-challenge.request";
import { TwoFactorWebAuthnDeleteAllRequest } from "../request/two-factor-web-authn-delete-all.request";
import { TwoFactorWebAuthnDeleteRequest } from "../request/two-factor-web-authn-delete.request";
import { TwoFactorWebAuthnUpdateRequest } from "../request/two-factor-web-authn-update.request";
import { TwoFactorYubiKeyDeleteRequest } from "../request/two-factor-yubikey-delete.request";
import { TwoFactorYubiKeyUpdateRequest } from "../request/two-factor-yubikey-update.request";
import { TwoFactorAuthenticatorUpdateResponse } from "../response/two-factor-authenticator-update.response";
import { TwoFactorAuthenticatorResponse } from "../response/two-factor-authenticator.response";
import { TwoFactorDuoUpdateResponse } from "../response/two-factor-duo-update.response";
import { TwoFactorDuoResponse } from "../response/two-factor-duo.response";
import { TwoFactorEmailUpdateResponse } from "../response/two-factor-email-update.response";
import { TwoFactorEmailResponse } from "../response/two-factor-email.response";
import { TwoFactorOrganizationDuoUpdateResponse } from "../response/two-factor-organization-duo-update.response";
import { TwoFactorOrganizationDuoResponse } from "../response/two-factor-organization-duo.response";
import { TwoFactorProviderResponse } from "../response/two-factor-provider.response";
import { TwoFactorRecoverResponse } from "../response/two-factor-recover.response";
import { TwoFactorWebAuthnChallengeResponse } from "../response/two-factor-web-authn-challenge.response";
import { TwoFactorWebAuthnDeleteResponse } from "../response/two-factor-web-authn-delete.response";
import { TwoFactorWebAuthnUpdateResponse } from "../response/two-factor-web-authn-update.response";
import { TwoFactorWebAuthnResponse } from "../response/two-factor-web-authn.response";
import { TwoFactorYubiKeyUpdateResponse } from "../response/two-factor-yubi-key-update.response";
import { TwoFactorYubiKeyResponse } from "../response/two-factor-yubi-key.response";

export class DefaultTwoFactorService implements TwoFactorServiceAbstraction {
  private providersState = this.globalStateProvider.get(PROVIDERS);
  private selectedState = this.globalStateProvider.get(SELECTED_PROVIDER);
  readonly providers$ = this.providersState.state$.pipe(
    map((providers) => Utils.recordToMap(providers)),
  );
  readonly selected$ = this.selectedState.state$;

  constructor(
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private globalStateProvider: GlobalStateProvider,
    private twoFactorApiService: TwoFactorApiService,
  ) {}

  init() {
    TwoFactorProviders[TwoFactorProviderType.Email].name = this.i18nService.t("emailTitle");
    TwoFactorProviders[TwoFactorProviderType.Email].description = this.i18nService.t("emailDescV2");

    TwoFactorProviders[TwoFactorProviderType.Authenticator].name =
      this.i18nService.t("authenticatorAppTitle");
    TwoFactorProviders[TwoFactorProviderType.Authenticator].description =
      this.i18nService.t("authenticatorAppDescV2");

    TwoFactorProviders[TwoFactorProviderType.Duo].description = this.i18nService.t("duoDescV2");

    TwoFactorProviders[TwoFactorProviderType.OrganizationDuo].name =
      "Duo (" + this.i18nService.t("organization") + ")";
    TwoFactorProviders[TwoFactorProviderType.OrganizationDuo].description =
      this.i18nService.t("duoOrganizationDesc");

    TwoFactorProviders[TwoFactorProviderType.WebAuthn].name = this.i18nService.t("webAuthnTitle");
    TwoFactorProviders[TwoFactorProviderType.WebAuthn].description =
      this.i18nService.t("webAuthnDesc");

    TwoFactorProviders[TwoFactorProviderType.Yubikey].name = this.i18nService.t("yubiKeyTitleV2");
    TwoFactorProviders[TwoFactorProviderType.Yubikey].description =
      this.i18nService.t("yubiKeyDesc");
  }

  async getSupportedProviders(win: Window): Promise<TwoFactorProviderDetails[]> {
    const data = await firstValueFrom(this.providers$);
    const providers: any[] = [];
    if (data == null) {
      return providers;
    }

    if (
      data.has(TwoFactorProviderType.OrganizationDuo) &&
      this.platformUtilsService.supportsDuo()
    ) {
      providers.push(TwoFactorProviders[TwoFactorProviderType.OrganizationDuo]);
    }

    if (data.has(TwoFactorProviderType.Authenticator)) {
      providers.push(TwoFactorProviders[TwoFactorProviderType.Authenticator]);
    }

    if (data.has(TwoFactorProviderType.Yubikey)) {
      providers.push(TwoFactorProviders[TwoFactorProviderType.Yubikey]);
    }

    if (data.has(TwoFactorProviderType.Duo) && this.platformUtilsService.supportsDuo()) {
      providers.push(TwoFactorProviders[TwoFactorProviderType.Duo]);
    }

    if (
      data.has(TwoFactorProviderType.WebAuthn) &&
      this.platformUtilsService.supportsWebAuthn(win)
    ) {
      providers.push(TwoFactorProviders[TwoFactorProviderType.WebAuthn]);
    }

    if (data.has(TwoFactorProviderType.Email)) {
      providers.push(TwoFactorProviders[TwoFactorProviderType.Email]);
    }

    return providers;
  }

  async getDefaultProvider(webAuthnSupported: boolean): Promise<TwoFactorProviderType> {
    const data = await firstValueFrom(this.providers$);
    const selected = await firstValueFrom(this.selected$);
    if (data == null) {
      return null;
    }

    if (selected != null && data.has(selected)) {
      return selected;
    }

    let providerType: TwoFactorProviderType = null;
    let providerPriority = -1;
    data.forEach((_value, type) => {
      const provider = (TwoFactorProviders as any)[type];
      if (provider != null && provider.priority > providerPriority) {
        if (type === TwoFactorProviderType.WebAuthn && !webAuthnSupported) {
          return;
        }

        providerType = type;
        providerPriority = provider.priority;
      }
    });

    return providerType;
  }

  async setSelectedProvider(type: TwoFactorProviderType): Promise<void> {
    await this.selectedState.update(() => type);
  }

  async clearSelectedProvider(): Promise<void> {
    await this.selectedState.update(() => null);
  }

  async setProviders(response: IdentityTwoFactorResponse): Promise<void> {
    await this.providersState.update(() => response.twoFactorProviders2);
  }

  async clearProviders(): Promise<void> {
    await this.providersState.update(() => null);
  }

  getProviders(): Promise<Map<TwoFactorProviderType, { [key: string]: string }> | null> {
    return firstValueFrom(this.providers$);
  }

  getEnabledTwoFactorProviders(): Promise<ListResponse<TwoFactorProviderResponse>> {
    return this.twoFactorApiService.getTwoFactorProviders();
  }

  getTwoFactorOrganizationProviders(
    organizationId: string,
  ): Promise<ListResponse<TwoFactorProviderResponse>> {
    return this.twoFactorApiService.getTwoFactorOrganizationProviders(organizationId);
  }

  getTwoFactorAuthenticator(
    request: SecretVerificationRequest,
  ): Promise<TwoFactorAuthenticatorResponse> {
    return this.twoFactorApiService.getTwoFactorAuthenticator(request);
  }

  getTwoFactorEmail(request: SecretVerificationRequest): Promise<TwoFactorEmailResponse> {
    return this.twoFactorApiService.getTwoFactorEmail(request);
  }

  getTwoFactorDuo(request: SecretVerificationRequest): Promise<TwoFactorDuoResponse> {
    return this.twoFactorApiService.getTwoFactorDuo(request);
  }

  getTwoFactorOrganizationDuo(
    organizationId: string,
    request: SecretVerificationRequest,
  ): Promise<TwoFactorOrganizationDuoResponse> {
    return this.twoFactorApiService.getTwoFactorOrganizationDuo(organizationId, request);
  }

  getTwoFactorYubiKey(request: SecretVerificationRequest): Promise<TwoFactorYubiKeyResponse> {
    return this.twoFactorApiService.getTwoFactorYubiKey(request);
  }

  getTwoFactorWebAuthn(request: SecretVerificationRequest): Promise<TwoFactorWebAuthnResponse> {
    return this.twoFactorApiService.getTwoFactorWebAuthn(request);
  }

  getTwoFactorWebAuthnChallenge(
    request: TwoFactorWebAuthnChallengeRequest,
  ): Promise<TwoFactorWebAuthnChallengeResponse> {
    return this.twoFactorApiService.getTwoFactorWebAuthnChallenge(request);
  }

  getTwoFactorRecover(request: SecretVerificationRequest): Promise<TwoFactorRecoverResponse> {
    return this.twoFactorApiService.getTwoFactorRecover(request);
  }

  putTwoFactorAuthenticator(
    request: TwoFactorAuthenticatorUpdateRequest,
  ): Promise<TwoFactorAuthenticatorUpdateResponse> {
    return this.twoFactorApiService.putTwoFactorAuthenticator(request);
  }

  deleteTwoFactorAuthenticator(request: TwoFactorAuthenticatorDeleteRequest): Promise<void> {
    return this.twoFactorApiService.deleteTwoFactorAuthenticator(request);
  }

  putTwoFactorEmail(request: TwoFactorEmailUpdateRequest): Promise<TwoFactorEmailUpdateResponse> {
    return this.twoFactorApiService.putTwoFactorEmail(request);
  }

  putTwoFactorDuo(request: TwoFactorDuoUpdateRequest): Promise<TwoFactorDuoUpdateResponse> {
    return this.twoFactorApiService.putTwoFactorDuo(request);
  }

  putTwoFactorOrganizationDuo(
    organizationId: string,
    request: TwoFactorDuoUpdateRequest,
  ): Promise<TwoFactorOrganizationDuoUpdateResponse> {
    return this.twoFactorApiService.putTwoFactorOrganizationDuo(organizationId, request);
  }

  putTwoFactorYubiKey(
    request: TwoFactorYubiKeyUpdateRequest,
  ): Promise<TwoFactorYubiKeyUpdateResponse> {
    return this.twoFactorApiService.putTwoFactorYubiKey(request);
  }

  putTwoFactorWebAuthn(
    request: TwoFactorWebAuthnUpdateRequest,
  ): Promise<TwoFactorWebAuthnUpdateResponse> {
    return this.twoFactorApiService.putTwoFactorWebAuthn(request);
  }

  deleteTwoFactorWebAuthn(
    request: TwoFactorWebAuthnDeleteRequest,
  ): Promise<TwoFactorWebAuthnDeleteResponse> {
    return this.twoFactorApiService.deleteTwoFactorWebAuthn(request);
  }

  deleteTwoFactorYubiKey(request: TwoFactorYubiKeyDeleteRequest): Promise<void> {
    return this.twoFactorApiService.deleteTwoFactorYubiKey(request);
  }

  deleteTwoFactorDuo(request: TwoFactorDuoDeleteRequest): Promise<void> {
    return this.twoFactorApiService.deleteTwoFactorDuo(request);
  }

  deleteTwoFactorEmail(request: TwoFactorEmailDeleteRequest): Promise<void> {
    return this.twoFactorApiService.deleteTwoFactorEmail(request);
  }

  deleteTwoFactorOrganizationDuo(
    organizationId: string,
    request: TwoFactorOrganizationDuoDeleteRequest,
  ): Promise<void> {
    return this.twoFactorApiService.deleteTwoFactorOrganizationDuo(organizationId, request);
  }

  deleteTwoFactorWebAuthnAll(request: TwoFactorWebAuthnDeleteAllRequest): Promise<void> {
    return this.twoFactorApiService.deleteTwoFactorWebAuthnAll(request);
  }

  postTwoFactorEmailSetup(request: TwoFactorEmailSetupRequest): Promise<any> {
    return this.twoFactorApiService.postTwoFactorEmailSetup(request);
  }

  postTwoFactorEmail(request: TwoFactorEmailLoginRequest): Promise<any> {
    return this.twoFactorApiService.postTwoFactorEmail(request);
  }
}
