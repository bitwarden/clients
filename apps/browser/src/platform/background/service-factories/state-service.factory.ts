import { StateFactory } from "@bitwarden/common/platform/factories/state-factory";
import { GlobalState } from "@bitwarden/common/platform/models/domain/global-state";

import {
  accountServiceFactory,
  AccountServiceInitOptions,
} from "../../../auth/background/service-factories/account-service.factory";
import {
  tokenServiceFactory,
  TokenServiceInitOptions,
} from "../../../auth/background/service-factories/token-service.factory";
import { Account } from "../../../models/account";
import { BrowserStateService } from "../../services/browser-state.service";

import {
  environmentServiceFactory,
  EnvironmentServiceInitOptions,
} from "./environment-service.factory";
import { CachedServices, factory, FactoryOptions } from "./factory-options";
import { logServiceFactory, LogServiceInitOptions } from "./log-service.factory";
import { migrationRunnerFactory, MigrationRunnerInitOptions } from "./migration-runner.factory";
import {
  diskStorageServiceFactory,
  secureStorageServiceFactory,
  memoryStorageServiceFactory,
  DiskStorageServiceInitOptions,
  SecureStorageServiceInitOptions,
  MemoryStorageServiceInitOptions,
} from "./storage-service.factory";

type StateServiceFactoryOptions = FactoryOptions & {
  stateServiceOptions: {
    useAccountCache?: boolean;
    stateFactory: StateFactory<GlobalState, Account>;
  };
};

export type StateServiceInitOptions = StateServiceFactoryOptions &
  DiskStorageServiceInitOptions &
  SecureStorageServiceInitOptions &
  MemoryStorageServiceInitOptions &
  LogServiceInitOptions &
  AccountServiceInitOptions &
  EnvironmentServiceInitOptions &
  TokenServiceInitOptions &
  MigrationRunnerInitOptions;

export async function stateServiceFactory(
  cache: { stateService?: BrowserStateService } & CachedServices,
  opts: StateServiceInitOptions,
): Promise<BrowserStateService> {
  const service = await factory(
    cache,
    "stateService",
    opts,
    async () =>
      new BrowserStateService(
        await diskStorageServiceFactory(cache, opts),
        await secureStorageServiceFactory(cache, opts),
        await memoryStorageServiceFactory(cache, opts),
        await logServiceFactory(cache, opts),
        opts.stateServiceOptions.stateFactory,
        await accountServiceFactory(cache, opts),
        await environmentServiceFactory(cache, opts),
        await tokenServiceFactory(cache, opts),
        await migrationRunnerFactory(cache, opts),
        opts.stateServiceOptions.useAccountCache,
      ),
  );
  // TODO: If we run migration through a chrome installed/updated event we can turn off running migrations
  await service.init();
  return service;
}
