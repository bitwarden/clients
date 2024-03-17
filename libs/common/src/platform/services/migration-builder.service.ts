import { createMigrationBuilder } from "../../state-migrations";
import { MigrationBuilder } from "../../state-migrations/migration-builder";

export class MigrationBuilderService {
  private migrationBuilderCache: MigrationBuilder;

  build() {
    return (this.migrationBuilderCache ??= createMigrationBuilder());
  }
}
