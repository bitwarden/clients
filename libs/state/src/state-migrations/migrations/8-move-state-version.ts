// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { JsonObject } from "type-fest";

import { MigrationHelper } from "../migration-helper";
import { Direction, Migrator } from "../migrator";

export class MoveStateVersionMigrator extends Migrator<7, 8> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const global = await helper.get<{ stateVersion: number }>("global");
    if (global.stateVersion) {
      await helper.set("stateVersion", global.stateVersion);
      delete global.stateVersion;
      await helper.set("global", global);
    } else {
      throw new Error("Migration failed, state version not found");
    }
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    const version = await helper.get<number>("stateVersion");
    const global = await helper.get<JsonObject>("global");
    await helper.set("global", { ...global, stateVersion: version });
    await helper.set("stateVersion", undefined);
  }

  // Override is necessary because default implementation assumes `stateVersion` at the root, but this migration moves
  // it from a `global` object to root.This makes for unique rollback versioning.
  override async updateVersion(helper: MigrationHelper, direction: Direction): Promise<void> {
    const endVersion = direction === "up" ? this.toVersion : this.fromVersion;
    helper.currentVersion = endVersion;
    if (direction === "up") {
      await helper.set("stateVersion", endVersion);
    } else {
      const global: { stateVersion: number } = (await helper.get("global")) || ({} as any);
      await helper.set("global", { ...global, stateVersion: endVersion });
    }
  }
}
