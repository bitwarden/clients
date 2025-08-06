import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

const BAD_FOLDER_KEY: KeyDefinitionLike = {
  key: "folder", // We inadvertently changed the key from "folders" to "folder"
  stateDefinition: {
    name: "folder",
  },
};

const GOOD_FOLDER_KEY: KeyDefinitionLike = {
  key: "folders", // We should keep the key as "folders"
  stateDefinition: {
    name: "folder",
  },
};

export class MigrateIncorrectFolderKey extends Migrator<68, 69> {
  async migrate(helper: MigrationHelper): Promise<void> {
    async function migrateUser(userId: string) {
      const value = await helper.getFromUser(userId, BAD_FOLDER_KEY);
      if (value != null) {
        await helper.setToUser(userId, GOOD_FOLDER_KEY, value);
      }
      await helper.removeFromUser(userId, BAD_FOLDER_KEY);
    }
    const users = await helper.getKnownUserIds();
    await Promise.all(users.map((userId) => migrateUser(userId)));
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    async function rollbackUser(userId: string) {
      const value = await helper.getFromUser(userId, GOOD_FOLDER_KEY);
      if (value != null) {
        await helper.setToUser(userId, BAD_FOLDER_KEY, value);
      }
      await helper.removeFromUser(userId, GOOD_FOLDER_KEY);
    }
    const users = await helper.getKnownUserIds();
    await Promise.all(users.map((userId) => rollbackUser(userId)));
  }
}
