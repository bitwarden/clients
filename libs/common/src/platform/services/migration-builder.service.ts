// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { createMigrationBuilder } from "../../state-migrations";
import { MigrationBuilder } from "../../state-migrations/migration-builder";

export class MigrationBuilderService {
  private migrationBuilderCache: MigrationBuilder;

  build() {
    return (this.migrationBuilderCache ??= createMigrationBuilder());
  }
}
