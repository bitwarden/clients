import { Inject, Injectable } from "@angular/core";

import {
  MEMORY_STORAGE,
  SECURE_STORAGE,
  STATE_FACTORY,
} from "@bitwarden/angular/services/injection-tokens";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import { StateFactory } from "@bitwarden/common/platform/factories/state-factory";
import { Account } from "@bitwarden/common/platform/models/domain/account";
import { GlobalState } from "@bitwarden/common/platform/models/domain/global-state";
import { StorageOptions } from "@bitwarden/common/platform/models/domain/storage-options";
import { MigrationRunner } from "@bitwarden/common/platform/services/migration-runner";
import { StateService as BaseStateService } from "@bitwarden/common/platform/services/state.service";

@Injectable()
export class StateService extends BaseStateService<GlobalState, Account> {
  constructor(
    storageService: AbstractStorageService,
    @Inject(SECURE_STORAGE) secureStorageService: AbstractStorageService,
    @Inject(MEMORY_STORAGE) memoryStorageService: AbstractStorageService,
    logService: LogService,
    @Inject(STATE_FACTORY) stateFactory: StateFactory<GlobalState, Account>,
    accountService: AccountService,
    environmentService: EnvironmentService,
    tokenService: TokenService,
    migrationRunner: MigrationRunner,
  ) {
    super(
      storageService,
      secureStorageService,
      memoryStorageService,
      logService,
      stateFactory,
      accountService,
      environmentService,
      tokenService,
      migrationRunner,
    );
  }

  override async getLastSync(options?: StorageOptions): Promise<string> {
    options = this.reconcileOptions(options, await this.defaultInMemoryOptions());
    return await super.getLastSync(options);
  }

  override async setLastSync(value: string, options?: StorageOptions): Promise<void> {
    options = this.reconcileOptions(options, await this.defaultInMemoryOptions());
    return await super.setLastSync(value, options);
  }
}
