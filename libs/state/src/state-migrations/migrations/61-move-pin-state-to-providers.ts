// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { KeyDefinitionLike, MigrationHelper, StateDefinitionLike } from "../migration-helper";
import { Migrator } from "../migrator";

type ExpectedAccountState = {
  settings?: {
    pinKeyEncryptedUserKey?: string; // EncryptedString
    protectedPin?: string; // EncryptedString
    pinProtected?: {
      encrypted?: string;
    };
  };
};

export const PIN_STATE: StateDefinitionLike = { name: "pinUnlock" };

export const PIN_KEY_ENCRYPTED_USER_KEY_PERSISTENT: KeyDefinitionLike = {
  stateDefinition: PIN_STATE,
  key: "pinKeyEncryptedUserKeyPersistent",
};

export const USER_KEY_ENCRYPTED_PIN: KeyDefinitionLike = {
  stateDefinition: PIN_STATE,
  key: "userKeyEncryptedPin",
};

export const OLD_PIN_KEY_ENCRYPTED_MASTER_KEY: KeyDefinitionLike = {
  stateDefinition: PIN_STATE,
  key: "oldPinKeyEncryptedMasterKey",
};

export class PinStateMigrator extends Migrator<60, 61> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const legacyAccounts = await helper.getAccounts<ExpectedAccountState>();
    let updatedAccount = false;

    async function migrateAccount(userId: string, account: ExpectedAccountState) {
      // Migrate pinKeyEncryptedUserKey (to `pinKeyEncryptedUserKeyPersistent`)
      if (account?.settings?.pinKeyEncryptedUserKey != null) {
        await helper.setToUser(
          userId,
          PIN_KEY_ENCRYPTED_USER_KEY_PERSISTENT,
          account.settings.pinKeyEncryptedUserKey,
        );
        delete account.settings.pinKeyEncryptedUserKey;
        updatedAccount = true;
      }

      // Migrate protectedPin (to `userKeyEncryptedPin`)
      if (account?.settings?.protectedPin != null) {
        await helper.setToUser(userId, USER_KEY_ENCRYPTED_PIN, account.settings.protectedPin);
        delete account.settings.protectedPin;
        updatedAccount = true;
      }

      // Migrate pinProtected (to `oldPinKeyEncryptedMasterKey`)
      if (account?.settings?.pinProtected?.encrypted != null) {
        await helper.setToUser(
          userId,
          OLD_PIN_KEY_ENCRYPTED_MASTER_KEY,
          account.settings.pinProtected.encrypted,
        );
        delete account.settings.pinProtected;
        updatedAccount = true;
      }

      if (updatedAccount) {
        await helper.set(userId, account);
      }
    }

    await Promise.all([
      ...legacyAccounts.map(({ userId, account }) => migrateAccount(userId, account)),
    ]);
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountState>();

    async function rollbackAccount(userId: string, account: ExpectedAccountState) {
      let updatedAccount = false;

      const accountPinKeyEncryptedUserKeyPersistent = await helper.getFromUser<string>(
        userId,
        PIN_KEY_ENCRYPTED_USER_KEY_PERSISTENT,
      );
      const accountUserKeyEncryptedPin = await helper.getFromUser<string>(
        userId,
        USER_KEY_ENCRYPTED_PIN,
      );
      const accountOldPinKeyEncryptedMasterKey = await helper.getFromUser<string>(
        userId,
        OLD_PIN_KEY_ENCRYPTED_MASTER_KEY,
      );

      if (!account) {
        account = {};
      }

      if (accountPinKeyEncryptedUserKeyPersistent != null) {
        account.settings.pinKeyEncryptedUserKey = accountPinKeyEncryptedUserKeyPersistent;
        await helper.setToUser(userId, PIN_KEY_ENCRYPTED_USER_KEY_PERSISTENT, null);
        updatedAccount = true;
      }

      if (accountUserKeyEncryptedPin != null) {
        account.settings.protectedPin = accountUserKeyEncryptedPin;
        await helper.setToUser(userId, USER_KEY_ENCRYPTED_PIN, null);
        updatedAccount = true;
      }

      if (accountOldPinKeyEncryptedMasterKey != null) {
        account.settings = Object.assign(account.settings ?? {}, {
          pinProtected: {
            encrypted: accountOldPinKeyEncryptedMasterKey,
          },
        });

        await helper.setToUser(userId, OLD_PIN_KEY_ENCRYPTED_MASTER_KEY, null);
        updatedAccount = true;
      }

      if (updatedAccount) {
        await helper.set(userId, account);
      }
    }

    await Promise.all(accounts.map(({ userId, account }) => rollbackAccount(userId, account)));
  }
}
