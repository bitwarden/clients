import { MigrationHelper } from "../migration-helper";
import { Direction, IRREVERSIBLE, Migrator } from "../migrator";

type ExpectedAccountType = { profile?: { everBeenUnlocked?: boolean } };

export class RemoveEverBeenUnlockedMigrator extends Migrator<3, 4> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();

    async function removeEverBeenUnlocked(userId: string, account: ExpectedAccountType) {
      if (account?.profile?.everBeenUnlocked != null) {
        delete account.profile.everBeenUnlocked;
        return helper.set(userId, account);
      }
    }

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    Promise.all(accounts.map(({ userId, account }) => removeEverBeenUnlocked(userId, account)));
  }

  rollback(helper: MigrationHelper): Promise<void> {
    throw IRREVERSIBLE;
  }

  // Override is necessary because default implementation assumes `stateVersion` at the root, but for this version
  // it is nested inside a global object.
  override async updateVersion(helper: MigrationHelper, direction: Direction): Promise<void> {
    const endVersion = direction === "up" ? this.toVersion : this.fromVersion;
    helper.currentVersion = endVersion;
    const global: { stateVersion: number } = (await helper.get("global")) || ({} as any);
    await helper.set("global", { ...global, stateVersion: endVersion });
  }
}
