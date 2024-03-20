import { SearchService as AbstractSearchService } from "@bitwarden/common/abstractions/search.service";
import { SearchService } from "@bitwarden/common/services/search.service";

import {
  CachedServices,
  factory,
  FactoryOptions,
} from "../../platform/background/service-factories/factory-options";
import {
  i18nServiceFactory,
  I18nServiceInitOptions,
} from "../../platform/background/service-factories/i18n-service.factory";
import {
  logServiceFactory,
  LogServiceInitOptions,
} from "../../platform/background/service-factories/log-service.factory";
import {
  stateProviderFactory,
  StateProviderInitOptions,
} from "../../platform/background/service-factories/state-provider.factory";

type SearchServiceFactoryOptions = FactoryOptions;

export type SearchServiceInitOptions = SearchServiceFactoryOptions &
  LogServiceInitOptions &
  I18nServiceInitOptions &
  StateProviderInitOptions;

export function searchServiceFactory(
  cache: { searchService?: AbstractSearchService } & CachedServices,
  opts: SearchServiceInitOptions,
): Promise<AbstractSearchService> {
  return factory(
    cache,
    "searchService",
    opts,
    async () =>
      new SearchService(
        await logServiceFactory(cache, opts),
        await i18nServiceFactory(cache, opts),
        await stateProviderFactory(cache, opts),
      ),
  );
}
