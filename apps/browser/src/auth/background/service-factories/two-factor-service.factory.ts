import { TwoFactorService as AbstractTwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { TwoFactorService } from "@bitwarden/common/auth/services/two-factor.service";

import {
  FactoryOptions,
  CachedServices,
  factory,
} from "../../../platform/background/service-factories/factory-options";
import {
  I18nServiceInitOptions,
  i18nServiceFactory,
} from "../../../platform/background/service-factories/i18n-service.factory";
import {
  PlatformUtilsServiceInitOptions,
  platformUtilsServiceFactory,
} from "../../../platform/background/service-factories/platform-utils-service.factory";

type TwoFactorServiceFactoryOptions = FactoryOptions;

export type TwoFactorServiceInitOptions = TwoFactorServiceFactoryOptions &
  I18nServiceInitOptions &
  PlatformUtilsServiceInitOptions;

export async function twoFactorServiceFactory(
  cache: { twoFactorService?: AbstractTwoFactorService } & CachedServices,
  opts: TwoFactorServiceInitOptions,
): Promise<AbstractTwoFactorService> {
  const service = await factory(
    cache,
    "twoFactorService",
    opts,
    async () =>
      new TwoFactorService(
        await i18nServiceFactory(cache, opts),
        await platformUtilsServiceFactory(cache, opts),
      ),
  );
  return service;
}
