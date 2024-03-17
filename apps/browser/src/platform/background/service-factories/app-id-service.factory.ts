import { AppIdService as AbstractAppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { AppIdService } from "@bitwarden/common/platform/services/app-id.service";

import { FactoryOptions, CachedServices, factory } from "./factory-options";
import {
  GlobalStateProviderInitOptions,
  globalStateProviderFactory,
} from "./global-state-provider.factory";

type AppIdServiceFactoryOptions = FactoryOptions;

export type AppIdServiceInitOptions = AppIdServiceFactoryOptions & GlobalStateProviderInitOptions;

export function appIdServiceFactory(
  cache: { appIdService?: AbstractAppIdService } & CachedServices,
  opts: AppIdServiceInitOptions,
): Promise<AbstractAppIdService> {
  return factory(
    cache,
    "appIdService",
    opts,
    async () => new AppIdService(await globalStateProviderFactory(cache, opts)),
  );
}
