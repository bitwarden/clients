import { KeyDefinitionLike, MigrationHelper, StateDefinitionLike } from "../migration-helper";
import { Migrator } from "../migrator";

type ExpectedAccountState = {
  settings?: {
    pinKeyEncryptedUserKey?: string; // EncryptedString
  };
};

const CRYPTO_STATE: StateDefinitionLike = { name: "crypto" };
const PIN_KEY_ENCRYPTED_USER_KEY: KeyDefinitionLike = {
  key: "pinKeyEncryptedUserKey",
  stateDefinition: CRYPTO_STATE,
};

export class PinKeyEncryptedUserKeyMigrator extends Migrator<49, 50> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const legacyAccounts = await helper.getAccounts<ExpectedAccountState>();

    await Promise.all(
      legacyAccounts.map(async ({ userId, account }) => {
        // Move account pinKeyEncryptedUserKey
        if (account?.settings?.pinKeyEncryptedUserKey != null) {
          await helper.setToUser(
            userId,
            PIN_KEY_ENCRYPTED_USER_KEY,
            account.settings.pinKeyEncryptedUserKey,
          );

          // Delete old account pinKeyEncryptedUserKey property
          delete account?.settings?.pinKeyEncryptedUserKey;
          await helper.set(userId, account);
        }
      }),
    );
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    async function rollbackUser(userId: string, account: ExpectedAccountState) {
      let updatedAccount = false;
      const userPinKeyEncryptedUserKey = await helper.getFromUser<string>(
        userId,
        PIN_KEY_ENCRYPTED_USER_KEY,
      );

      if (userPinKeyEncryptedUserKey) {
        if (!account) {
          account = {};
        }

        updatedAccount = true;
        account.settings.pinKeyEncryptedUserKey = userPinKeyEncryptedUserKey;
        await helper.setToUser(userId, PIN_KEY_ENCRYPTED_USER_KEY, null);
      }

      if (updatedAccount) {
        await helper.set(userId, account);
      }
    }

    const accounts = await helper.getAccounts<ExpectedAccountState>();

    await Promise.all(accounts.map(({ userId, account }) => rollbackUser(userId, account)));
  }
}
