import { StateEventRunnerService } from "@bitwarden/common/platform/state";

import { CachedServices, FactoryOptions, factory } from "./factory-options";
import {
  GlobalStateProviderInitOptions,
  globalStateProviderFactory,
} from "./global-state-provider.factory";
import {
  StorageServiceProviderInitOptions,
  storageServiceProviderFactory,
} from "./storage-service-provider.factory";

type StateEventRunnerServiceFactoryOptions = FactoryOptions;

export type StateEventRunnerServiceInitOptions = StateEventRunnerServiceFactoryOptions &
  GlobalStateProviderInitOptions &
  StorageServiceProviderInitOptions;

export function stateEventRunnerServiceFactory(
  cache: { stateEventRunnerService?: StateEventRunnerService } & CachedServices,
  opts: StateEventRunnerServiceInitOptions,
): Promise<StateEventRunnerService> {
  return factory(
    cache,
    "stateEventRunnerService",
    opts,
    async () =>
      new StateEventRunnerService(
        await globalStateProviderFactory(cache, opts),
        await storageServiceProviderFactory(cache, opts),
      ),
  );
}
