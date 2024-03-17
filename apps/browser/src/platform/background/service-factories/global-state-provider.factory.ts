import { GlobalStateProvider } from "@bitwarden/common/platform/state";
// eslint-disable-next-line import/no-restricted-paths -- We need the implementation to inject, but generally this should not be accessed
import { DefaultGlobalStateProvider } from "@bitwarden/common/platform/state/implementations/default-global-state.provider";

import { CachedServices, FactoryOptions, factory } from "./factory-options";
import {
  StorageServiceProviderInitOptions,
  storageServiceProviderFactory,
} from "./storage-service-provider.factory";

type GlobalStateProviderFactoryOptions = FactoryOptions;

export type GlobalStateProviderInitOptions = GlobalStateProviderFactoryOptions &
  StorageServiceProviderInitOptions;

export async function globalStateProviderFactory(
  cache: { globalStateProvider?: GlobalStateProvider } & CachedServices,
  opts: GlobalStateProviderInitOptions,
): Promise<GlobalStateProvider> {
  return factory(
    cache,
    "globalStateProvider",
    opts,
    async () => new DefaultGlobalStateProvider(await storageServiceProviderFactory(cache, opts)),
  );
}
