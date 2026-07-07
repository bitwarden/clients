import { mock, MockProxy } from "jest-mock-extended";

import { ClientType } from "@bitwarden/client-type";
import { LogService } from "@bitwarden/logging";
import { AbstractStorageService } from "@bitwarden/storage-core";

import { MigrationHelper } from "./migration-helper";
import { Migrator } from "./migrator";

describe("migrator default methods", () => {
  class TestMigrator extends Migrator<0, 1> {
    async migrate(helper: MigrationHelper): Promise<void> {
      await helper.set("test", "test");
    }
    async rollback(helper: MigrationHelper): Promise<void> {
      await helper.set("test", "rollback");
    }
  }

  let storage: MockProxy<AbstractStorageService>;
  let logService: MockProxy<LogService>;
  let helper: MigrationHelper;
  let sut: TestMigrator;

  const clientTypes = Object.values(ClientType);

  describe.each(clientTypes)("for client %s", (clientType) => {
    beforeEach(() => {
      storage = mock();
      logService = mock();
      helper = new MigrationHelper(0, storage, logService, "general", clientType);
      sut = new TestMigrator(0, 1);
    });

    describe("shouldMigrate", () => {
      describe("up", () => {
        it("should return true if the current version equals the from version", async () => {
          expect(await sut.shouldMigrate(helper, "up")).toBe(true);
        });

        it("should return false if the current version does not equal the from version", async () => {
          helper.currentVersion = 1;
          expect(await sut.shouldMigrate(helper, "up")).toBe(false);
        });
      });

      describe("down", () => {
        it("should return true if the current version equals the to version", async () => {
          helper.currentVersion = 1;
          expect(await sut.shouldMigrate(helper, "down")).toBe(true);
        });

        it("should return false if the current version does not equal the to version", async () => {
          expect(await sut.shouldMigrate(helper, "down")).toBe(false);
        });
      });
    });

    describe("updateVersion", () => {
      describe("up", () => {
        it("should update the version", async () => {
          await sut.updateVersion(helper, "up");
          expect(storage.save).toHaveBeenCalledWith("stateVersion", 1);
          expect(helper.currentVersion).toBe(1);
        });
      });

      describe("down", () => {
        it("should update the version", async () => {
          helper.currentVersion = 1;
          await sut.updateVersion(helper, "down");
          expect(storage.save).toHaveBeenCalledWith("stateVersion", 0);
          expect(helper.currentVersion).toBe(0);
        });
      });
    });
  });
});
