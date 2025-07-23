import { MockProxy } from "jest-mock-extended";

import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper, runMigrator } from "../migration-helper.spec";

import { RememberedEmailMigrator } from "./51-move-remembered-email-to-state-providers";

function rollbackJSON() {
  return {
    global: {
      extra: "data",
    },
    global_loginEmail_storedEmail: "user@example.com",
  };
}

describe("RememberedEmailMigrator", () => {
  const migrator = new RememberedEmailMigrator(50, 51);

  describe("migrate", () => {
    it("should migrate the rememberedEmail property from the legacy global object to a global StorageKey as 'global_loginEmail_storedEmail'", async () => {
      const output = await runMigrator(migrator, {
        global: {
          rememberedEmail: "user@example.com",
          extra: "data", // Represents a global property that should persist after migration
        },
      });

      expect(output).toEqual({
        global: {
          extra: "data",
        },
        global_loginEmail_storedEmail: "user@example.com",
      });
    });

    it("should remove the rememberedEmail property from the legacy global object", async () => {
      const output = await runMigrator(migrator, {
        global: {
          rememberedEmail: "user@example.com",
        },
      });

      expect(output.global).not.toHaveProperty("rememberedEmail");
    });
  });

  describe("rollback", () => {
    let helper: MockProxy<MigrationHelper>;
    let sut: RememberedEmailMigrator;

    const keyDefinitionLike = {
      key: "storedEmail",
      stateDefinition: {
        name: "loginEmail",
      },
    };

    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 51);
      sut = new RememberedEmailMigrator(50, 51);
    });

    it("should null out the storedEmail global StorageKey", async () => {
      await sut.rollback(helper);

      expect(helper.setToGlobal).toHaveBeenCalledTimes(1);
      expect(helper.setToGlobal).toHaveBeenCalledWith(keyDefinitionLike, null);
    });

    it("should add the rememberedEmail property back to legacy global object", async () => {
      await sut.rollback(helper);

      expect(helper.set).toHaveBeenCalledTimes(1);
      expect(helper.set).toHaveBeenCalledWith("global", {
        rememberedEmail: "user@example.com",
        extra: "data",
      });
    });
  });
});
