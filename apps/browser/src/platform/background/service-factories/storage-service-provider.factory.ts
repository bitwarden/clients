import { StorageServiceProvider } from "@bitwarden/common/platform/services/storage-service.provider";

import { CachedServices, FactoryOptions, factory } from "./factory-options";
import {
  DiskStorageServiceInitOptions,
  MemoryStorageServiceInitOptions,
  observableDiskStorageServiceFactory,
  observableMemoryStorageServiceFactory,
} from "./storage-service.factory";

type StorageServiceProviderFactoryOptions = FactoryOptions;

export type StorageServiceProviderInitOptions = StorageServiceProviderFactoryOptions &
  MemoryStorageServiceInitOptions &
  DiskStorageServiceInitOptions;

export async function storageServiceProviderFactory(
  cache: {
    storageServiceProvider?: StorageServiceProvider;
  } & CachedServices,
  opts: StorageServiceProviderInitOptions,
): Promise<StorageServiceProvider> {
  return factory(
    cache,
    "storageServiceProvider",
    opts,
    async () =>
      new StorageServiceProvider(
        await observableDiskStorageServiceFactory(cache, opts),
        await observableMemoryStorageServiceFactory(cache, opts),
      ),
  );
}
