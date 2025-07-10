// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { KeyDefinitionLike, MigrationHelper, StateDefinitionLike } from "../migration-helper";
import { Migrator } from "../migrator";

type ExpectedAccountState = {
  settings?: { avatarColor?: string };
};

const AVATAR_COLOR_STATE: StateDefinitionLike = { name: "avatar" };

const AVATAR_COLOR_KEY: KeyDefinitionLike = {
  key: "avatarColor",
  stateDefinition: AVATAR_COLOR_STATE,
};

export class AvatarColorMigrator extends Migrator<36, 37> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const legacyAccounts = await helper.getAccounts<ExpectedAccountState>();

    await Promise.all(
      legacyAccounts.map(async ({ userId, account }) => {
        // Move account avatarColor
        if (account?.settings?.avatarColor != null) {
          await helper.setToUser(userId, AVATAR_COLOR_KEY, account.settings.avatarColor);

          // Delete old account avatarColor property
          delete account?.settings?.avatarColor;
          await helper.set(userId, account);
        }
      }),
    );
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    async function rollbackUser(userId: string, account: ExpectedAccountState) {
      let updatedAccount = false;
      const userAvatarColor = await helper.getFromUser<string>(userId, AVATAR_COLOR_KEY);

      if (userAvatarColor) {
        if (!account) {
          account = {};
        }

        updatedAccount = true;
        account.settings.avatarColor = userAvatarColor;
        await helper.setToUser(userId, AVATAR_COLOR_KEY, null);
      }

      if (updatedAccount) {
        await helper.set(userId, account);
      }
    }

    const accounts = await helper.getAccounts<ExpectedAccountState>();

    await Promise.all(accounts.map(({ userId, account }) => rollbackUser(userId, account)));
  }
}
