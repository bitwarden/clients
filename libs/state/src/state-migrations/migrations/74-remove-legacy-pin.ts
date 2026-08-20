import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { IRREVERSIBLE, Migrator } from "../migrator";

type ExpectedAccountType = NonNullable<unknown>;

export const PinProtectedUserKey: KeyDefinitionLike = {
  key: "pinKeyEncryptedUserKeyPersistent",
  stateDefinition: {
    name: "pinUnlock",
  },
};

export class RemoveLegacyPin extends Migrator<73, 74> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();
    async function migrateAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      const pinProtectedUserKey = await helper.getFromUser(userId, PinProtectedUserKey);

      if (pinProtectedUserKey != null) {
        await helper.removeFromUser(userId, PinProtectedUserKey);
      }
    }

    await Promise.all([...accounts.map(({ userId, account }) => migrateAccount(userId, account))]);
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    throw IRREVERSIBLE;
  }
}
