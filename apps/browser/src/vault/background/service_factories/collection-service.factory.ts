import { CollectionService as AbstractCollectionService } from "@bitwarden/common/vault/abstractions/collection.service";
import { CollectionService } from "@bitwarden/common/vault/services/collection.service";

import {
  cryptoServiceFactory,
  CryptoServiceInitOptions,
} from "../../../platform/background/service-factories/crypto-service.factory";
import {
  CachedServices,
  factory,
  FactoryOptions,
} from "../../../platform/background/service-factories/factory-options";
import {
  i18nServiceFactory,
  I18nServiceInitOptions,
} from "../../../platform/background/service-factories/i18n-service.factory";
import { stateProviderFactory } from "../../../platform/background/service-factories/state-provider.factory";
import { StateServiceInitOptions } from "../../../platform/background/service-factories/state-service.factory";

type CollectionServiceFactoryOptions = FactoryOptions;

export type CollectionServiceInitOptions = CollectionServiceFactoryOptions &
  CryptoServiceInitOptions &
  I18nServiceInitOptions &
  StateServiceInitOptions;

export function collectionServiceFactory(
  cache: { collectionService?: AbstractCollectionService } & CachedServices,
  opts: CollectionServiceInitOptions,
): Promise<AbstractCollectionService> {
  return factory(
    cache,
    "collectionService",
    opts,
    async () =>
      new CollectionService(
        await cryptoServiceFactory(cache, opts),
        await i18nServiceFactory(cache, opts),
        await stateProviderFactory(cache, opts),
      ),
  );
}
