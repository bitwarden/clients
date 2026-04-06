import { MockProxy } from "jest-mock-extended";

import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import { MoveStateVersionMigrator } from "./8-move-state-version";

function migrateExampleJSON() {
  return {
    global: {
      stateVersion: 6,
      otherStuff: "otherStuff1",
    },
    otherStuff: "otherStuff2",
  };
}

function rollbackExampleJSON() {
  return {
    global: {
      otherStuff: "otherStuff1",
    },
    stateVersion: 7,
    otherStuff: "otherStuff2",
  };
}

describe("moveStateVersion", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: MoveStateVersionMigrator;

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(migrateExampleJSON());
      sut = new MoveStateVersionMigrator(7, 8);
    });

    it("should move state version to root", async () => {
      await sut.migrate(helper);
      expect(helper.set).toHaveBeenCalledWith("stateVersion", 6);
    });

    it("should remove state version from global", async () => {
      await sut.migrate(helper);
      expect(helper.set).toHaveBeenCalledWith("global", {
        otherStuff: "otherStuff1",
      });
    });

    it("should throw if state version not found", async () => {
      helper.get.mockReturnValue({ otherStuff: "otherStuff1" } as any);
      await expect(sut.migrate(helper)).rejects.toThrow(
        "Migration failed, state version not found",
      );
    });

    it("should update version up", async () => {
      await sut.updateVersion(helper, "up");

      expect(helper.set).toHaveBeenCalledTimes(1);
      expect(helper.set).toHaveBeenCalledWith("stateVersion", 8);
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackExampleJSON());
      sut = new MoveStateVersionMigrator(7, 8);
    });

    it("should move state version to global", async () => {
      await sut.rollback(helper);
      expect(helper.set).toHaveBeenCalledWith("global", {
        stateVersion: 7,
        otherStuff: "otherStuff1",
      });
      expect(helper.set).toHaveBeenCalledWith("stateVersion", undefined);
    });

    it("should update version down", async () => {
      await sut.updateVersion(helper, "down");

      expect(helper.set).toHaveBeenCalledTimes(1);
      expect(helper.set).toHaveBeenCalledWith("global", {
        stateVersion: 7,
        otherStuff: "otherStuff1",
      });
    });
  });
});
