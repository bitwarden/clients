import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { DefaultConfigService } from "@bitwarden/common/platform/services/config/default-config.service";

import { configApiServiceFactory, ConfigApiServiceInitOptions } from "./config-api.service.factory";
import {
  environmentServiceFactory,
  EnvironmentServiceInitOptions,
} from "./environment-service.factory";
import { FactoryOptions, CachedServices, factory } from "./factory-options";
import { logServiceFactory, LogServiceInitOptions } from "./log-service.factory";
import { stateProviderFactory, StateProviderInitOptions } from "./state-provider.factory";

type ConfigServiceFactoryOptions = FactoryOptions;

export type ConfigServiceInitOptions = ConfigServiceFactoryOptions &
  ConfigApiServiceInitOptions &
  EnvironmentServiceInitOptions &
  LogServiceInitOptions &
  StateProviderInitOptions;

export function configServiceFactory(
  cache: { configService?: ConfigService } & CachedServices,
  opts: ConfigServiceInitOptions,
): Promise<ConfigService> {
  return factory(
    cache,
    "configService",
    opts,
    async () =>
      new DefaultConfigService(
        await configApiServiceFactory(cache, opts),
        await environmentServiceFactory(cache, opts),
        await logServiceFactory(cache, opts),
        await stateProviderFactory(cache, opts),
      ),
  );
}
