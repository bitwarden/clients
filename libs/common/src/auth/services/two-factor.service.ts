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
import { Verification } from "../types/verification";

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

  async getEnabledTwoFactorProviders(): Promise<ListResponse<TwoFactorProviderResponse>> {
    return this.twoFactorApiService.getTwoFactorProviders();
  }

  getTwoFactorOrganizationProviders(
    organizationId: string,
  ): Promise<ListResponse<TwoFactorProviderResponse>> {
    throw new Error("Method not implemented.");
  }
  getTwoFactorAuthenticator(verification: Verification): Promise<TwoFactorAuthenticatorResponse> {
    throw new Error("Method not implemented.");
  }
  getTwoFactorEmail(verification: Verification): Promise<TwoFactorEmailResponse> {
    throw new Error("Method not implemented.");
  }
  getTwoFactorDuo(verification: Verification): Promise<TwoFactorDuoResponse> {
    throw new Error("Method not implemented.");
  }
  getTwoFactorOrganizationDuo(
    organizationId: string,
    verification: Verification,
  ): Promise<TwoFactorDuoResponse> {
    throw new Error("Method not implemented.");
  }
  getTwoFactorYubiKey(verification: Verification): Promise<TwoFactorYubiKeyResponse> {
    throw new Error("Method not implemented.");
  }
  getTwoFactorWebAuthn(verification: Verification): Promise<TwoFactorWebAuthnResponse> {
    throw new Error("Method not implemented.");
  }
  getTwoFactorWebAuthnChallenge(verification: Verification): Promise<ChallengeResponse> {
    throw new Error("Method not implemented.");
  }
  getTwoFactorRecover(verification: Verification): Promise<TwoFactorRecoverResponse> {
    throw new Error("Method not implemented.");
  }
  putTwoFactorAuthenticator(verification: Verification): Promise<TwoFactorAuthenticatorResponse> {
    throw new Error("Method not implemented.");
  }
  deleteTwoFactorAuthenticator(verification: Verification): Promise<TwoFactorProviderResponse> {
    throw new Error("Method not implemented.");
  }
  putTwoFactorEmail(verification: Verification): Promise<TwoFactorEmailResponse> {
    throw new Error("Method not implemented.");
  }
  putTwoFactorDuo(verification: Verification): Promise<TwoFactorDuoResponse> {
    throw new Error("Method not implemented.");
  }
  putTwoFactorOrganizationDuo(
    organizationId: string,
    verification: Verification,
  ): Promise<TwoFactorDuoResponse> {
    throw new Error("Method not implemented.");
  }
  putTwoFactorYubiKey(verification: Verification): Promise<TwoFactorYubiKeyResponse> {
    throw new Error("Method not implemented.");
  }
  putTwoFactorWebAuthn(verification: Verification): Promise<TwoFactorWebAuthnResponse> {
    throw new Error("Method not implemented.");
  }
  deleteTwoFactorWebAuthn(verification: Verification): Promise<TwoFactorWebAuthnResponse> {
    throw new Error("Method not implemented.");
  }
  putTwoFactorDisable(verification: Verification): Promise<TwoFactorProviderResponse> {
    throw new Error("Method not implemented.");
  }
  putTwoFactorOrganizationDisable(
    organizationId: string,
    verification: Verification,
  ): Promise<TwoFactorProviderResponse> {
    throw new Error("Method not implemented.");
  }
  postTwoFactorEmailSetup(verification: Verification): Promise<any> {
    throw new Error("Method not implemented.");
  }
  postTwoFactorEmail(verification: Verification): Promise<any> {
    throw new Error("Method not implemented.");
  }
}
