import { BehaviorSubject, Observable } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { StateMigrationService } from "@bitwarden/common/platform/abstractions/state-migration.service";
import {
  AbstractStorageService,
  AbstractMemoryStorageService,
} from "@bitwarden/common/platform/abstractions/storage.service";
import { StateFactory } from "@bitwarden/common/platform/factories/state-factory";
import { GlobalState } from "@bitwarden/common/platform/models/domain/global-state";
import { StorageOptions } from "@bitwarden/common/platform/models/domain/storage-options";
import { StateService as BaseStateService } from "@bitwarden/common/platform/services/state.service";

import { Account } from "../../models/account";
import { BrowserComponentState } from "../../models/browserComponentState";
import { BrowserGroupingsComponentState } from "../../models/browserGroupingsComponentState";
import { BrowserSendComponentState } from "../../models/browserSendComponentState";
import { browserSession, sessionSync } from "../decorators/session-sync-observable";

import { BrowserStateService as StateServiceAbstraction } from "./abstractions/browser-state.service";

@browserSession
export class BrowserStateService
  extends BaseStateService<GlobalState, Account>
  implements StateServiceAbstraction
{
  @sessionSync({
    initializer: Account.fromJSON as any, // TODO: Remove this any when all any types are removed from Account
    initializeAs: "record",
  })
  protected accountsSubject: BehaviorSubject<{ [userId: string]: Account }>;
  @sessionSync({ initializer: (s: string) => s })
  protected activeAccountSubject: BehaviorSubject<string>;
  @sessionSync({ initializer: (b: boolean) => b })
  protected activeAccountUnlockedSubject: BehaviorSubject<boolean>;

  protected accountDeserializer = Account.fromJSON;

  constructor(
    storageService: AbstractStorageService,
    secureStorageService: AbstractStorageService,
    memoryStorageService: AbstractMemoryStorageService,
    logService: LogService,
    stateMigrationService: StateMigrationService,
    stateFactory: StateFactory<GlobalState, Account>,
    useAccountCache = true,
    accountCache: Observable<Record<string, Account>> = null
  ) {
    super(
      storageService,
      secureStorageService,
      memoryStorageService,
      logService,
      stateMigrationService,
      stateFactory,
      useAccountCache
    );

    // Hack to allow shared disk cache between contexts on browser
    // TODO: Remove when services are consolidated to a single context
    if (useAccountCache && accountCache) {
      accountCache.subscribe(this.accountDiskCacheSubject);
    }
  }

  async addAccount(account: Account) {
    // Apply browser overrides to default account values
    account = new Account(account);
    await super.addAccount(account);
  }

  async getIsAuthenticated(options?: StorageOptions): Promise<boolean> {
    // Firefox Private Mode can clash with non-Private Mode because they both read from the same onDiskOptions
    // Check that there is an account in memory before considering the user authenticated
    return (
      (await super.getIsAuthenticated(options)) &&
      (await this.getAccount(await this.defaultInMemoryOptions())) != null
    );
  }

  async getBrowserGroupingComponentState(
    options?: StorageOptions
  ): Promise<BrowserGroupingsComponentState> {
    return (
      await this.getAccount(this.reconcileOptions(options, await this.defaultInMemoryOptions()))
    )?.groupings;
  }

  async setBrowserGroupingComponentState(
    value: BrowserGroupingsComponentState,
    options?: StorageOptions
  ): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultInMemoryOptions())
    );
    account.groupings = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultInMemoryOptions())
    );
  }

  async getBrowserVaultItemsComponentState(
    options?: StorageOptions
  ): Promise<BrowserComponentState> {
    return (
      await this.getAccount(this.reconcileOptions(options, await this.defaultInMemoryOptions()))
    )?.ciphers;
  }

  async setBrowserVaultItemsComponentState(
    value: BrowserComponentState,
    options?: StorageOptions
  ): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultInMemoryOptions())
    );
    account.ciphers = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultInMemoryOptions())
    );
  }

  async getBrowserSendComponentState(options?: StorageOptions): Promise<BrowserSendComponentState> {
    return (
      await this.getAccount(this.reconcileOptions(options, await this.defaultInMemoryOptions()))
    )?.send;
  }

  async setBrowserSendComponentState(
    value: BrowserSendComponentState,
    options?: StorageOptions
  ): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultInMemoryOptions())
    );
    account.send = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultInMemoryOptions())
    );
  }

  async getBrowserSendTypeComponentState(options?: StorageOptions): Promise<BrowserComponentState> {
    return (
      await this.getAccount(this.reconcileOptions(options, await this.defaultInMemoryOptions()))
    )?.sendType;
  }

  async setBrowserSendTypeComponentState(
    value: BrowserComponentState,
    options?: StorageOptions
  ): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultInMemoryOptions())
    );
    account.sendType = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultInMemoryOptions())
    );
  }
}
