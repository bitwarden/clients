import { MockProxy } from "jest-mock-extended";

import { MIN_VERSION } from "../migrate";
import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import { MinVersionMigrator } from "./min-version";

describe("MinVersionMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: MinVersionMigrator;

  beforeEach(() => {
    helper = mockMigrationHelper(null);
    sut = new MinVersionMigrator();
  });

  describe("shouldMigrate", () => {
    it("should return true if current version is less than min version", async () => {
      helper.currentVersion = MIN_VERSION - 1;
      expect(await sut.shouldMigrate(helper)).toBe(true);
    });

    it("should return false if current version is greater than min version", async () => {
      helper.currentVersion = MIN_VERSION + 1;
      expect(await sut.shouldMigrate(helper)).toBe(false);
    });
  });
});
