import { Observable, combineLatest, firstValueFrom, map } from "rxjs";

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

export const PROVIDERS = KeyDefinition.record<Record<string, string>, TwoFactorProviderType>(
  TWO_FACTOR_MEMORY,
  "providers",
  {
    deserializer: (obj) => obj,
  },
);

export const SELECTED = new KeyDefinition<TwoFactorProviderType>(TWO_FACTOR_MEMORY, "selected", {
  deserializer: (obj) => obj,
});

export class TwoFactorService implements TwoFactorServiceAbstraction {
  private providersState = this.globalStateProvider.get(PROVIDERS);
  private selectedState = this.globalStateProvider.get(SELECTED);
  readonly providers$ = this.providersState.state$.pipe(
    map((providers) => Utils.recordToMap(providers)),
  );
  readonly selected$ = this.selectedState.state$;
  private twoFactorProvidersData: Map<TwoFactorProviderType, { [key: string]: string }>;
  private selectedTwoFactorProviderType: TwoFactorProviderType = null;

  constructor(
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private globalStateProvider: GlobalStateProvider,
  ) {
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

  getSupportedProviders$(win: Window): Observable<TwoFactorProviderDetails[]> {
    return this.providers$.pipe(
      map((twoFactorProvidersData) => {
        const providers: any[] = [];
        if (twoFactorProvidersData == null) {
          return providers;
        }

        if (
          twoFactorProvidersData.has(TwoFactorProviderType.OrganizationDuo) &&
          this.platformUtilsService.supportsDuo()
        ) {
          providers.push(TwoFactorProviders[TwoFactorProviderType.OrganizationDuo]);
        }

        if (twoFactorProvidersData.has(TwoFactorProviderType.Authenticator)) {
          providers.push(TwoFactorProviders[TwoFactorProviderType.Authenticator]);
        }

        if (twoFactorProvidersData.has(TwoFactorProviderType.Yubikey)) {
          providers.push(TwoFactorProviders[TwoFactorProviderType.Yubikey]);
        }

        if (
          twoFactorProvidersData.has(TwoFactorProviderType.Duo) &&
          this.platformUtilsService.supportsDuo()
        ) {
          providers.push(TwoFactorProviders[TwoFactorProviderType.Duo]);
        }

        if (
          twoFactorProvidersData.has(TwoFactorProviderType.WebAuthn) &&
          this.platformUtilsService.supportsWebAuthn(win)
        ) {
          providers.push(TwoFactorProviders[TwoFactorProviderType.WebAuthn]);
        }

        if (twoFactorProvidersData.has(TwoFactorProviderType.Email)) {
          providers.push(TwoFactorProviders[TwoFactorProviderType.Email]);
        }

        return providers;
      }),
    );
  }

  getDefaultProvider$(webAuthnSupported: boolean): Observable<TwoFactorProviderType> {
    return combineLatest([this.providers$, this.selected$]).pipe(
      map(([providers, selected]) => {
        if (providers == null) {
          return null;
        }

        if (selected != null && providers.has(selected)) {
          return selected;
        }

        let providerType: TwoFactorProviderType = null;
        let providerPriority = -1;
        providers.forEach((_value, type) => {
          const provider = TwoFactorProviders[type];
          if (provider != null && provider.priority > providerPriority) {
            if (type === TwoFactorProviderType.WebAuthn && !webAuthnSupported) {
              return;
            }

            providerType = type;
            providerPriority = provider.priority;
          }
        });

        return providerType;
      }),
    );
  }

  async setSelectedProvider(type: TwoFactorProviderType) {
    await this.selectedState.update(() => type);
  }

  async clearSelectedProvider() {
    await this.selectedState.update(() => null);
  }

  async setProviders(response: IdentityTwoFactorResponse) {
    await this.providersState.update(() => response.twoFactorProviders2);
  }

  async clearProviders() {
    await this.providersState.update(() => null);
  }

  async getProviders() {
    return firstValueFrom(this.providers$);
  }
}
