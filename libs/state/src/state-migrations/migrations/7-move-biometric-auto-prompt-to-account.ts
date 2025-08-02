import { MigrationHelper } from "../migration-helper";
import { Direction, IRREVERSIBLE, Migrator } from "../migrator";

type ExpectedAccountType = { settings?: { disableAutoBiometricsPrompt?: boolean } };

export class MoveBiometricAutoPromptToAccount extends Migrator<6, 7> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const global = await helper.get<{ noAutoPromptBiometrics?: boolean }>("global");
    const noAutoPromptBiometrics = global?.noAutoPromptBiometrics ?? false;

    const accounts = await helper.getAccounts<ExpectedAccountType>();
    async function updateAccount(userId: string, account: ExpectedAccountType) {
      if (account == null) {
        return;
      }

      if (noAutoPromptBiometrics) {
        account.settings = Object.assign(account?.settings ?? {}, {
          disableAutoBiometricsPrompt: true,
        });
        await helper.set(userId, account);
      }
    }

    delete global.noAutoPromptBiometrics;

    await Promise.all([
      ...accounts.map(({ userId, account }) => updateAccount(userId, account)),
      helper.set("global", global),
    ]);
  }

  async rollback(helper: MigrationHelper): Promise<void> {
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
