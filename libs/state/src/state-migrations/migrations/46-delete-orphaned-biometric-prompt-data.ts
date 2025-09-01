import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { IRREVERSIBLE, Migrator } from "../migrator";

export const PROMPT_CANCELLED: KeyDefinitionLike = {
  key: "promptCancelled",
  stateDefinition: { name: "biometricSettings" },
};

export class DeleteBiometricPromptCancelledData extends Migrator<45, 46> {
  async migrate(helper: MigrationHelper): Promise<void> {
    await Promise.all(
      (await helper.getAccounts()).map(async ({ userId }) => {
        if (helper.getFromUser(userId, PROMPT_CANCELLED) != null) {
          await helper.removeFromUser(userId, PROMPT_CANCELLED);
        }
      }),
    );
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    throw IRREVERSIBLE;
  }
}
