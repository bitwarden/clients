import { BadgeSettingsService } from "@bitwarden/common/autofill/services/badge-settings.service";

import {
  CachedServices,
  factory,
  FactoryOptions,
} from "../../../platform/background/service-factories/factory-options";
import {
  stateProviderFactory,
  StateProviderInitOptions,
} from "../../../platform/background/service-factories/state-provider.factory";

export type BadgeSettingsServiceInitOptions = FactoryOptions & StateProviderInitOptions;

export function badgeSettingsServiceFactory(
  cache: { badgeSettingsService?: BadgeSettingsService } & CachedServices,
  opts: BadgeSettingsServiceInitOptions,
): Promise<BadgeSettingsService> {
  return factory(
    cache,
    "badgeSettingsService",
    opts,
    async () => new BadgeSettingsService(await stateProviderFactory(cache, opts)),
  );
}
