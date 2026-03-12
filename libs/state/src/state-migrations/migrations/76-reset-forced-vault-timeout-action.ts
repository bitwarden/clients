import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { IRREVERSIBLE, Migrator } from "../migrator";

const USER_DECRYPTION_OPTIONS: KeyDefinitionLike = {
  key: "decryptionOptions",
  stateDefinition: { name: "userDecryptionOptions" },
};

const VAULT_TIMEOUT_ACTION: KeyDefinitionLike = {
  key: "vaultTimeoutAction",
  stateDefinition: { name: "vaultTimeoutSettings" },
};

export class ResetForcedVaultTimeoutAction extends Migrator<75, 76> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts();
    await Promise.all(
      accounts.map(async ({ userId }) => {
        const storedAction = await helper.getFromUser<string>(userId, VAULT_TIMEOUT_ACTION);
        if (storedAction !== "logOut") {
          return;
        }

        // Only reset master password-less accounts (like TDE) — these had LogOut force-stored
        const decryptionOptions = await helper.getFromUser<{ hasMasterPassword?: boolean }>(
          userId,
          USER_DECRYPTION_OPTIONS,
        );
        if (decryptionOptions == null || decryptionOptions.hasMasterPassword === true) {
          return; // has master password — user explicitly chose LogOut, leave it
        }

        await helper.setToUser(userId, VAULT_TIMEOUT_ACTION, null);
      }),
    );
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    throw IRREVERSIBLE;
  }
}
