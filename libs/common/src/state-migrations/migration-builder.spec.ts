import { mock } from "jest-mock-extended";

// eslint-disable-next-line import/no-restricted-paths
import { ClientType } from "../enums";

import { MigrationBuilder } from "./migration-builder";
import { MigrationHelper } from "./migration-helper";
import { Migrator } from "./migrator";

describe("MigrationBuilder", () => {
  class TestMigrator extends Migrator<0, 1> {
    async migrate(helper: MigrationHelper): Promise<void> {
      await helper.set("test", "test");
      return;
    }

    async rollback(helper: MigrationHelper): Promise<void> {
      await helper.set("test", "rollback");
      return;
    }
  }

  class TestMigratorWithInstanceMethod extends Migrator<0, 1> {
    private async instanceMethod(helper: MigrationHelper, value: string) {
      await helper.set("test", value);
    }

    async migrate(helper: MigrationHelper): Promise<void> {
      await this.instanceMethod(helper, "migrate");
    }

    async rollback(helper: MigrationHelper): Promise<void> {
      await this.instanceMethod(helper, "rollback");
    }
  }

  let sut: MigrationBuilder<number>;

  beforeEach(() => {
    sut = MigrationBuilder.create();
  });

  class TestBadMigrator extends Migrator<1, 0> {
    async migrate(helper: MigrationHelper): Promise<void> {
      await helper.set("test", "test");
    }

    async rollback(helper: MigrationHelper): Promise<void> {
      await helper.set("test", "rollback");
    }
  }

  it("should throw if instantiated incorrectly", () => {
    expect(() => MigrationBuilder.create().with(TestMigrator, null, null)).toThrow();
    expect(() =>
      MigrationBuilder.create().with(TestMigrator, 0, 1).with(TestBadMigrator, 1, 0),
    ).toThrow();
  });

  it("should be able to create a new MigrationBuilder", () => {
    expect(sut).toBeInstanceOf(MigrationBuilder);
  });

  it("should be able to add a migrator", () => {
    const newBuilder = sut.with(TestMigrator, 0, 1);
    const migrations = newBuilder["migrations"];
    expect(migrations.length).toBe(1);
    expect(migrations[0]).toMatchObject({ migrator: expect.any(TestMigrator), direction: "up" });
  });

  it("should be able to add a rollback", () => {
    const newBuilder = sut.with(TestMigrator, 0, 1).rollback(TestMigrator, 1, 0);
    const migrations = newBuilder["migrations"];
    expect(migrations.length).toBe(2);
    expect(migrations[1]).toMatchObject({ migrator: expect.any(TestMigrator), direction: "down" });
  });

  const clientTypes = Object.values(ClientType);

  describe.each(clientTypes)("for client %s", (clientType) => {
    describe("migrate", () => {
      let migrator: TestMigrator;
      let rollback_migrator: TestMigrator;

      beforeEach(() => {
        sut = sut.with(TestMigrator, 0, 1).rollback(TestMigrator, 1, 0);
        migrator = (sut as any).migrations[0].migrator;
        rollback_migrator = (sut as any).migrations[1].migrator;
      });

      it("should migrate", async () => {
        const helper = new MigrationHelper(0, mock(), mock(), "general", clientType);
        const spy = jest.spyOn(migrator, "migrate");
        await sut.migrate(helper);
        expect(spy).toBeCalledWith(helper);
      });

      it("should rollback", async () => {
        const helper = new MigrationHelper(1, mock(), mock(), "general", clientType);
        const spy = jest.spyOn(rollback_migrator, "rollback");
        await sut.migrate(helper);
        expect(spy).toBeCalledWith(helper);
      });

      it("should update version on migrate", async () => {
        const helper = new MigrationHelper(0, mock(), mock(), "general", clientType);
        const spy = jest.spyOn(migrator, "updateVersion");
        await sut.migrate(helper);
        expect(spy).toBeCalledWith(helper, "up");
      });

      it("should update version on rollback", async () => {
        const helper = new MigrationHelper(1, mock(), mock(), "general", clientType);
        const spy = jest.spyOn(rollback_migrator, "updateVersion");
        await sut.migrate(helper);
        expect(spy).toBeCalledWith(helper, "down");
      });

      it("should not run the migrator if the current version does not match the from version", async () => {
        const helper = new MigrationHelper(3, mock(), mock(), "general", clientType);
        const migrate = jest.spyOn(migrator, "migrate");
        const rollback = jest.spyOn(rollback_migrator, "rollback");
        await sut.migrate(helper);
        expect(migrate).not.toBeCalled();
        expect(rollback).not.toBeCalled();
      });

      it("should not update version if the current version does not match the from version", async () => {
        const helper = new MigrationHelper(3, mock(), mock(), "general", clientType);
        const migrate = jest.spyOn(migrator, "updateVersion");
        const rollback = jest.spyOn(rollback_migrator, "updateVersion");
        await sut.migrate(helper);
        expect(migrate).not.toBeCalled();
        expect(rollback).not.toBeCalled();
      });
    });

    it("should be able to call instance methods", async () => {
      const helper = new MigrationHelper(0, mock(), mock(), "general", clientType);
      await sut.with(TestMigratorWithInstanceMethod, 0, 1).migrate(helper);
    });
  });
});
