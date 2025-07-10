import { MockProxy } from "jest-mock-extended";

import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import { EnableFaviconMigrator } from "./42-move-enable-favicon-to-domain-settings-state-provider";

function exampleJSON() {
  return {
    global: {
      otherStuff: "otherStuff1",
      disableFavicon: true,
    },
    authenticatedAccounts: ["user-1", "user-2"],
    "user-1": {
      settings: {
        otherStuff: "otherStuff2",
      },
      otherStuff: "otherStuff3",
    },
    "user-2": {
      settings: {
        otherStuff: "otherStuff4",
      },
      otherStuff: "otherStuff5",
    },
  };
}

function rollbackJSON() {
  return {
    global_domainSettings_showFavicons: false,
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user-1", "user-2"],
    "user-1": {
      settings: {
        otherStuff: "otherStuff2",
      },
      otherStuff: "otherStuff3",
    },
    "user-2": {
      settings: {
        otherStuff: "otherStuff4",
      },
      otherStuff: "otherStuff5",
    },
  };
}

const showFaviconsKeyDefinition: KeyDefinitionLike = {
  stateDefinition: {
    name: "domainSettings",
  },
  key: "showFavicons",
};

describe("EnableFaviconMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: EnableFaviconMigrator;

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(exampleJSON(), 41);
      sut = new EnableFaviconMigrator(41, 42);
    });

    it("should remove global disableFavicon", async () => {
      await sut.migrate(helper);
      expect(helper.set).toHaveBeenCalledTimes(1);
      expect(helper.set).toHaveBeenCalledWith("global", {
        otherStuff: "otherStuff1",
      });
    });

    it("should set global showFavicons", async () => {
      await sut.migrate(helper);

      expect(helper.setToGlobal).toHaveBeenCalledTimes(1);
      expect(helper.setToGlobal).toHaveBeenCalledWith(showFaviconsKeyDefinition, false);
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 42);
      sut = new EnableFaviconMigrator(41, 42);
    });

    it("should null global showFavicons", async () => {
      await sut.rollback(helper);

      expect(helper.setToGlobal).toHaveBeenCalledTimes(1);
      expect(helper.setToGlobal).toHaveBeenCalledWith(showFaviconsKeyDefinition, null);
    });

    it("should add global disableFavicon back", async () => {
      await sut.rollback(helper);

      expect(helper.set).toHaveBeenCalledTimes(1);
      expect(helper.set).toHaveBeenCalledWith("global", {
        disableFavicon: true,
        otherStuff: "otherStuff1",
      });
    });
  });
});
