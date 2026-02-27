// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

type ExpectedAccountType = {
  profile?: {
    usesKeyConnector?: boolean;
    convertAccountToKeyConnector?: boolean;
  };
};

const usesKeyConnectorKeyDefinition: KeyDefinitionLike = {
  key: "usesKeyConnector",
  stateDefinition: {
    name: "keyConnector",
  },
};

const convertAccountToKeyConnectorKeyDefinition: KeyDefinitionLike = {
  key: "convertAccountToKeyConnector",
  stateDefinition: {
    name: "keyConnector",
  },
};

export class KeyConnectorMigrator extends Migrator<49, 50> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();
    async function migrateAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      const usesKeyConnector = account?.profile?.usesKeyConnector;
      const convertAccountToKeyConnector = account?.profile?.convertAccountToKeyConnector;
      if (usesKeyConnector == null && convertAccountToKeyConnector == null) {
        return;
      }
      if (usesKeyConnector != null) {
        await helper.setToUser(userId, usesKeyConnectorKeyDefinition, usesKeyConnector);
        delete account.profile.usesKeyConnector;
      }
      if (convertAccountToKeyConnector != null) {
        await helper.setToUser(
          userId,
          convertAccountToKeyConnectorKeyDefinition,
          convertAccountToKeyConnector,
        );
        delete account.profile.convertAccountToKeyConnector;
      }
      await helper.set(userId, account);
    }
    await Promise.all([...accounts.map(({ userId, account }) => migrateAccount(userId, account))]);
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();
    async function rollbackAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      const usesKeyConnector: boolean = await helper.getFromUser(
        userId,
        usesKeyConnectorKeyDefinition,
      );
      const convertAccountToKeyConnector: boolean = await helper.getFromUser(
        userId,
        convertAccountToKeyConnectorKeyDefinition,
      );
      if (usesKeyConnector == null && convertAccountToKeyConnector == null) {
        return;
      }
      if (usesKeyConnector != null) {
        account.profile.usesKeyConnector = usesKeyConnector;
        await helper.setToUser(userId, usesKeyConnectorKeyDefinition, null);
      }
      if (convertAccountToKeyConnector != null) {
        account.profile.convertAccountToKeyConnector = convertAccountToKeyConnector;
        await helper.setToUser(userId, convertAccountToKeyConnectorKeyDefinition, null);
      }
      await helper.set(userId, account);
    }

    await Promise.all([...accounts.map(({ userId, account }) => rollbackAccount(userId, account))]);
  }
}
