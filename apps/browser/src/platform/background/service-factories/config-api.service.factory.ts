import { ConfigApiServiceAbstraction } from "@bitwarden/common/platform/abstractions/config/config-api.service.abstraction";
import { ConfigApiService } from "@bitwarden/common/platform/services/config/config-api.service";

import {
  tokenServiceFactory,
  TokenServiceInitOptions,
} from "../../../auth/background/service-factories/token-service.factory";

import { apiServiceFactory, ApiServiceInitOptions } from "./api-service.factory";
import { FactoryOptions, CachedServices, factory } from "./factory-options";

type ConfigApiServiceFactoyOptions = FactoryOptions;

export type ConfigApiServiceInitOptions = ConfigApiServiceFactoyOptions &
  ApiServiceInitOptions &
  TokenServiceInitOptions;

export function configApiServiceFactory(
  cache: { configApiService?: ConfigApiServiceAbstraction } & CachedServices,
  opts: ConfigApiServiceInitOptions,
): Promise<ConfigApiServiceAbstraction> {
  return factory(
    cache,
    "configApiService",
    opts,
    async () =>
      new ConfigApiService(
        await apiServiceFactory(cache, opts),
        await tokenServiceFactory(cache, opts),
      ),
  );
}
