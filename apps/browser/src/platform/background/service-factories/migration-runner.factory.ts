import { MigrationBuilderService } from "@bitwarden/common/platform/services/migration-builder.service";
import { MigrationRunner } from "@bitwarden/common/platform/services/migration-runner";

import { CachedServices, FactoryOptions, factory } from "./factory-options";
import { LogServiceInitOptions, logServiceFactory } from "./log-service.factory";
import {
  DiskStorageServiceInitOptions,
  diskStorageServiceFactory,
} from "./storage-service.factory";

type MigrationRunnerFactory = FactoryOptions;

export type MigrationRunnerInitOptions = MigrationRunnerFactory &
  DiskStorageServiceInitOptions &
  LogServiceInitOptions;

export async function migrationRunnerFactory(
  cache: { migrationRunner?: MigrationRunner } & CachedServices,
  opts: MigrationRunnerInitOptions,
): Promise<MigrationRunner> {
  return factory(
    cache,
    "migrationRunner",
    opts,
    async () =>
      new MigrationRunner(
        await diskStorageServiceFactory(cache, opts),
        await logServiceFactory(cache, opts),
        new MigrationBuilderService(),
      ),
  );
}
