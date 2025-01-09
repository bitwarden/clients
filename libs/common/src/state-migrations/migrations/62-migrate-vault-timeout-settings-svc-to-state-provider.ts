// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { KeyDefinitionLike, MigrationHelper, StateDefinitionLike } from "../migration-helper";
import { Migrator } from "../migrator";

// Types to represent data as it is stored in JSON
type ExpectedAccountType = {
  settings?: {
    vaultTimeout?: number;
    vaultTimeoutAction?: string;
  };
};

type ExpectedGlobalType = {
  vaultTimeout?: number;
  vaultTimeoutAction?: string;
};

const VAULT_TIMEOUT_SETTINGS_STATE_DEF_LIKE: StateDefinitionLike = {
  name: "vaultTimeoutSettings",
};

export const VAULT_TIMEOUT: KeyDefinitionLike = {
  key: "vaultTimeout", // matches KeyDefinition.key
  stateDefinition: VAULT_TIMEOUT_SETTINGS_STATE_DEF_LIKE,
};

export const VAULT_TIMEOUT_ACTION: KeyDefinitionLike = {
  key: "vaultTimeoutAction", // matches KeyDefinition.key
  stateDefinition: VAULT_TIMEOUT_SETTINGS_STATE_DEF_LIKE,
};

// Migrations are supposed to be frozen so we have to copy the type here.
export type VaultTimeout =
  | number // 0 for immediately; otherwise positive numbers
  | "never" // null
  | "onRestart" // -1
  | "onLocked" // -2
  | "onSleep" // -3
  | "onIdle"; // -4

// Define mapping of old values to new values for migration purposes
const vaultTimeoutTypeMigrateRecord: Record<any, VaultTimeout> = {
  null: "never",
  "-1": "onRestart",
  "-2": "onLocked",
  "-3": "onSleep",
  "-4": "onIdle",
};

// define mapping of new values to old values for rollback purposes
const vaultTimeoutTypeRollbackRecord: Record<VaultTimeout, any> = {
  never: null,
  onRestart: -1,
  onLocked: -2,
  onSleep: -3,
  onIdle: -4,
};

export enum ClientType {
  Web = "web",
  Browser = "browser",
  Desktop = "desktop",
  Cli = "cli",
}

export class VaultTimeoutSettingsServiceStateProviderMigrator extends Migrator<61, 62> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const globalData = await helper.get<ExpectedGlobalType>("global");

    const accounts = await helper.getAccounts<ExpectedAccountType>();
    async function migrateAccount(
      userId: string,
      account: ExpectedAccountType | undefined,
    ): Promise<void> {
      let updatedAccount = false;

      // Migrate vault timeout
      let existingVaultTimeout = account?.settings?.vaultTimeout;

      if (helper.clientType === ClientType.Cli && existingVaultTimeout === undefined) {
        // The CLI does not set a vault timeout by default so we need to set it to null
        // so that the migration can migrate null to "never" as the CLI does not have a vault timeout.
        existingVaultTimeout = null;
      }

      if (existingVaultTimeout !== undefined) {
        // check undefined so that we allow null values (previously meant never timeout)
        // Only migrate data that exists

        if (existingVaultTimeout === null || existingVaultTimeout < 0) {
          // Map null or negative values to new string values
          const newVaultTimeout = vaultTimeoutTypeMigrateRecord[existingVaultTimeout];
          await helper.setToUser(userId, VAULT_TIMEOUT, newVaultTimeout);
        } else {
          // Persist positive numbers as is
          await helper.setToUser(userId, VAULT_TIMEOUT, existingVaultTimeout);
        }

        delete account?.settings?.vaultTimeout;
        updatedAccount = true;
      }

      // Migrate vault timeout action
      const existingVaultTimeoutAction = account?.settings?.vaultTimeoutAction;

      if (existingVaultTimeoutAction != null) {
        // Only migrate data that exists
        await helper.setToUser(userId, VAULT_TIMEOUT_ACTION, existingVaultTimeoutAction);

        delete account?.settings?.vaultTimeoutAction;
        updatedAccount = true;
      }

      // Note: we are explicitly not worrying about mapping over the global fallback vault timeout / action
      // into the new state provider framework.  It was originally a fallback but hasn't been used for years
      // so this migration will clean up the global properties fully.

      if (updatedAccount) {
        // Save the migrated account only if it was updated
        await helper.set(userId, account);
      }
    }

    await Promise.all([...accounts.map(({ userId, account }) => migrateAccount(userId, account))]);

    // Delete global data (works for browser extension and web; CLI doesn't have these as global settings).
    delete globalData?.vaultTimeout;
    delete globalData?.vaultTimeoutAction;
    await helper.set("global", globalData);

    // Remove desktop only settings. These aren't found by the above global key removal b/c of
    // the different storage key format. This removal does not cause any issues on migrating for other clients.
    await helper.remove("global\\.vaultTimeout");
    await helper.remove("global\\.vaultTimeoutAction");
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();

    async function rollbackAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      let updatedLegacyAccount = false;

      // Rollback vault timeout
      const migratedVaultTimeout = await helper.getFromUser<VaultTimeout>(userId, VAULT_TIMEOUT);

      if (account?.settings && migratedVaultTimeout != null) {
        if (typeof migratedVaultTimeout === "string") {
          // Map new string values back to old values
          account.settings.vaultTimeout = vaultTimeoutTypeRollbackRecord[migratedVaultTimeout];
        } else {
          // persist numbers as is
          account.settings.vaultTimeout = migratedVaultTimeout;
        }

        updatedLegacyAccount = true;
      }

      await helper.setToUser(userId, VAULT_TIMEOUT, null);

      // Rollback vault timeout action
      const migratedVaultTimeoutAction = await helper.getFromUser<string>(
        userId,
        VAULT_TIMEOUT_ACTION,
      );

      if (account?.settings && migratedVaultTimeoutAction != null) {
        account.settings.vaultTimeoutAction = migratedVaultTimeoutAction;
        updatedLegacyAccount = true;
      }

      await helper.setToUser(userId, VAULT_TIMEOUT_ACTION, null);

      if (updatedLegacyAccount) {
        await helper.set(userId, account);
      }
    }

    await Promise.all([...accounts.map(({ userId, account }) => rollbackAccount(userId, account))]);
  }
}
