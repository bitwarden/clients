import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

export const ACCOUNT_ACCOUNTS: KeyDefinitionLike = {
  stateDefinition: {
    name: "account",
  },
  key: "accounts",
};

export const MASTER_PASSWORD_UNLOCK_KEY: KeyDefinitionLike = {
  key: "masterPasswordUnlockKey",
  stateDefinition: { name: "masterPasswordUnlock" },
};

export const MASTER_KEY_ENCRYPTED_USER_KEY: KeyDefinitionLike = {
  key: "masterKeyEncryptedUserKey",
  stateDefinition: { name: "masterPassword" },
};

export const KDF_CONFIG_DISK: KeyDefinitionLike = {
  key: "kdfConfig",
  stateDefinition: { name: "kdfConfig" },
};

type KdfConfig = {
  iterations: number;
  kdfType: 0 | 1;
  memory?: number;
  parallelism?: number;
};

export type AccountType = {
  profile?: {
    email?: string;
  };
};

type AccountsMap = Record<string, Account>;
type Account = {
  email: string;
  name: string;
};

export class AddMasterPasswordUnlockData extends Migrator<72, 73> {
  async migrate(helper: MigrationHelper): Promise<void> {
    async function migrateAccount(userId: string, accounts: AccountsMap) {
      const email = accounts[userId]?.email;
      const kdfConfig: KdfConfig = await helper.getFromUser(userId, KDF_CONFIG_DISK);
      const masterKeyEncryptedUserKey = await helper.getFromUser(
        userId,
        MASTER_KEY_ENCRYPTED_USER_KEY,
      );
      if (
        (await helper.getFromUser(userId, MASTER_PASSWORD_UNLOCK_KEY)) == null &&
        email != null &&
        kdfConfig != null &&
        masterKeyEncryptedUserKey != null
      ) {
        await helper.setToUser(userId, MASTER_PASSWORD_UNLOCK_KEY, {
          salt: email.trim().toLowerCase(),
          kdf: kdfConfig,
          masterKeyWrappedUserKey: masterKeyEncryptedUserKey,
        });
      }
    }

    const accountDictionary = await helper.getFromGlobal<AccountsMap>(ACCOUNT_ACCOUNTS);
    const accounts = await helper.getAccounts();
    await Promise.all(accounts.map(({ userId }) => migrateAccount(userId, accountDictionary)));
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    async function rollbackAccount(userId: string) {
      if ((await helper.getFromUser(userId, MASTER_PASSWORD_UNLOCK_KEY)) != null) {
        await helper.removeFromUser(userId, MASTER_PASSWORD_UNLOCK_KEY);
      }
    }

    const accounts = await helper.getAccounts();
    await Promise.all(accounts.map(({ userId }) => rollbackAccount(userId)));
  }
}
