// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { KeyDefinitionLike, MigrationHelper, StateDefinitionLike } from "../migration-helper";
import { Migrator } from "../migrator";

type ExpectedAccountState = {
  settings?: { autoConfirmFingerPrints?: boolean };
};

const ORGANIZATION_MANAGEMENT_PREFERENCES: StateDefinitionLike = {
  name: "organizationManagementPreferences",
};

const AUTO_CONFIRM_FINGERPRINTS: KeyDefinitionLike = {
  key: "autoConfirmFingerPrints",
  stateDefinition: ORGANIZATION_MANAGEMENT_PREFERENCES,
};

export class AutoConfirmFingerPrintsMigrator extends Migrator<42, 43> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const legacyAccounts = await helper.getAccounts<ExpectedAccountState>();

    await Promise.all(
      legacyAccounts.map(async ({ userId, account }) => {
        if (account?.settings?.autoConfirmFingerPrints != null) {
          await helper.setToUser(
            userId,
            AUTO_CONFIRM_FINGERPRINTS,
            account.settings.autoConfirmFingerPrints,
          );
          delete account?.settings?.autoConfirmFingerPrints;
          await helper.set(userId, account);
        }
      }),
    );
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    async function rollbackUser(userId: string, account: ExpectedAccountState) {
      let updatedAccount = false;
      const autoConfirmFingerPrints = await helper.getFromUser<boolean>(
        userId,
        AUTO_CONFIRM_FINGERPRINTS,
      );

      if (autoConfirmFingerPrints) {
        if (!account) {
          account = {};
        }

        updatedAccount = true;
        account.settings.autoConfirmFingerPrints = autoConfirmFingerPrints;
        await helper.setToUser(userId, AUTO_CONFIRM_FINGERPRINTS, null);
      }

      if (updatedAccount) {
        await helper.set(userId, account);
      }
    }

    const accounts = await helper.getAccounts<ExpectedAccountState>();

    await Promise.all(accounts.map(({ userId, account }) => rollbackUser(userId, account)));
  }
}
