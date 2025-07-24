import { MigrationHelper } from "./migration-helper";
import { Direction, Migrator, VersionFrom, VersionTo } from "./migrator";

export class MigrationBuilder<TCurrent extends number = 0> {
  /** Create a new MigrationBuilder with an empty buffer of migrations to perform.
   *
   * Add migrations to the buffer with {@link with} and {@link rollback}.
   * @returns A new MigrationBuilder.
   */
  static create(): MigrationBuilder<0> {
    return new MigrationBuilder([]);
  }

  private constructor(
    private migrations: readonly { migrator: Migrator<number, number>; direction: Direction }[],
  ) {}

  /** Add a migrator to the MigrationBuilder. Types are updated such that the chained MigrationBuilder must currently be
   * at state version equal to the from version of the migrator. Return as MigrationBuilder<TTo> where TTo is the to
   * version of the migrator, so that the next migrator can be chained.
   *
   * @param migrate A migrator class or a tuple of a migrator class, the from version, and the to version. A tuple is
   * required to instantiate version numbers unless a default constructor is defined.
   * @returns A new MigrationBuilder with the to version of the migrator as the current version.
   */
  with<
    TMigrator extends Migrator<number, number>,
    TFrom extends VersionFrom<TMigrator> & TCurrent,
    TTo extends VersionTo<TMigrator>,
  >(
    ...migrate: [new () => TMigrator] | [new (from: TFrom, to: TTo) => TMigrator, TFrom, TTo]
  ): MigrationBuilder<TTo> {
    return this.addMigrator(migrate, "up");
  }

  /** Add a migrator to rollback on the MigrationBuilder's list of migrations. As with {@link with}, types of
   * MigrationBuilder and Migrator must align. However, this time the migration is reversed so TCurrent of the
   * MigrationBuilder must be equal to the to version of the migrator. Return as MigrationBuilder<TFrom> where TFrom
   * is the from version of the migrator, so that the next migrator can be chained.
   *
   * @param migrate A migrator class or a tuple of a migrator class, the from version, and the to version. A tuple is
   * required to instantiate version numbers unless a default constructor is defined.
   * @returns A new MigrationBuilder with the from version of the migrator as the current version.
   */
  rollback<
    TMigrator extends Migrator<number, number>,
    TFrom extends VersionFrom<TMigrator>,
    TTo extends VersionTo<TMigrator> & TCurrent,
  >(
    ...migrate: [new () => TMigrator] | [new (from: TFrom, to: TTo) => TMigrator, TTo, TFrom]
  ): MigrationBuilder<TFrom> {
    if (migrate.length === 3) {
      migrate = [migrate[0], migrate[2], migrate[1]];
    }
    return this.addMigrator(migrate, "down");
  }

  /** Execute the migrations as defined in the MigrationBuilder's migrator buffer */
  migrate(helper: MigrationHelper): Promise<void> {
    return this.migrations.reduce(
      (promise, migrator) =>
        promise.then(async () => {
          await this.runMigrator(migrator.migrator, helper, migrator.direction);
        }),
      Promise.resolve(),
    );
  }

  private addMigrator<
    TMigrator extends Migrator<number, number>,
    TFrom extends VersionFrom<TMigrator> & TCurrent,
    TTo extends VersionTo<TMigrator>,
  >(
    migrate: [new () => TMigrator] | [new (from: TFrom, to: TTo) => TMigrator, TFrom, TTo],
    direction: Direction = "up",
  ) {
    const newMigration =
      migrate.length === 1
        ? { migrator: new migrate[0](), direction }
        : { migrator: new migrate[0](migrate[1], migrate[2]), direction };

    return new MigrationBuilder<TTo>([...this.migrations, newMigration]);
  }

  private async runMigrator(
    migrator: Migrator<number, number>,
    helper: MigrationHelper,
    direction: Direction,
  ): Promise<void> {
    const shouldMigrate = await migrator.shouldMigrate(helper, direction);
    helper.info(
      `Migrator ${migrator.constructor.name} (to version ${migrator.toVersion}) should migrate: ${shouldMigrate} - ${direction}`,
    );
    if (shouldMigrate) {
      const method = direction === "up" ? migrator.migrate : migrator.rollback;
      await method.bind(migrator)(helper);
      helper.info(
        `Migrator ${migrator.constructor.name} (to version ${migrator.toVersion}) migrated - ${direction}`,
      );
      await migrator.updateVersion(helper, direction);
      helper.info(
        `Migrator ${migrator.constructor.name} (to version ${migrator.toVersion}) updated version - ${direction}`,
      );
    }
  }
}
