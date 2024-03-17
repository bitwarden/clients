// eslint-disable-next-line import/no-restricted-paths
import { StateEventRegistrarService } from "@bitwarden/common/platform/state/state-event-registrar.service";

import { CachedServices, FactoryOptions, factory } from "./factory-options";
import {
  GlobalStateProviderInitOptions,
  globalStateProviderFactory,
} from "./global-state-provider.factory";
import {
  StorageServiceProviderInitOptions,
  storageServiceProviderFactory,
} from "./storage-service-provider.factory";

type StateEventRegistrarServiceFactoryOptions = FactoryOptions;

export type StateEventRegistrarServiceInitOptions = StateEventRegistrarServiceFactoryOptions &
  GlobalStateProviderInitOptions &
  StorageServiceProviderInitOptions;

export async function stateEventRegistrarServiceFactory(
  cache: {
    stateEventRegistrarService?: StateEventRegistrarService;
  } & CachedServices,
  opts: StateEventRegistrarServiceInitOptions,
): Promise<StateEventRegistrarService> {
  return factory(
    cache,
    "stateEventRegistrarService",
    opts,
    async () =>
      new StateEventRegistrarService(
        await globalStateProviderFactory(cache, opts),
        await storageServiceProviderFactory(cache, opts),
      ),
  );
}
