import { BehaviorSubject, Observable, map } from "rxjs";
import { Jsonify, JsonValue } from "type-fest";

import { AccountService } from "../../auth/abstractions/account.service";
import { TokenService } from "../../auth/abstractions/token.service";
import { AuthenticationStatus } from "../../auth/enums/authentication-status";
import { AdminAuthRequestStorable } from "../../auth/models/domain/admin-auth-req-storable";
import { ForceSetPasswordReason } from "../../auth/models/domain/force-set-password-reason";
import { KdfConfig } from "../../auth/models/domain/kdf-config";
import { BiometricKey } from "../../auth/types/biometric-key";
import { GeneratorOptions } from "../../tools/generator/generator-options";
import { GeneratedPasswordHistory, PasswordGeneratorOptions } from "../../tools/generator/password";
import { UsernameGeneratorOptions } from "../../tools/generator/username";
import { SendData } from "../../tools/send/models/data/send.data";
import { SendView } from "../../tools/send/models/view/send.view";
import { UserId } from "../../types/guid";
import { DeviceKey, MasterKey } from "../../types/key";
import { CipherData } from "../../vault/models/data/cipher.data";
import { LocalData } from "../../vault/models/data/local.data";
import { CipherView } from "../../vault/models/view/cipher.view";
import { AddEditCipherInfo } from "../../vault/types/add-edit-cipher-info";
import { EnvironmentService } from "../abstractions/environment.service";
import { LogService } from "../abstractions/log.service";
import {
  InitOptions,
  StateService as StateServiceAbstraction,
} from "../abstractions/state.service";
import {
  AbstractMemoryStorageService,
  AbstractStorageService,
} from "../abstractions/storage.service";
import { HtmlStorageLocation, KdfType, StorageLocation } from "../enums";
import { StateFactory } from "../factories/state-factory";
import { Utils } from "../misc/utils";
import { Account, AccountData, AccountSettings } from "../models/domain/account";
import { EncString } from "../models/domain/enc-string";
import { GlobalState } from "../models/domain/global-state";
import { State } from "../models/domain/state";
import { StorageOptions } from "../models/domain/storage-options";
import { SymmetricCryptoKey } from "../models/domain/symmetric-crypto-key";

import { MigrationRunner } from "./migration-runner";

const keys = {
  state: "state",
  stateVersion: "stateVersion",
  global: "global",
  authenticatedAccounts: "authenticatedAccounts",
  activeUserId: "activeUserId",
  tempAccountSettings: "tempAccountSettings", // used to hold account specific settings (i.e clear clipboard) between initial migration and first account authentication
  accountActivity: "accountActivity",
};

const partialKeys = {
  userAutoKey: "_user_auto",
  userBiometricKey: "_user_biometric",

  autoKey: "_masterkey_auto",
  biometricKey: "_masterkey_biometric",
  masterKey: "_masterkey",
};

const DDG_SHARED_KEY = "DuckDuckGoSharedKey";

export class StateService<
  TGlobalState extends GlobalState = GlobalState,
  TAccount extends Account = Account,
> implements StateServiceAbstraction<TAccount>
{
  protected accountsSubject = new BehaviorSubject<{ [userId: string]: TAccount }>({});
  accounts$ = this.accountsSubject.asObservable();

  protected activeAccountSubject = new BehaviorSubject<string | null>(null);
  activeAccount$ = this.activeAccountSubject.asObservable();

  activeAccountUnlocked$: Observable<boolean>;

  private hasBeenInited = false;
  protected isRecoveredSession = false;

  protected accountDiskCache = new BehaviorSubject<Record<string, TAccount>>({});

  // default account serializer, must be overridden by child class
  protected accountDeserializer = Account.fromJSON as (json: Jsonify<TAccount>) => TAccount;

  constructor(
    protected storageService: AbstractStorageService,
    protected secureStorageService: AbstractStorageService,
    protected memoryStorageService: AbstractMemoryStorageService,
    protected logService: LogService,
    protected stateFactory: StateFactory<TGlobalState, TAccount>,
    protected accountService: AccountService,
    protected environmentService: EnvironmentService,
    protected tokenService: TokenService,
    private migrationRunner: MigrationRunner,
    protected useAccountCache: boolean = true,
  ) {
    this.activeAccountUnlocked$ = this.accountService.activeAccount$.pipe(
      map((a) => {
        return a?.status === AuthenticationStatus.Unlocked;
      }),
    );
  }

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

    await this.updateState(async (state) => {
      state.authenticatedAccounts =
        (await this.storageService.get<string[]>(keys.authenticatedAccounts)) ?? [];
      for (const i in state.authenticatedAccounts) {
        if (i != null) {
          state = await this.syncAccountFromDisk(state.authenticatedAccounts[i]);
        }
      }
      const storedActiveUser = await this.storageService.get<string>(keys.activeUserId);
      if (storedActiveUser != null) {
        state.activeUserId = storedActiveUser;
      }
      await this.pushAccounts();
      this.activeAccountSubject.next(state.activeUserId);
      // TODO: Temporary update to avoid routing all account status changes through account service for now.
      // account service tracks logged out accounts, but State service does not, so we need to add the active account
      // if it's not in the accounts list.
      if (state.activeUserId != null && this.accountsSubject.value[state.activeUserId] == null) {
        const activeDiskAccount = await this.getAccountFromDisk({ userId: state.activeUserId });
        await this.accountService.addAccount(state.activeUserId as UserId, {
          name: activeDiskAccount.profile.name,
          email: activeDiskAccount.profile.email,
          status: AuthenticationStatus.LoggedOut,
        });
      }
      await this.accountService.switchAccount(state.activeUserId as UserId);
      // End TODO

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

    // TODO: Temporary update to avoid routing all account status changes through account service for now.
    // The determination of state should be handled by the various services that control those values.
    const token = await this.tokenService.getAccessToken(userId as UserId);
    const autoKey = await this.getUserKeyAutoUnlock({ userId: userId });
    const accountStatus =
      token == null
        ? AuthenticationStatus.LoggedOut
        : autoKey == null
          ? AuthenticationStatus.Locked
          : AuthenticationStatus.Unlocked;
    await this.accountService.addAccount(userId as UserId, {
      status: accountStatus,
      name: diskAccount.profile.name,
      email: diskAccount.profile.email,
    });

    return state;
  }

  async addAccount(account: TAccount) {
    await this.environmentService.seedUserEnvironment(account.profile.userId as UserId);
    await this.updateState(async (state) => {
      state.authenticatedAccounts.push(account.profile.userId);
      await this.storageService.save(keys.authenticatedAccounts, state.authenticatedAccounts);
      state.accounts[account.profile.userId] = account;
      return state;
    });
    await this.scaffoldNewAccountStorage(account);
    await this.setLastActive(new Date().getTime(), { userId: account.profile.userId });
    // TODO: Temporary update to avoid routing all account status changes through account service for now.
    await this.accountService.addAccount(account.profile.userId as UserId, {
      status: AuthenticationStatus.Locked,
      name: account.profile.name,
      email: account.profile.email,
    });
    await this.setActiveUser(account.profile.userId);
  }

  async setActiveUser(userId: string): Promise<void> {
    await this.clearDecryptedDataForActiveUser();
    await this.updateState(async (state) => {
      state.activeUserId = userId;
      await this.storageService.save(keys.activeUserId, userId);
      this.activeAccountSubject.next(state.activeUserId);
      // TODO: temporary update to avoid routing all account status changes through account service for now.
      await this.accountService.switchAccount(userId as UserId);

      return state;
    });

    await this.pushAccounts();
  }

  async clean(options?: StorageOptions): Promise<UserId> {
    options = this.reconcileOptions(options, await this.defaultInMemoryOptions());
    await this.deAuthenticateAccount(options.userId);
    let currentUser = (await this.state())?.activeUserId;
    if (options.userId === currentUser) {
      currentUser = await this.dynamicallySetActiveUser();
    }

    await this.removeAccountFromDisk(options?.userId);
    await this.removeAccountFromMemory(options?.userId);
    await this.pushAccounts();
    return currentUser as UserId;
  }

  async getAddEditCipherInfo(options?: StorageOptions): Promise<AddEditCipherInfo> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultInMemoryOptions()),
    );
    // ensure prototype on cipher
    const raw = account?.data?.addEditCipherInfo;
    return raw == null
      ? null
      : {
          cipher:
            raw?.cipher.toJSON != null
              ? raw.cipher
              : CipherView.fromJSON(raw?.cipher as Jsonify<CipherView>),
          collectionIds: raw?.collectionIds,
        };
  }

  async setAddEditCipherInfo(value: AddEditCipherInfo, options?: StorageOptions): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultInMemoryOptions()),
    );
    account.data.addEditCipherInfo = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultInMemoryOptions()),
    );
  }

  async getBiometricFingerprintValidated(options?: StorageOptions): Promise<boolean> {
    return (
      (await this.getGlobals(this.reconcileOptions(options, await this.defaultOnDiskOptions())))
        ?.biometricFingerprintValidated ?? false
    );
  }

  async setBiometricFingerprintValidated(value: boolean, options?: StorageOptions): Promise<void> {
    const globals = await this.getGlobals(
      this.reconcileOptions(options, await this.defaultOnDiskOptions()),
    );
    globals.biometricFingerprintValidated = value;
    await this.saveGlobals(
      globals,
      this.reconcileOptions(options, await this.defaultOnDiskOptions()),
    );
  }

  async getConvertAccountToKeyConnector(options?: StorageOptions): Promise<boolean> {
    return (
      await this.getAccount(this.reconcileOptions(options, await this.defaultOnDiskOptions()))
    )?.profile?.convertAccountToKeyConnector;
  }

  async setConvertAccountToKeyConnector(value: boolean, options?: StorageOptions): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultOnDiskOptions()),
    );
    account.profile.convertAccountToKeyConnector = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultOnDiskOptions()),
    );
  }

  /**
   * @deprecated Do not save the Master Key. Use the User Symmetric Key instead
   */
  async getCryptoMasterKey(options?: StorageOptions): Promise<SymmetricCryptoKey> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultInMemoryOptions()),
    );
    return account?.keys?.cryptoMasterKey;
  }

  /**
   * User's master key derived from MP, saved only if we decrypted with MP
   */
  async getMasterKey(options?: StorageOptions): Promise<MasterKey> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultInMemoryOptions()),
    );
    return account?.keys?.masterKey;
  }

  /**
   * User's master key derived from MP, saved only if we decrypted with MP
   */
  async setMasterKey(value: MasterKey, options?: StorageOptions): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultInMemoryOptions()),
    );
    account.keys.masterKey = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultInMemoryOptions()),
    );
  }

  /**
   * The master key encrypted User symmetric key, saved on every auth
   * so we can unlock with MP offline
   */
  async getMasterKeyEncryptedUserKey(options?: StorageOptions): Promise<string> {
    return (
      await this.getAccount(this.reconcileOptions(options, await this.defaultOnDiskOptions()))
    )?.keys.masterKeyEncryptedUserKey;
  }

  /**
   * The master key encrypted User symmetric key, saved on every auth
   * so we can unlock with MP offline
   */
  async setMasterKeyEncryptedUserKey(value: string, options?: StorageOptions): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultOnDiskOptions()),
    );
    account.keys.masterKeyEncryptedUserKey = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultOnDiskOptions()),
    );
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

  async getPinKeyEncryptedUserKey(options?: StorageOptions): Promise<EncString> {
    return EncString.fromJSON(
      (await this.getAccount(this.reconcileOptions(options, await this.defaultOnDiskOptions())))
        ?.settings?.pinKeyEncryptedUserKey,
    );
  }

  async setPinKeyEncryptedUserKey(value: EncString, options?: StorageOptions): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultOnDiskOptions()),
    );
    account.settings.pinKeyEncryptedUserKey = value?.encryptedString;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultOnDiskOptions()),
    );
  }

  async getPinKeyEncryptedUserKeyEphemeral(options?: StorageOptions): Promise<EncString> {
    return EncString.fromJSON(
      (await this.getAccount(this.reconcileOptions(options, await this.defaultInMemoryOptions())))
        ?.settings?.pinKeyEncryptedUserKeyEphemeral,
    );
  }

  async setPinKeyEncryptedUserKeyEphemeral(
    value: EncString,
    options?: StorageOptions,
  ): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultInMemoryOptions()),
    );
    account.settings.pinKeyEncryptedUserKeyEphemeral = value?.encryptedString;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultInMemoryOptions()),
    );
  }

  /**
   * @deprecated Use UserKeyAuto instead
   */
  async getCryptoMasterKeyAuto(options?: StorageOptions): Promise<string> {
    options = this.reconcileOptions(
      this.reconcileOptions(options, { keySuffix: "auto" }),
      await this.defaultSecureStorageOptions(),
    );
    if (options?.userId == null) {
      return null;
    }
    return await this.secureStorageService.get<string>(
      `${options.userId}${partialKeys.autoKey}`,
      options,
    );
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

  /**
   * @deprecated Use UserKeyBiometric instead
   */
  async getCryptoMasterKeyBiometric(options?: StorageOptions): Promise<string> {
    options = this.reconcileOptions(
      this.reconcileOptions(options, { keySuffix: "biometric" }),
      await this.defaultSecureStorageOptions(),
    );
    if (options?.userId == null) {
      return null;
    }
    return await this.secureStorageService.get<string>(
      `${options.userId}${partialKeys.biometricKey}`,
      options,
    );
  }

  /**
   * @deprecated Use UserKeyBiometric instead
   */
  async hasCryptoMasterKeyBiometric(options?: StorageOptions): Promise<boolean> {
    options = this.reconcileOptions(
      this.reconcileOptions(options, { keySuffix: "biometric" }),
      await this.defaultSecureStorageOptions(),
    );
    if (options?.userId == null) {
      return false;
    }
    return await this.secureStorageService.has(
      `${options.userId}${partialKeys.biometricKey}`,
      options,
    );
  }

  /**
   * @deprecated Use UserKeyBiometric instead
   */
  async setCryptoMasterKeyBiometric(value: BiometricKey, options?: StorageOptions): Promise<void> {
    options = this.reconcileOptions(
      this.reconcileOptions(options, { keySuffix: "biometric" }),
      await this.defaultSecureStorageOptions(),
    );
    if (options?.userId == null) {
      return;
    }
    await this.saveSecureStorageKey(partialKeys.biometricKey, value, options);
  }

  @withPrototypeForArrayMembers(CipherView, CipherView.fromJSON)
  async getDecryptedCiphers(options?: StorageOptions): Promise<CipherView[]> {
    return (
      await this.getAccount(this.reconcileOptions(options, await this.defaultInMemoryOptions()))
    )?.data?.ciphers?.decrypted;
  }

  async setDecryptedCiphers(value: CipherView[], options?: StorageOptions): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultInMemoryOptions()),
    );
    account.data.ciphers.decrypted = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultInMemoryOptions()),
    );
  }

  @withPrototypeForArrayMembers(GeneratedPasswordHistory)
  async getDecryptedPasswordGenerationHistory(
    options?: StorageOptions,
  ): Promise<GeneratedPasswordHistory[]> {
    return (
      await this.getAccount(this.reconcileOptions(options, await this.defaultInMemoryOptions()))
    )?.data?.passwordGenerationHistory?.decrypted;
  }

  async setDecryptedPasswordGenerationHistory(
    value: GeneratedPasswordHistory[],
    options?: StorageOptions,
  ): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultInMemoryOptions()),
    );
    account.data.passwordGenerationHistory.decrypted = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultInMemoryOptions()),
    );
  }

  /**
   * @deprecated Use getPinKeyEncryptedUserKeyEphemeral instead
   */
  async getDecryptedPinProtected(options?: StorageOptions): Promise<EncString> {
    return (
      await this.getAccount(this.reconcileOptions(options, await this.defaultInMemoryOptions()))
    )?.settings?.pinProtected?.decrypted;
  }

  /**
   * @deprecated Use setPinKeyEncryptedUserKeyEphemeral instead
   */
  async setDecryptedPinProtected(value: EncString, options?: StorageOptions): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultInMemoryOptions()),
    );
    account.settings.pinProtected.decrypted = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultInMemoryOptions()),
    );
  }

  @withPrototypeForArrayMembers(SendView)
  async getDecryptedSends(options?: StorageOptions): Promise<SendView[]> {
    return (
      await this.getAccount(this.reconcileOptions(options, await this.defaultInMemoryOptions()))
    )?.data?.sends?.decrypted;
  }

  async setDecryptedSends(value: SendView[], options?: StorageOptions): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultInMemoryOptions()),
    );
    account.data.sends.decrypted = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultInMemoryOptions()),
    );
  }

  async getDisableGa(options?: StorageOptions): Promise<boolean> {
    return (
      (await this.getAccount(this.reconcileOptions(options, await this.defaultOnDiskOptions())))
        ?.settings?.disableGa ?? false
    );
  }

  async setDisableGa(value: boolean, options?: StorageOptions): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultOnDiskOptions()),
    );
    account.settings.disableGa = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultOnDiskOptions()),
    );
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

  async getDeviceKey(options?: StorageOptions): Promise<DeviceKey | null> {
    options = this.reconcileOptions(options, await this.defaultOnDiskLocalOptions());

    if (options?.userId == null) {
      return null;
    }

    const account = await this.getAccount(options);

    const existingDeviceKey = account?.keys?.deviceKey;

    // Must manually instantiate the SymmetricCryptoKey class from the JSON object
    if (existingDeviceKey != null) {
      return SymmetricCryptoKey.fromJSON(existingDeviceKey) as DeviceKey;
    } else {
      return null;
    }
  }

  async setDeviceKey(value: DeviceKey | null, options?: StorageOptions): Promise<void> {
    options = this.reconcileOptions(options, await this.defaultOnDiskLocalOptions());

    if (options?.userId == null) {
      return;
    }

    const account = await this.getAccount(options);

    account.keys.deviceKey = value?.toJSON() ?? null;

    await this.saveAccount(account, options);
  }

  async getAdminAuthRequest(options?: StorageOptions): Promise<AdminAuthRequestStorable | null> {
    options = this.reconcileOptions(options, await this.defaultOnDiskLocalOptions());

    if (options?.userId == null) {
      return null;
    }

    const account = await this.getAccount(options);

    return account?.adminAuthRequest
      ? AdminAuthRequestStorable.fromJSON(account.adminAuthRequest)
      : null;
  }

  async setAdminAuthRequest(
    adminAuthRequest: AdminAuthRequestStorable,
    options?: StorageOptions,
  ): Promise<void> {
    options = this.reconcileOptions(options, await this.defaultOnDiskLocalOptions());

    if (options?.userId == null) {
      return;
    }

    const account = await this.getAccount(options);

    account.adminAuthRequest = adminAuthRequest?.toJSON();

    await this.saveAccount(account, options);
  }

  async getShouldTrustDevice(options?: StorageOptions): Promise<boolean | null> {
    options = this.reconcileOptions(options, await this.defaultOnDiskLocalOptions());

    if (options?.userId == null) {
      return null;
    }

    const account = await this.getAccount(options);

    return account?.settings?.trustDeviceChoiceForDecryption ?? null;
  }

  async setShouldTrustDevice(value: boolean, options?: StorageOptions): Promise<void> {
    options = this.reconcileOptions(options, await this.defaultOnDiskLocalOptions());
    if (options?.userId == null) {
      return;
    }

    const account = await this.getAccount(options);

    account.settings.trustDeviceChoiceForDecryption = value;

    await this.saveAccount(account, options);
  }

  async getEmail(options?: StorageOptions): Promise<string> {
    return (
      await this.getAccount(this.reconcileOptions(options, await this.defaultInMemoryOptions()))
    )?.profile?.email;
  }

  async setEmail(value: string, options?: StorageOptions): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultInMemoryOptions()),
    );
    account.profile.email = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultInMemoryOptions()),
    );
  }

  async getEmailVerified(options?: StorageOptions): Promise<boolean> {
    return (
      (await this.getAccount(this.reconcileOptions(options, await this.defaultOnDiskOptions())))
        ?.profile.emailVerified ?? false
    );
  }

  async setEmailVerified(value: boolean, options?: StorageOptions): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultOnDiskOptions()),
    );
    account.profile.emailVerified = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultOnDiskOptions()),
    );
  }

  async getEnableBrowserIntegration(options?: StorageOptions): Promise<boolean> {
    return (
      (await this.getGlobals(this.reconcileOptions(options, await this.defaultOnDiskOptions())))
        ?.enableBrowserIntegration ?? false
    );
  }

  async setEnableBrowserIntegration(value: boolean, options?: StorageOptions): Promise<void> {
    const globals = await this.getGlobals(
      this.reconcileOptions(options, await this.defaultOnDiskOptions()),
    );
    globals.enableBrowserIntegration = value;
    await this.saveGlobals(
      globals,
      this.reconcileOptions(options, await this.defaultOnDiskOptions()),
    );
  }

  async getEnableBrowserIntegrationFingerprint(options?: StorageOptions): Promise<boolean> {
    return (
      (await this.getGlobals(this.reconcileOptions(options, await this.defaultOnDiskOptions())))
        ?.enableBrowserIntegrationFingerprint ?? false
    );
  }

  async setEnableBrowserIntegrationFingerprint(
    value: boolean,
    options?: StorageOptions,
  ): Promise<void> {
    const globals = await this.getGlobals(
      this.reconcileOptions(options, await this.defaultOnDiskOptions()),
    );
    globals.enableBrowserIntegrationFingerprint = value;
    await this.saveGlobals(
      globals,
      this.reconcileOptions(options, await this.defaultOnDiskOptions()),
    );
  }

  @withPrototypeForObjectValues(CipherData)
  async getEncryptedCiphers(options?: StorageOptions): Promise<{ [id: string]: CipherData }> {
    return (
      await this.getAccount(this.reconcileOptions(options, await this.defaultOnDiskMemoryOptions()))
    )?.data?.ciphers?.encrypted;
  }

  async setEncryptedCiphers(
    value: { [id: string]: CipherData },
    options?: StorageOptions,
  ): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultOnDiskMemoryOptions()),
    );
    account.data.ciphers.encrypted = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultOnDiskMemoryOptions()),
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

  @withPrototypeForArrayMembers(GeneratedPasswordHistory)
  async getEncryptedPasswordGenerationHistory(
    options?: StorageOptions,
  ): Promise<GeneratedPasswordHistory[]> {
    return (
      await this.getAccount(this.reconcileOptions(options, await this.defaultOnDiskOptions()))
    )?.data?.passwordGenerationHistory?.encrypted;
  }

  async setEncryptedPasswordGenerationHistory(
    value: GeneratedPasswordHistory[],
    options?: StorageOptions,
  ): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultOnDiskOptions()),
    );
    account.data.passwordGenerationHistory.encrypted = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultOnDiskOptions()),
    );
  }

  async getEncryptedPinProtected(options?: StorageOptions): Promise<string> {
    return (
      await this.getAccount(this.reconcileOptions(options, await this.defaultOnDiskOptions()))
    )?.settings?.pinProtected?.encrypted;
  }

  async setEncryptedPinProtected(value: string, options?: StorageOptions): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultOnDiskOptions()),
    );
    account.settings.pinProtected.encrypted = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultOnDiskOptions()),
    );
  }

  @withPrototypeForObjectValues(SendData)
  async getEncryptedSends(options?: StorageOptions): Promise<{ [id: string]: SendData }> {
    return (
      await this.getAccount(this.reconcileOptions(options, await this.defaultOnDiskMemoryOptions()))
    )?.data?.sends.encrypted;
  }

  async setEncryptedSends(
    value: { [id: string]: SendData },
    options?: StorageOptions,
  ): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultOnDiskMemoryOptions()),
    );
    account.data.sends.encrypted = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultOnDiskMemoryOptions()),
    );
  }

  async getEverBeenUnlocked(options?: StorageOptions): Promise<boolean> {
    return (
      (await this.getAccount(this.reconcileOptions(options, await this.defaultInMemoryOptions())))
        ?.profile?.everBeenUnlocked ?? false
    );
  }

  async setEverBeenUnlocked(value: boolean, options?: StorageOptions): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultInMemoryOptions()),
    );
    account.profile.everBeenUnlocked = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultInMemoryOptions()),
    );
  }

  async getForceSetPasswordReason(options?: StorageOptions): Promise<ForceSetPasswordReason> {
    return (
      (
        await this.getAccount(
          this.reconcileOptions(options, await this.defaultOnDiskMemoryOptions()),
        )
      )?.profile?.forceSetPasswordReason ?? ForceSetPasswordReason.None
    );
  }

  async setForceSetPasswordReason(
    value: ForceSetPasswordReason,
    options?: StorageOptions,
  ): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultOnDiskMemoryOptions()),
    );
    account.profile.forceSetPasswordReason = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultOnDiskMemoryOptions()),
    );
  }

  async getInstalledVersion(options?: StorageOptions): Promise<string> {
    return (
      await this.getGlobals(this.reconcileOptions(options, await this.defaultOnDiskOptions()))
    )?.installedVersion;
  }

  async setInstalledVersion(value: string, options?: StorageOptions): Promise<void> {
    const globals = await this.getGlobals(
      this.reconcileOptions(options, await this.defaultOnDiskOptions()),
    );
    globals.installedVersion = value;
    await this.saveGlobals(
      globals,
      this.reconcileOptions(options, await this.defaultOnDiskOptions()),
    );
  }

  async getIsAuthenticated(options?: StorageOptions): Promise<boolean> {
    return (
      (await this.tokenService.getAccessToken(options?.userId as UserId)) != null &&
      (await this.getUserId(options)) != null
    );
  }

  async getKdfConfig(options?: StorageOptions): Promise<KdfConfig> {
    const iterations = (
      await this.getAccount(this.reconcileOptions(options, await this.defaultOnDiskOptions()))
    )?.profile?.kdfIterations;
    const memory = (
      await this.getAccount(this.reconcileOptions(options, await this.defaultOnDiskOptions()))
    )?.profile?.kdfMemory;
    const parallelism = (
      await this.getAccount(this.reconcileOptions(options, await this.defaultOnDiskOptions()))
    )?.profile?.kdfParallelism;
    return new KdfConfig(iterations, memory, parallelism);
  }

  async setKdfConfig(config: KdfConfig, options?: StorageOptions): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultOnDiskOptions()),
    );
    account.profile.kdfIterations = config.iterations;
    account.profile.kdfMemory = config.memory;
    account.profile.kdfParallelism = config.parallelism;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultOnDiskOptions()),
    );
  }

  async getKdfType(options?: StorageOptions): Promise<KdfType> {
    return (
      await this.getAccount(this.reconcileOptions(options, await this.defaultOnDiskOptions()))
    )?.profile?.kdfType;
  }

  async setKdfType(value: KdfType, options?: StorageOptions): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultOnDiskOptions()),
    );
    account.profile.kdfType = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultOnDiskOptions()),
    );
  }

  async getKeyHash(options?: StorageOptions): Promise<string> {
    return (
      await this.getAccount(this.reconcileOptions(options, await this.defaultOnDiskOptions()))
    )?.profile?.keyHash;
  }

  async setKeyHash(value: string, options?: StorageOptions): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultOnDiskOptions()),
    );
    account.profile.keyHash = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultOnDiskOptions()),
    );
  }

  async getLastActive(options?: StorageOptions): Promise<number> {
    options = this.reconcileOptions(options, await this.defaultOnDiskOptions());

    const accountActivity = await this.storageService.get<{ [userId: string]: number }>(
      keys.accountActivity,
      options,
    );

    if (accountActivity == null || Object.keys(accountActivity).length < 1) {
      return null;
    }

    return accountActivity[options.userId];
  }

  async setLastActive(value: number, options?: StorageOptions): Promise<void> {
    options = this.reconcileOptions(options, await this.defaultOnDiskOptions());
    if (options.userId == null) {
      return;
    }
    const accountActivity =
      (await this.storageService.get<{ [userId: string]: number }>(
        keys.accountActivity,
        options,
      )) ?? {};
    accountActivity[options.userId] = value;
    await this.storageService.save(keys.accountActivity, accountActivity, options);
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

  async getLocalData(options?: StorageOptions): Promise<{ [cipherId: string]: LocalData }> {
    return (
      await this.getAccount(this.reconcileOptions(options, await this.defaultOnDiskLocalOptions()))
    )?.data?.localData;
  }

  async setLocalData(
    value: { [cipherId: string]: LocalData },
    options?: StorageOptions,
  ): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultOnDiskLocalOptions()),
    );
    account.data.localData = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultOnDiskLocalOptions()),
    );
  }

  async getMinimizeOnCopyToClipboard(options?: StorageOptions): Promise<boolean> {
    return (
      (await this.getAccount(this.reconcileOptions(options, await this.defaultOnDiskOptions())))
        ?.settings?.minimizeOnCopyToClipboard ?? false
    );
  }

  async setMinimizeOnCopyToClipboard(value: boolean, options?: StorageOptions): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultOnDiskOptions()),
    );
    account.settings.minimizeOnCopyToClipboard = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultOnDiskOptions()),
    );
  }

  async getOrganizationInvitation(options?: StorageOptions): Promise<any> {
    return (
      await this.getGlobals(this.reconcileOptions(options, await this.defaultInMemoryOptions()))
    )?.organizationInvitation;
  }

  async setOrganizationInvitation(value: any, options?: StorageOptions): Promise<void> {
    const globals = await this.getGlobals(
      this.reconcileOptions(options, await this.defaultInMemoryOptions()),
    );
    globals.organizationInvitation = value;
    await this.saveGlobals(
      globals,
      this.reconcileOptions(options, await this.defaultInMemoryOptions()),
    );
  }

  async getPasswordGenerationOptions(options?: StorageOptions): Promise<PasswordGeneratorOptions> {
    return (
      await this.getAccount(this.reconcileOptions(options, await this.defaultOnDiskLocalOptions()))
    )?.settings?.passwordGenerationOptions;
  }

  async setPasswordGenerationOptions(
    value: PasswordGeneratorOptions,
    options?: StorageOptions,
  ): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultOnDiskLocalOptions()),
    );
    account.settings.passwordGenerationOptions = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultOnDiskLocalOptions()),
    );
  }

  async getUsernameGenerationOptions(options?: StorageOptions): Promise<UsernameGeneratorOptions> {
    return (
      await this.getAccount(this.reconcileOptions(options, await this.defaultOnDiskLocalOptions()))
    )?.settings?.usernameGenerationOptions;
  }

  async setUsernameGenerationOptions(
    value: UsernameGeneratorOptions,
    options?: StorageOptions,
  ): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultOnDiskLocalOptions()),
    );
    account.settings.usernameGenerationOptions = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultOnDiskLocalOptions()),
    );
  }

  async getGeneratorOptions(options?: StorageOptions): Promise<GeneratorOptions> {
    return (
      await this.getAccount(this.reconcileOptions(options, await this.defaultOnDiskLocalOptions()))
    )?.settings?.generatorOptions;
  }

  async setGeneratorOptions(value: GeneratorOptions, options?: StorageOptions): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultOnDiskLocalOptions()),
    );
    account.settings.generatorOptions = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultOnDiskLocalOptions()),
    );
  }

  async getProtectedPin(options?: StorageOptions): Promise<string> {
    return (
      await this.getAccount(this.reconcileOptions(options, await this.defaultOnDiskOptions()))
    )?.settings?.protectedPin;
  }

  async setProtectedPin(value: string, options?: StorageOptions): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultOnDiskOptions()),
    );
    account.settings.protectedPin = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultOnDiskOptions()),
    );
  }

  async getRememberedEmail(options?: StorageOptions): Promise<string> {
    return (
      await this.getGlobals(this.reconcileOptions(options, await this.defaultOnDiskLocalOptions()))
    )?.rememberedEmail;
  }

  async setRememberedEmail(value: string, options?: StorageOptions): Promise<void> {
    const globals = await this.getGlobals(
      this.reconcileOptions(options, await this.defaultOnDiskLocalOptions()),
    );
    globals.rememberedEmail = value;
    await this.saveGlobals(
      globals,
      this.reconcileOptions(options, await this.defaultOnDiskLocalOptions()),
    );
  }

  async getSecurityStamp(options?: StorageOptions): Promise<string> {
    return (
      await this.getAccount(this.reconcileOptions(options, await this.defaultInMemoryOptions()))
    )?.tokens?.securityStamp;
  }

  async setSecurityStamp(value: string, options?: StorageOptions): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultInMemoryOptions()),
    );
    account.tokens.securityStamp = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultInMemoryOptions()),
    );
  }

  async getUserId(options?: StorageOptions): Promise<string> {
    return (
      await this.getAccount(this.reconcileOptions(options, await this.defaultOnDiskOptions()))
    )?.profile?.userId;
  }

  async getUsesKeyConnector(options?: StorageOptions): Promise<boolean> {
    return (
      await this.getAccount(this.reconcileOptions(options, await this.defaultOnDiskOptions()))
    )?.profile?.usesKeyConnector;
  }

  async setUsesKeyConnector(value: boolean, options?: StorageOptions): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultOnDiskOptions()),
    );
    account.profile.usesKeyConnector = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultOnDiskOptions()),
    );
  }

  async getVaultTimeout(options?: StorageOptions): Promise<number> {
    const accountVaultTimeout = (
      await this.getAccount(this.reconcileOptions(options, await this.defaultOnDiskLocalOptions()))
    )?.settings?.vaultTimeout;
    return accountVaultTimeout;
  }

  async setVaultTimeout(value: number, options?: StorageOptions): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultOnDiskLocalOptions()),
    );
    account.settings.vaultTimeout = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultOnDiskLocalOptions()),
    );
  }

  async getVaultTimeoutAction(options?: StorageOptions): Promise<string> {
    const accountVaultTimeoutAction = (
      await this.getAccount(this.reconcileOptions(options, await this.defaultOnDiskLocalOptions()))
    )?.settings?.vaultTimeoutAction;
    return (
      accountVaultTimeoutAction ??
      (
        await this.getGlobals(
          this.reconcileOptions(options, await this.defaultOnDiskLocalOptions()),
        )
      )?.vaultTimeoutAction
    );
  }

  async setVaultTimeoutAction(value: string, options?: StorageOptions): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultOnDiskLocalOptions()),
    );
    account.settings.vaultTimeoutAction = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultOnDiskLocalOptions()),
    );
  }

  async getApproveLoginRequests(options?: StorageOptions): Promise<boolean> {
    const approveLoginRequests = (
      await this.getAccount(this.reconcileOptions(options, await this.defaultOnDiskLocalOptions()))
    )?.settings?.approveLoginRequests;
    return approveLoginRequests;
  }

  async setApproveLoginRequests(value: boolean, options?: StorageOptions): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultOnDiskLocalOptions()),
    );
    account.settings.approveLoginRequests = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultOnDiskLocalOptions()),
    );
  }

  async getDeepLinkRedirectUrl(options?: StorageOptions): Promise<string> {
    return (
      await this.getGlobals(this.reconcileOptions(options, await this.defaultOnDiskOptions()))
    )?.deepLinkRedirectUrl;
  }

  async setDeepLinkRedirectUrl(url: string, options?: StorageOptions): Promise<void> {
    const globals = await this.getGlobals(
      this.reconcileOptions(options, await this.defaultOnDiskOptions()),
    );
    globals.deepLinkRedirectUrl = url;
    await this.saveGlobals(
      globals,
      this.reconcileOptions(options, await this.defaultOnDiskOptions()),
    );
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
    return await this.state().then(async (state) => {
      if (state.accounts == null) {
        return null;
      }
      return state.accounts[await this.getUserIdFromMemory(options)];
    });
  }

  protected async getUserIdFromMemory(options: StorageOptions): Promise<string> {
    return await this.state().then((state) => {
      return options?.userId != null
        ? state.accounts[options.userId]?.profile?.userId
        : state.activeUserId;
    });
  }

  protected async getAccountFromDisk(options: StorageOptions): Promise<TAccount> {
    if (options?.userId == null && (await this.state())?.activeUserId == null) {
      return null;
    }

    if (this.useAccountCache) {
      const cachedAccount = this.accountDiskCache.value[options.userId];
      if (cachedAccount != null) {
        return cachedAccount;
      }
    }

    const account = options?.useSecureStorage
      ? (await this.secureStorageService.get<TAccount>(options.userId, options)) ??
        (await this.storageService.get<TAccount>(
          options.userId,
          this.reconcileOptions(options, { htmlStorageLocation: HtmlStorageLocation.Local }),
        ))
      : await this.storageService.get<TAccount>(options.userId, options);

    this.setDiskCache(options.userId, account);
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

    this.deleteDiskCache(options.userId);
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
    await this.pushAccounts();
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
    const storedAccount = await this.getAccount(
      this.reconcileOptions(
        { userId: account.profile.userId },
        await this.defaultOnDiskLocalOptions(),
      ),
    );
    if (storedAccount?.settings != null) {
      account.settings = storedAccount.settings;
    } else if (await this.storageService.has(keys.tempAccountSettings)) {
      account.settings = await this.storageService.get<AccountSettings>(keys.tempAccountSettings);
      await this.storageService.remove(keys.tempAccountSettings);
    }

    await this.saveAccount(
      account,
      this.reconcileOptions(
        { userId: account.profile.userId },
        await this.defaultOnDiskLocalOptions(),
      ),
    );
  }

  protected async scaffoldNewAccountMemoryStorage(account: TAccount): Promise<void> {
    const storedAccount = await this.getAccount(
      this.reconcileOptions(
        { userId: account.profile.userId },
        await this.defaultOnDiskMemoryOptions(),
      ),
    );
    if (storedAccount?.settings != null) {
      account.settings = storedAccount.settings;
    }
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
    const storedAccount = await this.getAccount(
      this.reconcileOptions({ userId: account.profile.userId }, await this.defaultOnDiskOptions()),
    );
    if (storedAccount?.settings != null) {
      account.settings = storedAccount.settings;
    }
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

  protected async pushAccounts(): Promise<void> {
    await this.state().then((state) => {
      if (state.accounts == null || Object.keys(state.accounts).length < 1) {
        this.accountsSubject.next({});
        return;
      }

      this.accountsSubject.next(state.accounts);
    });
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
    return {
      storageLocation: StorageLocation.Memory,
      userId: (await this.state()).activeUserId,
    };
  }

  protected async defaultOnDiskOptions(): Promise<StorageOptions> {
    return {
      storageLocation: StorageLocation.Disk,
      htmlStorageLocation: HtmlStorageLocation.Session,
      userId: (await this.state())?.activeUserId ?? (await this.getActiveUserIdFromStorage()),
      useSecureStorage: false,
    };
  }

  protected async defaultOnDiskLocalOptions(): Promise<StorageOptions> {
    return {
      storageLocation: StorageLocation.Disk,
      htmlStorageLocation: HtmlStorageLocation.Local,
      userId: (await this.state())?.activeUserId ?? (await this.getActiveUserIdFromStorage()),
      useSecureStorage: false,
    };
  }

  protected async defaultOnDiskMemoryOptions(): Promise<StorageOptions> {
    return {
      storageLocation: StorageLocation.Disk,
      htmlStorageLocation: HtmlStorageLocation.Memory,
      userId: (await this.state())?.activeUserId ?? (await this.getUserId()),
      useSecureStorage: false,
    };
  }

  protected async defaultSecureStorageOptions(): Promise<StorageOptions> {
    return {
      storageLocation: StorageLocation.Disk,
      useSecureStorage: true,
      userId: (await this.state())?.activeUserId ?? (await this.getActiveUserIdFromStorage()),
    };
  }

  protected async getActiveUserIdFromStorage(): Promise<string> {
    return await this.storageService.get<string>(keys.activeUserId);
  }

  protected async removeAccountFromLocalStorage(userId: string = null): Promise<void> {
    userId = userId ?? (await this.state())?.activeUserId;
    const storedAccount = await this.getAccount(
      this.reconcileOptions({ userId: userId }, await this.defaultOnDiskLocalOptions()),
    );
    await this.saveAccount(
      this.resetAccount(storedAccount),
      this.reconcileOptions({ userId: userId }, await this.defaultOnDiskLocalOptions()),
    );
  }

  protected async removeAccountFromSessionStorage(userId: string = null): Promise<void> {
    userId = userId ?? (await this.state())?.activeUserId;
    const storedAccount = await this.getAccount(
      this.reconcileOptions({ userId: userId }, await this.defaultOnDiskOptions()),
    );
    await this.saveAccount(
      this.resetAccount(storedAccount),
      this.reconcileOptions({ userId: userId }, await this.defaultOnDiskOptions()),
    );
  }

  protected async removeAccountFromSecureStorage(userId: string = null): Promise<void> {
    userId = userId ?? (await this.state())?.activeUserId;
    await this.setUserKeyAutoUnlock(null, { userId: userId });
    await this.setUserKeyBiometric(null, { userId: userId });
    await this.setCryptoMasterKeyAuto(null, { userId: userId });
    await this.setCryptoMasterKeyBiometric(null, { userId: userId });
    await this.setCryptoMasterKeyB64(null, { userId: userId });
  }

  protected async removeAccountFromMemory(userId: string = null): Promise<void> {
    await this.updateState(async (state) => {
      userId = userId ?? state.activeUserId;
      delete state.accounts[userId];

      this.deleteDiskCache(userId);

      return state;
    });
    // TODO: Invert this logic, we should remove accounts based on logged out emit
    await this.accountService.setAccountStatus(userId as UserId, AuthenticationStatus.LoggedOut);
  }

  // settings persist even on reset, and are not affected by this method
  protected resetAccount(account: TAccount) {
    const persistentAccountInformation = {
      settings: account.settings,
      keys: { deviceKey: account.keys.deviceKey },
      adminAuthRequest: account.adminAuthRequest,
    };
    return Object.assign(this.createAccount(), persistentAccountInformation);
  }

  protected async clearDecryptedDataForActiveUser(): Promise<void> {
    await this.updateState(async (state) => {
      const userId = state?.activeUserId;
      if (userId != null && state?.accounts[userId]?.data != null) {
        state.accounts[userId].data = new AccountData();
      }

      return state;
    });
  }

  protected createAccount(init: Partial<TAccount> = null): TAccount {
    return this.stateFactory.createAccount(init);
  }

  protected createGlobals(init: Partial<TGlobalState> = null): TGlobalState {
    return this.stateFactory.createGlobal(init);
  }

  protected async deAuthenticateAccount(userId: string): Promise<void> {
    await this.tokenService.clearAccessToken(userId as UserId);
    await this.setLastActive(null, { userId: userId });
    await this.updateState(async (state) => {
      state.authenticatedAccounts = state.authenticatedAccounts.filter((id) => id !== userId);

      await this.storageService.save(keys.authenticatedAccounts, state.authenticatedAccounts);

      return state;
    });
  }

  protected async removeAccountFromDisk(userId: string) {
    await this.removeAccountFromSessionStorage(userId);
    await this.removeAccountFromLocalStorage(userId);
    await this.removeAccountFromSecureStorage(userId);
  }

  async nextUpActiveUser() {
    const accounts = (await this.state())?.accounts;
    if (accounts == null || Object.keys(accounts).length < 1) {
      return null;
    }

    let newActiveUser;
    for (const userId in accounts) {
      if (userId == null) {
        continue;
      }
      if (await this.getIsAuthenticated({ userId: userId })) {
        newActiveUser = userId;
        break;
      }
      newActiveUser = null;
    }
    return newActiveUser as UserId;
  }

  protected async dynamicallySetActiveUser() {
    const newActiveUser = await this.nextUpActiveUser();
    await this.setActiveUser(newActiveUser);
    return newActiveUser;
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
    const state = await this.memoryStorageService.get<State<TGlobalState, TAccount>>(keys.state, {
      deserializer: (s) => State.fromJSON(s, this.accountDeserializer),
    });
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

  private setDiskCache(key: string, value: TAccount, options?: StorageOptions) {
    if (this.useAccountCache) {
      this.accountDiskCache.value[key] = value;
      this.accountDiskCache.next(this.accountDiskCache.value);
    }
  }

  protected deleteDiskCache(key: string) {
    if (this.useAccountCache) {
      delete this.accountDiskCache.value[key];
      this.accountDiskCache.next(this.accountDiskCache.value);
    }
  }
}

function withPrototypeForArrayMembers<T>(
  memberConstructor: new (...args: any[]) => T,
  memberConverter: (input: any) => T = (i) => i,
): (
  target: any,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
) => { value: (...args: any[]) => Promise<T[]> } {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    return {
      value: function (...args: any[]) {
        const originalResult: Promise<any[]> = originalMethod.apply(this, args);

        if (!Utils.isPromise(originalResult)) {
          throw new Error(
            `Error applying prototype to stored value -- result is not a promise for method ${String(
              propertyKey,
            )}`,
          );
        }

        return originalResult.then((result) => {
          if (result == null) {
            return null;
          } else if (!(result instanceof Array)) {
            throw new Error(
              `Attempted to retrieve non array type from state as an array for method ${String(
                propertyKey,
              )}`,
            );
          } else {
            return result.map((r) => {
              return r == null ||
                r.constructor.name === memberConstructor.prototype.constructor.name
                ? r
                : memberConverter(
                    Object.create(memberConstructor.prototype, Object.getOwnPropertyDescriptors(r)),
                  );
            });
          }
        });
      },
    };
  };
}

function withPrototypeForObjectValues<T>(
  valuesConstructor: new (...args: any[]) => T,
  valuesConverter: (input: any) => T = (i) => i,
): (
  target: any,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
) => { value: (...args: any[]) => Promise<{ [key: string]: T }> } {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    return {
      value: function (...args: any[]) {
        const originalResult: Promise<{ [key: string]: T }> = originalMethod.apply(this, args);

        if (!Utils.isPromise(originalResult)) {
          throw new Error(
            `Error applying prototype to stored value -- result is not a promise for method ${String(
              propertyKey,
            )}`,
          );
        }

        return originalResult.then((result) => {
          if (result == null) {
            return null;
          } else {
            for (const [key, val] of Object.entries(result)) {
              result[key] =
                val == null || val.constructor.name === valuesConstructor.prototype.constructor.name
                  ? valuesConverter(val)
                  : valuesConverter(
                      Object.create(
                        valuesConstructor.prototype,
                        Object.getOwnPropertyDescriptors(val),
                      ),
                    );
            }

            return result as { [key: string]: T };
          }
        });
      },
    };
  };
}
