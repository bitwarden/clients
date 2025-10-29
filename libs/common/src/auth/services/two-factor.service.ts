// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, map } from "rxjs";

import { ListResponse } from "../../models/response/list.response";
import { I18nService } from "../../platform/abstractions/i18n.service";
import { PlatformUtilsService } from "../../platform/abstractions/platform-utils.service";
import { Utils } from "../../platform/misc/utils";
import { GlobalStateProvider, KeyDefinition, TWO_FACTOR_MEMORY } from "../../platform/state";
import {
  TwoFactorProviderDetails,
  TwoFactorService as TwoFactorServiceAbstraction,
} from "../abstractions/two-factor.service";
import { TwoFactorProviderType } from "../enums/two-factor-provider-type";
import { DisableTwoFactorAuthenticatorRequest } from "../models/request/disable-two-factor-authenticator.request";
import { SecretVerificationRequest } from "../models/request/secret-verification.request";
import { TwoFactorEmailRequest } from "../models/request/two-factor-email.request";
import { TwoFactorProviderRequest } from "../models/request/two-factor-provider.request";
import { UpdateTwoFactorAuthenticatorRequest } from "../models/request/update-two-factor-authenticator.request";
import { UpdateTwoFactorDuoRequest } from "../models/request/update-two-factor-duo.request";
import { UpdateTwoFactorEmailRequest } from "../models/request/update-two-factor-email.request";
import { UpdateTwoFactorWebAuthnDeleteRequest } from "../models/request/update-two-factor-web-authn-delete.request";
import { UpdateTwoFactorWebAuthnRequest } from "../models/request/update-two-factor-web-authn.request";
import { UpdateTwoFactorYubikeyOtpRequest } from "../models/request/update-two-factor-yubikey-otp.request";
import { IdentityTwoFactorResponse } from "../models/response/identity-two-factor.response";
import { TwoFactorAuthenticatorResponse } from "../models/response/two-factor-authenticator.response";
import { TwoFactorDuoResponse } from "../models/response/two-factor-duo.response";
import { TwoFactorEmailResponse } from "../models/response/two-factor-email.response";
import { TwoFactorProviderResponse } from "../models/response/two-factor-provider.response";
import { TwoFactorRecoverResponse } from "../models/response/two-factor-recover.response";
import {
  TwoFactorWebAuthnResponse,
  ChallengeResponse,
} from "../models/response/two-factor-web-authn.response";
import { TwoFactorYubiKeyResponse } from "../models/response/two-factor-yubi-key.response";
import { TwoFactorApiService } from "../two-factor";

export const TwoFactorProviders: Partial<Record<TwoFactorProviderType, TwoFactorProviderDetails>> =
  {
    [TwoFactorProviderType.Authenticator]: {
      type: TwoFactorProviderType.Authenticator,
      name: null as string,
      description: null as string,
      priority: 1,
      sort: 2,
      premium: false,
    },
    [TwoFactorProviderType.Yubikey]: {
      type: TwoFactorProviderType.Yubikey,
      name: null as string,
      description: null as string,
      priority: 3,
      sort: 4,
      premium: true,
    },
    [TwoFactorProviderType.Duo]: {
      type: TwoFactorProviderType.Duo,
      name: "Duo",
      description: null as string,
      priority: 2,
      sort: 5,
      premium: true,
    },
    [TwoFactorProviderType.OrganizationDuo]: {
      type: TwoFactorProviderType.OrganizationDuo,
      name: "Duo (Organization)",
      description: null as string,
      priority: 10,
      sort: 6,
      premium: false,
    },
    [TwoFactorProviderType.Email]: {
      type: TwoFactorProviderType.Email,
      name: null as string,
      description: null as string,
      priority: 0,
      sort: 1,
      premium: false,
    },
    [TwoFactorProviderType.WebAuthn]: {
      type: TwoFactorProviderType.WebAuthn,
      name: null as string,
      description: null as string,
      priority: 4,
      sort: 3,
      premium: false,
    },
  };

// Memory storage as only required during authentication process
export const PROVIDERS = KeyDefinition.record<Record<string, string>, TwoFactorProviderType>(
  TWO_FACTOR_MEMORY,
  "providers",
  {
    deserializer: (obj) => obj,
  },
);

// Memory storage as only required during authentication process
export const SELECTED_PROVIDER = new KeyDefinition<TwoFactorProviderType>(
  TWO_FACTOR_MEMORY,
  "selected",
  {
    deserializer: (obj) => obj,
  },
);

export class TwoFactorService implements TwoFactorServiceAbstraction {
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
  ): Promise<TwoFactorDuoResponse> {
    return this.twoFactorApiService.getTwoFactorOrganizationDuo(organizationId, request);
  }

  getTwoFactorYubiKey(request: SecretVerificationRequest): Promise<TwoFactorYubiKeyResponse> {
    return this.twoFactorApiService.getTwoFactorYubiKey(request);
  }

  getTwoFactorWebAuthn(request: SecretVerificationRequest): Promise<TwoFactorWebAuthnResponse> {
    return this.twoFactorApiService.getTwoFactorWebAuthn(request);
  }

  getTwoFactorWebAuthnChallenge(request: SecretVerificationRequest): Promise<ChallengeResponse> {
    return this.twoFactorApiService.getTwoFactorWebAuthnChallenge(request);
  }

  getTwoFactorRecover(request: SecretVerificationRequest): Promise<TwoFactorRecoverResponse> {
    return this.twoFactorApiService.getTwoFactorRecover(request);
  }

  putTwoFactorAuthenticator(
    request: UpdateTwoFactorAuthenticatorRequest,
  ): Promise<TwoFactorAuthenticatorResponse> {
    return this.twoFactorApiService.putTwoFactorAuthenticator(request);
  }

  deleteTwoFactorAuthenticator(
    request: DisableTwoFactorAuthenticatorRequest,
  ): Promise<TwoFactorProviderResponse> {
    return this.twoFactorApiService.deleteTwoFactorAuthenticator(request);
  }

  putTwoFactorEmail(request: UpdateTwoFactorEmailRequest): Promise<TwoFactorEmailResponse> {
    return this.twoFactorApiService.putTwoFactorEmail(request);
  }

  putTwoFactorDuo(request: UpdateTwoFactorDuoRequest): Promise<TwoFactorDuoResponse> {
    return this.twoFactorApiService.putTwoFactorDuo(request);
  }

  putTwoFactorOrganizationDuo(
    organizationId: string,
    request: UpdateTwoFactorDuoRequest,
  ): Promise<TwoFactorDuoResponse> {
    return this.twoFactorApiService.putTwoFactorOrganizationDuo(organizationId, request);
  }

  putTwoFactorYubiKey(
    request: UpdateTwoFactorYubikeyOtpRequest,
  ): Promise<TwoFactorYubiKeyResponse> {
    return this.twoFactorApiService.putTwoFactorYubiKey(request);
  }

  putTwoFactorWebAuthn(
    request: UpdateTwoFactorWebAuthnRequest,
  ): Promise<TwoFactorWebAuthnResponse> {
    return this.twoFactorApiService.putTwoFactorWebAuthn(request);
  }

  deleteTwoFactorWebAuthn(
    request: UpdateTwoFactorWebAuthnDeleteRequest,
  ): Promise<TwoFactorWebAuthnResponse> {
    return this.twoFactorApiService.deleteTwoFactorWebAuthn(request);
  }

  putTwoFactorDisable(request: TwoFactorProviderRequest): Promise<TwoFactorProviderResponse> {
    return this.twoFactorApiService.putTwoFactorDisable(request);
  }

  putTwoFactorOrganizationDisable(
    organizationId: string,
    request: TwoFactorProviderRequest,
  ): Promise<TwoFactorProviderResponse> {
    return this.twoFactorApiService.putTwoFactorOrganizationDisable(organizationId, request);
  }

  postTwoFactorEmailSetup(request: TwoFactorEmailRequest): Promise<any> {
    return this.twoFactorApiService.postTwoFactorEmailSetup(request);
  }

  postTwoFactorEmail(request: TwoFactorEmailRequest): Promise<any> {
    return this.twoFactorApiService.postTwoFactorEmail(request);
  }
}
