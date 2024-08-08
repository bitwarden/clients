import { firstValueFrom, map } from "rxjs";
import { Jsonify, JsonValue } from "type-fest";

import { AccountService } from "../../auth/abstractions/account.service";
import { TokenService } from "../../auth/abstractions/token.service";
import { BiometricKey } from "../../auth/types/biometric-key";
import { UserId } from "../../types/guid";
import { EnvironmentService } from "../abstractions/environment.service";
import { LogService } from "../abstractions/log.service";
import {
  InitOptions,
  StateService as StateServiceAbstraction,
} from "../abstractions/state.service";
import { AbstractStorageService } from "../abstractions/storage.service";
import { HtmlStorageLocation, StorageLocation } from "../enums";
import { StateFactory } from "../factories/state-factory";
import { Account } from "../models/domain/account";
import { GlobalState } from "../models/domain/global-state";
import { State } from "../models/domain/state";
import { StorageOptions } from "../models/domain/storage-options";

import { MigrationRunner } from "./migration-runner";

const keys = {
  state: "state",
  stateVersion: "stateVersion",
  global: "global",
  tempAccountSettings: "tempAccountSettings", // used to hold account specific settings (i.e clear clipboard) between initial migration and first account authentication
};

const partialKeys = {
  userAutoKey: "_user_auto",
  userBiometricKey: "_user_biometric",

  autoKey: "_masterkey_auto",
  masterKey: "_masterkey",
};

const DDG_SHARED_KEY = "DuckDuckGoSharedKey";

export class StateService<
  TGlobalState extends GlobalState = GlobalState,
  TAccount extends Account = Account,
> implements StateServiceAbstraction<TAccount>
{
  private hasBeenInited = false;
  protected isRecoveredSession = false;

  // default account serializer, must be overridden by child class
  protected accountDeserializer = Account.fromJSON as (json: Jsonify<TAccount>) => TAccount;

  constructor(
    protected storageService: AbstractStorageService,
    protected secureStorageService: AbstractStorageService,
    protected memoryStorageService: AbstractStorageService,
    protected logService: LogService,
    protected stateFactory: StateFactory<TGlobalState, TAccount>,
    protected accountService: AccountService,
    protected environmentService: EnvironmentService,
    protected tokenService: TokenService,
    private migrationRunner: MigrationRunner,
  ) {}

  async init(initOptions: InitOptions = {}): Promise<void> {
    // Deconstruct and apply defaults
    const { runMigrations = true } = initOptions;
    if (this.hasBeenInited) {
      return;
    }

    if (runMigrations) {
      await this.migrationRunner.run();
    } else {
      // It may have been requested to not run the migrations but we should defensively not
      // continue this method until migrations have a chance to be completed elsewhere.
      await this.migrationRunner.waitForCompletion();
    }

    await this.state().then(async (state) => {
      if (state == null) {
        await this.setState(new State<TGlobalState, TAccount>(this.createGlobals()));
      } else {
        this.isRecoveredSession = true;
      }
    });
    await this.initAccountState();

    this.hasBeenInited = true;
  }

  async initAccountState() {
    if (this.isRecoveredSession) {
      return;
    }

    // Get all likely authenticated accounts
    const authenticatedAccounts = await firstValueFrom(
      this.accountService.accounts$.pipe(map((accounts) => Object.keys(accounts))),
    );

    await this.updateState(async (state) => {
      for (const i in authenticatedAccounts) {
        state = await this.syncAccountFromDisk(authenticatedAccounts[i]);
      }

      return state;
    });
  }

  async syncAccountFromDisk(userId: string): Promise<State<TGlobalState, TAccount>> {
    if (userId == null) {
      return;
    }
    const diskAccount = await this.getAccountFromDisk({ userId: userId });
    const state = await this.updateState(async (state) => {
      if (state.accounts == null) {
        state.accounts = {};
      }
      state.accounts[userId] = this.createAccount();
      state.accounts[userId].profile = diskAccount.profile;
      return state;
    });

    return state;
  }

  async addAccount(account: TAccount) {
    await this.environmentService.seedUserEnvironment(account.profile.userId as UserId);
    await this.updateState(async (state) => {
      state.accounts[account.profile.userId] = account;
      return state;
    });
    await this.scaffoldNewAccountStorage(account);
  }

  async clean(options?: StorageOptions): Promise<void> {
    options = this.reconcileOptions(options, await this.defaultInMemoryOptions());
    await this.deAuthenticateAccount(options.userId);

    await this.removeAccountFromDisk(options?.userId);
    await this.removeAccountFromMemory(options?.userId);
  }

  /**
   * user key when using the "never" option of vault timeout
   */
  async getUserKeyAutoUnlock(options?: StorageOptions): Promise<string> {
    options = this.reconcileOptions(
      this.reconcileOptions(options, { keySuffix: "auto" }),
      await this.defaultSecureStorageOptions(),
    );
    if (options?.userId == null) {
      return null;
    }
    return await this.secureStorageService.get<string>(
      `${options.userId}${partialKeys.userAutoKey}`,
      options,
    );
  }

  /**
   * user key when using the "never" option of vault timeout
   */
  async setUserKeyAutoUnlock(value: string, options?: StorageOptions): Promise<void> {
    options = this.reconcileOptions(
      this.reconcileOptions(options, { keySuffix: "auto" }),
      await this.defaultSecureStorageOptions(),
    );
    if (options?.userId == null) {
      return;
    }
    await this.saveSecureStorageKey(partialKeys.userAutoKey, value, options);
  }

  /**
   * User's encrypted symmetric key when using biometrics
   */
  async getUserKeyBiometric(options?: StorageOptions): Promise<string> {
    options = this.reconcileOptions(
      this.reconcileOptions(options, { keySuffix: "biometric" }),
      await this.defaultSecureStorageOptions(),
    );
    if (options?.userId == null) {
      return null;
    }
    return await this.secureStorageService.get<string>(
      `${options.userId}${partialKeys.userBiometricKey}`,
      options,
    );
  }

  async hasUserKeyBiometric(options?: StorageOptions): Promise<boolean> {
    options = this.reconcileOptions(
      this.reconcileOptions(options, { keySuffix: "biometric" }),
      await this.defaultSecureStorageOptions(),
    );
    if (options?.userId == null) {
      return false;
    }
    return await this.secureStorageService.has(
      `${options.userId}${partialKeys.userBiometricKey}`,
      options,
    );
  }

  async setUserKeyBiometric(value: BiometricKey, options?: StorageOptions): Promise<void> {
    options = this.reconcileOptions(
      this.reconcileOptions(options, { keySuffix: "biometric" }),
      await this.defaultSecureStorageOptions(),
    );
    if (options?.userId == null) {
      return;
    }
    await this.saveSecureStorageKey(partialKeys.userBiometricKey, value, options);
  }

  /**
   * @deprecated Use UserKeyAuto instead
   */
  async setCryptoMasterKeyAuto(value: string, options?: StorageOptions): Promise<void> {
    options = this.reconcileOptions(
      this.reconcileOptions(options, { keySuffix: "auto" }),
      await this.defaultSecureStorageOptions(),
    );
    if (options?.userId == null) {
      return;
    }
    await this.saveSecureStorageKey(partialKeys.autoKey, value, options);
  }

  /**
   * @deprecated I don't see where this is even used
   */
  async getCryptoMasterKeyB64(options?: StorageOptions): Promise<string> {
    options = this.reconcileOptions(options, await this.defaultSecureStorageOptions());
    if (options?.userId == null) {
      return null;
    }
    return await this.secureStorageService.get<string>(
      `${options?.userId}${partialKeys.masterKey}`,
      options,
    );
  }

  /**
   * @deprecated I don't see where this is even used
   */
  async setCryptoMasterKeyB64(value: string, options?: StorageOptions): Promise<void> {
    options = this.reconcileOptions(options, await this.defaultSecureStorageOptions());
    if (options?.userId == null) {
      return;
    }
    await this.saveSecureStorageKey(partialKeys.masterKey, value, options);
  }

  async getDuckDuckGoSharedKey(options?: StorageOptions): Promise<string> {
    options = this.reconcileOptions(options, await this.defaultSecureStorageOptions());
    if (options?.userId == null) {
      return null;
    }
    return await this.secureStorageService.get<string>(DDG_SHARED_KEY, options);
  }

  async setDuckDuckGoSharedKey(value: string, options?: StorageOptions): Promise<void> {
    options = this.reconcileOptions(options, await this.defaultSecureStorageOptions());
    if (options?.userId == null) {
      return;
    }
    value == null
      ? await this.secureStorageService.remove(DDG_SHARED_KEY, options)
      : await this.secureStorageService.save(DDG_SHARED_KEY, value, options);
  }

  async setEnableDuckDuckGoBrowserIntegration(
    value: boolean,
    options?: StorageOptions,
  ): Promise<void> {
    const globals = await this.getGlobals(
      this.reconcileOptions(options, await this.defaultOnDiskOptions()),
    );
    globals.enableDuckDuckGoBrowserIntegration = value;
    await this.saveGlobals(
      globals,
      this.reconcileOptions(options, await this.defaultOnDiskOptions()),
    );
  }

  /**
   * @deprecated Use UserKey instead
   */
  async getEncryptedCryptoSymmetricKey(options?: StorageOptions): Promise<string> {
    return (
      await this.getAccount(this.reconcileOptions(options, await this.defaultOnDiskOptions()))
    )?.keys.cryptoSymmetricKey.encrypted;
  }

  async getIsAuthenticated(options?: StorageOptions): Promise<boolean> {
    return (
      (await this.tokenService.getAccessToken(options?.userId as UserId)) != null &&
      (await this.getUserId(options)) != null
    );
  }

  async getLastSync(options?: StorageOptions): Promise<string> {
    return (
      await this.getAccount(this.reconcileOptions(options, await this.defaultOnDiskMemoryOptions()))
    )?.profile?.lastSync;
  }

  async setLastSync(value: string, options?: StorageOptions): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultOnDiskMemoryOptions()),
    );
    account.profile.lastSync = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultOnDiskMemoryOptions()),
    );
  }

  async getUserId(options?: StorageOptions): Promise<string> {
    return (
      await this.getAccount(this.reconcileOptions(options, await this.defaultOnDiskOptions()))
    )?.profile?.userId;
  }

  protected async getGlobals(options: StorageOptions): Promise<TGlobalState> {
    let globals: TGlobalState;
    if (this.useMemory(options.storageLocation)) {
      globals = await this.getGlobalsFromMemory();
    }

    if (this.useDisk && globals == null) {
      globals = await this.getGlobalsFromDisk(options);
    }

    if (globals == null) {
      globals = this.createGlobals();
    }

    return globals;
  }

  protected async saveGlobals(globals: TGlobalState, options: StorageOptions) {
    return this.useMemory(options.storageLocation)
      ? this.saveGlobalsToMemory(globals)
      : await this.saveGlobalsToDisk(globals, options);
  }

  protected async getGlobalsFromMemory(): Promise<TGlobalState> {
    return (await this.state()).globals;
  }

  protected async getGlobalsFromDisk(options: StorageOptions): Promise<TGlobalState> {
    return await this.storageService.get<TGlobalState>(keys.global, options);
  }

  protected async saveGlobalsToMemory(globals: TGlobalState): Promise<void> {
    await this.updateState(async (state) => {
      state.globals = globals;
      return state;
    });
  }

  protected async saveGlobalsToDisk(globals: TGlobalState, options: StorageOptions): Promise<void> {
    if (options.useSecureStorage) {
      await this.secureStorageService.save(keys.global, globals, options);
    } else {
      await this.storageService.save(keys.global, globals, options);
    }
  }

  protected async getAccount(options: StorageOptions): Promise<TAccount> {
    try {
      let account: TAccount;
      if (this.useMemory(options.storageLocation)) {
        account = await this.getAccountFromMemory(options);
      }

      if (this.useDisk(options.storageLocation) && account == null) {
        account = await this.getAccountFromDisk(options);
      }

      return account;
    } catch (e) {
      this.logService.error(e);
    }
  }

  protected async getAccountFromMemory(options: StorageOptions): Promise<TAccount> {
    const userId =
      options.userId ??
      (await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((account) => account?.id)),
      ));

    return await this.state().then(async (state) => {
      if (state.accounts == null) {
        return null;
      }
      return state.accounts[userId];
    });
  }

  protected async getAccountFromDisk(options: StorageOptions): Promise<TAccount> {
    const userId =
      options.userId ??
      (await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((account) => account?.id)),
      ));

    if (userId == null) {
      return null;
    }

    const account = options?.useSecureStorage
      ? (await this.secureStorageService.get<TAccount>(options.userId, options)) ??
        (await this.storageService.get<TAccount>(
          options.userId,
          this.reconcileOptions(options, { htmlStorageLocation: HtmlStorageLocation.Local }),
        ))
      : await this.storageService.get<TAccount>(options.userId, options);
    return account;
  }

  protected useMemory(storageLocation: StorageLocation) {
    return storageLocation === StorageLocation.Memory || storageLocation === StorageLocation.Both;
  }

  protected useDisk(storageLocation: StorageLocation) {
    return storageLocation === StorageLocation.Disk || storageLocation === StorageLocation.Both;
  }

  protected async saveAccount(
    account: TAccount,
    options: StorageOptions = {
      storageLocation: StorageLocation.Both,
      useSecureStorage: false,
    },
  ) {
    return this.useMemory(options.storageLocation)
      ? await this.saveAccountToMemory(account)
      : await this.saveAccountToDisk(account, options);
  }

  protected async saveAccountToDisk(account: TAccount, options: StorageOptions): Promise<void> {
    const storageLocation = options.useSecureStorage
      ? this.secureStorageService
      : this.storageService;

    await storageLocation.save(`${options.userId}`, account, options);
  }

  protected async saveAccountToMemory(account: TAccount): Promise<void> {
    if ((await this.getAccountFromMemory({ userId: account.profile.userId })) !== null) {
      await this.updateState((state) => {
        return new Promise((resolve) => {
          state.accounts[account.profile.userId] = account;
          resolve(state);
        });
      });
    }
  }

  protected async scaffoldNewAccountStorage(account: TAccount): Promise<void> {
    // We don't want to manipulate the referenced in memory account
    const deepClone = JSON.parse(JSON.stringify(account));
    await this.scaffoldNewAccountLocalStorage(deepClone);
    await this.scaffoldNewAccountSessionStorage(deepClone);
    await this.scaffoldNewAccountMemoryStorage(deepClone);
  }

  // TODO: There is a tech debt item for splitting up these methods - only Web uses multiple storage locations in its storageService.
  // For now these methods exist with some redundancy to facilitate this special web requirement.
  protected async scaffoldNewAccountLocalStorage(account: TAccount): Promise<void> {
    await this.saveAccount(
      account,
      this.reconcileOptions(
        { userId: account.profile.userId },
        await this.defaultOnDiskLocalOptions(),
      ),
    );
  }

  protected async scaffoldNewAccountMemoryStorage(account: TAccount): Promise<void> {
    await this.storageService.save(
      account.profile.userId,
      account,
      await this.defaultOnDiskMemoryOptions(),
    );
    await this.saveAccount(
      account,
      this.reconcileOptions(
        { userId: account.profile.userId },
        await this.defaultOnDiskMemoryOptions(),
      ),
    );
  }

  protected async scaffoldNewAccountSessionStorage(account: TAccount): Promise<void> {
    await this.storageService.save(
      account.profile.userId,
      account,
      await this.defaultOnDiskMemoryOptions(),
    );
    await this.saveAccount(
      account,
      this.reconcileOptions({ userId: account.profile.userId }, await this.defaultOnDiskOptions()),
    );
  }

  protected reconcileOptions(
    requestedOptions: StorageOptions,
    defaultOptions: StorageOptions,
  ): StorageOptions {
    if (requestedOptions == null) {
      return defaultOptions;
    }
    requestedOptions.userId = requestedOptions?.userId ?? defaultOptions.userId;
    requestedOptions.storageLocation =
      requestedOptions?.storageLocation ?? defaultOptions.storageLocation;
    requestedOptions.useSecureStorage =
      requestedOptions?.useSecureStorage ?? defaultOptions.useSecureStorage;
    requestedOptions.htmlStorageLocation =
      requestedOptions?.htmlStorageLocation ?? defaultOptions.htmlStorageLocation;
    requestedOptions.keySuffix = requestedOptions?.keySuffix ?? defaultOptions.keySuffix;
    return requestedOptions;
  }

  protected async defaultInMemoryOptions(): Promise<StorageOptions> {
    const userId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((account) => account?.id)),
    );

    return {
      storageLocation: StorageLocation.Memory,
      userId,
    };
  }

  protected async defaultOnDiskOptions(): Promise<StorageOptions> {
    const userId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((account) => account?.id)),
    );

    return {
      storageLocation: StorageLocation.Disk,
      htmlStorageLocation: HtmlStorageLocation.Session,
      userId,
      useSecureStorage: false,
    };
  }

  protected async defaultOnDiskLocalOptions(): Promise<StorageOptions> {
    const userId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((account) => account?.id)),
    );

    return {
      storageLocation: StorageLocation.Disk,
      htmlStorageLocation: HtmlStorageLocation.Local,
      userId,
      useSecureStorage: false,
    };
  }

  protected async defaultOnDiskMemoryOptions(): Promise<StorageOptions> {
    const userId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((account) => account?.id)),
    );

    return {
      storageLocation: StorageLocation.Disk,
      htmlStorageLocation: HtmlStorageLocation.Memory,
      userId,
      useSecureStorage: false,
    };
  }

  protected async defaultSecureStorageOptions(): Promise<StorageOptions> {
    const userId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((account) => account?.id)),
    );

    return {
      storageLocation: StorageLocation.Disk,
      useSecureStorage: true,
      userId,
    };
  }

  protected async getActiveUserIdFromStorage(): Promise<string> {
    return await firstValueFrom(this.accountService.activeAccount$.pipe(map((a) => a?.id)));
  }

  protected async removeAccountFromLocalStorage(userId: string = null): Promise<void> {
    userId ??= await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((account) => account?.id)),
    );

    const storedAccount = await this.getAccount(
      this.reconcileOptions({ userId: userId }, await this.defaultOnDiskLocalOptions()),
    );
    await this.saveAccount(
      this.resetAccount(storedAccount),
      this.reconcileOptions({ userId: userId }, await this.defaultOnDiskLocalOptions()),
    );
  }

  protected async removeAccountFromSessionStorage(userId: string = null): Promise<void> {
    userId ??= await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((account) => account?.id)),
    );

    const storedAccount = await this.getAccount(
      this.reconcileOptions({ userId: userId }, await this.defaultOnDiskOptions()),
    );
    await this.saveAccount(
      this.resetAccount(storedAccount),
      this.reconcileOptions({ userId: userId }, await this.defaultOnDiskOptions()),
    );
  }

  protected async removeAccountFromSecureStorage(userId: string = null): Promise<void> {
    userId ??= await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((account) => account?.id)),
    );

    await this.setUserKeyAutoUnlock(null, { userId: userId });
    await this.setUserKeyBiometric(null, { userId: userId });
    await this.setCryptoMasterKeyAuto(null, { userId: userId });
    await this.setCryptoMasterKeyB64(null, { userId: userId });
  }

  protected async removeAccountFromMemory(userId: string = null): Promise<void> {
    userId ??= await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((account) => account?.id)),
    );

    await this.updateState(async (state) => {
      delete state.accounts[userId];
      return state;
    });
  }

  // settings persist even on reset, and are not affected by this method
  protected resetAccount(account: TAccount) {
    // All settings have been moved to StateProviders
    return this.createAccount();
  }

  protected createAccount(init: Partial<TAccount> = null): TAccount {
    return this.stateFactory.createAccount(init);
  }

  protected createGlobals(init: Partial<TGlobalState> = null): TGlobalState {
    return this.stateFactory.createGlobal(init);
  }

  protected async deAuthenticateAccount(userId: string): Promise<void> {
    // We must have a manual call to clear tokens as we can't leverage state provider to clean
    // up our data as we have secure storage in the mix.
    await this.tokenService.clearTokens(userId as UserId);
  }

  protected async removeAccountFromDisk(userId: string) {
    await this.removeAccountFromSessionStorage(userId);
    await this.removeAccountFromLocalStorage(userId);
    await this.removeAccountFromSecureStorage(userId);
  }

  protected async saveSecureStorageKey<T extends JsonValue>(
    key: string,
    value: T,
    options?: StorageOptions,
  ) {
    return value == null
      ? await this.secureStorageService.remove(`${options.userId}${key}`, options)
      : await this.secureStorageService.save(`${options.userId}${key}`, value, options);
  }

  protected async state(): Promise<State<TGlobalState, TAccount>> {
    let state = await this.memoryStorageService.get<State<TGlobalState, TAccount>>(keys.state);
    if (this.memoryStorageService.valuesRequireDeserialization) {
      state = State.fromJSON(state, this.accountDeserializer);
    }
    return state;
  }

  private async setState(
    state: State<TGlobalState, TAccount>,
  ): Promise<State<TGlobalState, TAccount>> {
    await this.memoryStorageService.save(keys.state, state);
    return state;
  }

  protected async updateState(
    stateUpdater: (state: State<TGlobalState, TAccount>) => Promise<State<TGlobalState, TAccount>>,
  ): Promise<State<TGlobalState, TAccount>> {
    return await this.state().then(async (state) => {
      const updatedState = await stateUpdater(state);
      if (updatedState == null) {
        throw new Error("Attempted to update state to null value");
      }

      return await this.setState(updatedState);
    });
  }
}
