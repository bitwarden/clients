// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

type ExpectedAccountType = {
  keys?: {
    masterKeyEncryptedUserKey?: string;
  };
  profile?: {
    forceSetPasswordReason?: number;
    keyHash?: string;
  };
};

export const FORCE_SET_PASSWORD_REASON_DEFINITION: KeyDefinitionLike = {
  key: "forceSetPasswordReason",
  stateDefinition: {
    name: "masterPassword",
  },
};

export const MASTER_KEY_HASH_DEFINITION: KeyDefinitionLike = {
  key: "masterKeyHash",
  stateDefinition: {
    name: "masterPassword",
  },
};

export const MASTER_KEY_ENCRYPTED_USER_KEY_DEFINITION: KeyDefinitionLike = {
  key: "masterKeyEncryptedUserKey",
  stateDefinition: {
    name: "masterPassword",
  },
};

export class MoveMasterKeyStateToProviderMigrator extends Migrator<54, 55> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();
    async function migrateAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      const forceSetPasswordReason = account?.profile?.forceSetPasswordReason;
      if (forceSetPasswordReason != null) {
        await helper.setToUser(
          userId,
          FORCE_SET_PASSWORD_REASON_DEFINITION,
          forceSetPasswordReason,
        );

        delete account.profile.forceSetPasswordReason;
        await helper.set(userId, account);
      }

      const masterKeyHash = account?.profile?.keyHash;
      if (masterKeyHash != null) {
        await helper.setToUser(userId, MASTER_KEY_HASH_DEFINITION, masterKeyHash);

        delete account.profile.keyHash;
        await helper.set(userId, account);
      }

      const masterKeyEncryptedUserKey = account?.keys?.masterKeyEncryptedUserKey;
      if (masterKeyEncryptedUserKey != null) {
        await helper.setToUser(
          userId,
          MASTER_KEY_ENCRYPTED_USER_KEY_DEFINITION,
          masterKeyEncryptedUserKey,
        );

        delete account.keys.masterKeyEncryptedUserKey;
        await helper.set(userId, account);
      }
    }

    await Promise.all([...accounts.map(({ userId, account }) => migrateAccount(userId, account))]);
  }
  async rollback(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();
    async function rollbackAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      const forceSetPasswordReason = await helper.getFromUser(
        userId,
        FORCE_SET_PASSWORD_REASON_DEFINITION,
      );
      const masterKeyHash = await helper.getFromUser(userId, MASTER_KEY_HASH_DEFINITION);
      const masterKeyEncryptedUserKey = await helper.getFromUser(
        userId,
        MASTER_KEY_ENCRYPTED_USER_KEY_DEFINITION,
      );
      if (account != null) {
        if (forceSetPasswordReason != null) {
          account.profile = Object.assign(account.profile ?? {}, {
            forceSetPasswordReason,
          });
        }
        if (masterKeyHash != null) {
          account.profile = Object.assign(account.profile ?? {}, {
            keyHash: masterKeyHash,
          });
        }
        if (masterKeyEncryptedUserKey != null) {
          account.keys = Object.assign(account.keys ?? {}, {
            masterKeyEncryptedUserKey,
          });
        }
        await helper.set(userId, account);
      }

      await helper.setToUser(userId, FORCE_SET_PASSWORD_REASON_DEFINITION, null);
      await helper.setToUser(userId, MASTER_KEY_HASH_DEFINITION, null);
    }

    await Promise.all([...accounts.map(({ userId, account }) => rollbackAccount(userId, account))]);
  }
}
