import { I18nService } from "../../platform/abstractions/i18n.service";
import { PlatformUtilsService } from "../../platform/abstractions/platform-utils.service";
import {
  TwoFactorProviderDetails,
  TwoFactorService as TwoFactorServiceAbstraction,
} from "../abstractions/two-factor.service";
import { TwoFactorProviderType } from "../enums/two-factor-provider-type";
import { IdentityTwoFactorResponse } from "../models/response/identity-two-factor.response";

export const TwoFactorProviders: Partial<Record<TwoFactorProviderType, TwoFactorProviderDetails>> =
  {
    [TwoFactorProviderType.Authenticator]: {
      type: TwoFactorProviderType.Authenticator,
      name: null as string,
      description: null as string,
      priority: 1,
      sort: 1,
      premium: false,
    },
    [TwoFactorProviderType.Yubikey]: {
      type: TwoFactorProviderType.Yubikey,
      name: null as string,
      description: null as string,
      priority: 3,
      sort: 2,
      premium: true,
    },
    [TwoFactorProviderType.Duo]: {
      type: TwoFactorProviderType.Duo,
      name: "Duo",
      description: null as string,
      priority: 2,
      sort: 3,
      premium: true,
    },
    [TwoFactorProviderType.OrganizationDuo]: {
      type: TwoFactorProviderType.OrganizationDuo,
      name: "Duo (Organization)",
      description: null as string,
      priority: 10,
      sort: 4,
      premium: false,
    },
    [TwoFactorProviderType.Email]: {
      type: TwoFactorProviderType.Email,
      name: null as string,
      description: null as string,
      priority: 0,
      sort: 6,
      premium: false,
    },
    [TwoFactorProviderType.WebAuthn]: {
      type: TwoFactorProviderType.WebAuthn,
      name: null as string,
      description: null as string,
      priority: 4,
      sort: 5,
      premium: false,
    },
  };

export class TwoFactorService implements TwoFactorServiceAbstraction {
  private twoFactorProvidersData: Map<TwoFactorProviderType, { [key: string]: string }>;
  private selectedTwoFactorProviderType: TwoFactorProviderType = null;

  constructor(
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService
  ) {}

  init() {
    TwoFactorProviders[TwoFactorProviderType.Email].name = this.i18nService.t("emailTitle");
    TwoFactorProviders[TwoFactorProviderType.Email].description = this.i18nService.t("emailDesc");

    TwoFactorProviders[TwoFactorProviderType.Authenticator].name =
      this.i18nService.t("authenticatorAppTitle");
    TwoFactorProviders[TwoFactorProviderType.Authenticator].description =
      this.i18nService.t("authenticatorAppDesc");

    TwoFactorProviders[TwoFactorProviderType.Duo].description = this.i18nService.t("duoDesc");

    TwoFactorProviders[TwoFactorProviderType.OrganizationDuo].name =
      "Duo (" + this.i18nService.t("organization") + ")";
    TwoFactorProviders[TwoFactorProviderType.OrganizationDuo].description =
      this.i18nService.t("duoOrganizationDesc");

    TwoFactorProviders[TwoFactorProviderType.WebAuthn].name = this.i18nService.t("webAuthnTitle");
    TwoFactorProviders[TwoFactorProviderType.WebAuthn].description =
      this.i18nService.t("webAuthnDesc");

    TwoFactorProviders[TwoFactorProviderType.Yubikey].name = this.i18nService.t("yubiKeyTitle");
    TwoFactorProviders[TwoFactorProviderType.Yubikey].description =
      this.i18nService.t("yubiKeyDesc");
  }

  getSupportedProviders(win: Window): TwoFactorProviderDetails[] {
    const providers: any[] = [];
    if (this.twoFactorProvidersData == null) {
      return providers;
    }

    if (
      this.twoFactorProvidersData.has(TwoFactorProviderType.OrganizationDuo) &&
      this.platformUtilsService.supportsDuo()
    ) {
      providers.push(TwoFactorProviders[TwoFactorProviderType.OrganizationDuo]);
    }

    if (this.twoFactorProvidersData.has(TwoFactorProviderType.Authenticator)) {
      providers.push(TwoFactorProviders[TwoFactorProviderType.Authenticator]);
    }

    if (this.twoFactorProvidersData.has(TwoFactorProviderType.Yubikey)) {
      providers.push(TwoFactorProviders[TwoFactorProviderType.Yubikey]);
    }

    if (
      this.twoFactorProvidersData.has(TwoFactorProviderType.Duo) &&
      this.platformUtilsService.supportsDuo()
    ) {
      providers.push(TwoFactorProviders[TwoFactorProviderType.Duo]);
    }

    if (
      this.twoFactorProvidersData.has(TwoFactorProviderType.WebAuthn) &&
      this.platformUtilsService.supportsWebAuthn(win)
    ) {
      providers.push(TwoFactorProviders[TwoFactorProviderType.WebAuthn]);
    }

    if (this.twoFactorProvidersData.has(TwoFactorProviderType.Email)) {
      providers.push(TwoFactorProviders[TwoFactorProviderType.Email]);
    }

    return providers;
  }

  getDefaultProvider(webAuthnSupported: boolean): TwoFactorProviderType {
    if (this.twoFactorProvidersData == null) {
      return null;
    }

    if (
      this.selectedTwoFactorProviderType != null &&
      this.twoFactorProvidersData.has(this.selectedTwoFactorProviderType)
    ) {
      return this.selectedTwoFactorProviderType;
    }

    let providerType: TwoFactorProviderType = null;
    let providerPriority = -1;
    this.twoFactorProvidersData.forEach((_value, type) => {
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

  setSelectedProvider(type: TwoFactorProviderType) {
    this.selectedTwoFactorProviderType = type;
  }

  clearSelectedProvider() {
    this.selectedTwoFactorProviderType = null;
  }

  setProviders(response: IdentityTwoFactorResponse) {
    this.twoFactorProvidersData = response.twoFactorProviders2;
  }

  clearProviders() {
    this.twoFactorProvidersData = null;
  }

  getProviders() {
    return this.twoFactorProvidersData;
  }
}
