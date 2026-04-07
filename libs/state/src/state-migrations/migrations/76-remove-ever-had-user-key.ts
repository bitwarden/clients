import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { IRREVERSIBLE, Migrator } from "../migrator";

type ExpectedAccountType = NonNullable<unknown>;

const everHadUserKeyDefinition: KeyDefinitionLike = {
  key: "everHadUserKey",
  stateDefinition: {
    name: "crypto",
  },
};

export class RemoveEverHadUserKeyMigrator extends Migrator<75, 76> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();
    for (const { userId } of accounts) {
      await helper.removeFromUser(userId, everHadUserKeyDefinition);
    }
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    throw IRREVERSIBLE;
  }
}
