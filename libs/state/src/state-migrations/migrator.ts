import { NonNegativeInteger } from "type-fest";

import { MigrationHelper } from "./migration-helper";

export const IRREVERSIBLE = new Error("Irreversible migration");

export type VersionFrom<T> =
  T extends Migrator<infer TFrom, number>
    ? TFrom extends NonNegativeInteger<TFrom>
      ? TFrom
      : never
    : never;
export type VersionTo<T> =
  T extends Migrator<number, infer TTo>
    ? TTo extends NonNegativeInteger<TTo>
      ? TTo
      : never
    : never;
export type Direction = "up" | "down";

export abstract class Migrator<TFrom extends number, TTo extends number> {
  constructor(
    public fromVersion: TFrom,
    public toVersion: TTo,
  ) {
    if (fromVersion == null || toVersion == null) {
      throw new Error("Invalid migration");
    }
    if (fromVersion > toVersion) {
      throw new Error("Invalid migration");
    }
  }

  shouldMigrate(helper: MigrationHelper, direction: Direction): Promise<boolean> {
    const startVersion = direction === "up" ? this.fromVersion : this.toVersion;
    return Promise.resolve(helper.currentVersion === startVersion);
  }
  abstract migrate(helper: MigrationHelper): Promise<void>;
  abstract rollback(helper: MigrationHelper): Promise<void>;
  async updateVersion(helper: MigrationHelper, direction: Direction): Promise<void> {
    const endVersion = direction === "up" ? this.toVersion : this.fromVersion;
    helper.currentVersion = endVersion;
    await helper.set("stateVersion", endVersion);
  }
}
