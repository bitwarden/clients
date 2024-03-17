import { any, MockProxy } from "jest-mock-extended";

import { StateDefinitionLike, MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import { DomainSettingsMigrator } from "./34-move-domain-settings-to-state-providers";

const mockNeverDomains = { "bitwarden.test": null, locahost: null, "www.example.com": null } as {
  [key: string]: null;
};

function exampleJSON() {
  return {
    global: {
      otherStuff: "otherStuff1",
      neverDomains: mockNeverDomains,
    },
    authenticatedAccounts: ["user-1", "user-2", "user-3"],
    "user-1": {
      settings: {
        defaultUriMatch: 3,
        settings: {
          equivalentDomains: [] as string[][],
        },
        otherStuff: "otherStuff2",
      },
      otherStuff: "otherStuff3",
    },
    "user-2": {
      settings: {
        settings: {
          equivalentDomains: [["apple.com", "icloud.com"]],
        },
        otherStuff: "otherStuff4",
      },
      otherStuff: "otherStuff5",
    },
    "user-3": {
      settings: {
        defaultUriMatch: 1,
        otherStuff: "otherStuff6",
      },
      otherStuff: "otherStuff7",
    },
    "user-4": {
      settings: {
        otherStuff: "otherStuff8",
      },
      otherStuff: "otherStuff9",
    },
  };
}

function rollbackJSON() {
  return {
    global_domainSettings_neverDomains: mockNeverDomains,
    "user_user-1_domainSettings_defaultUriMatchStrategy": 3,
    "user_user-1_domainSettings_equivalentDomains": [] as string[][],
    "user_user-2_domainSettings_equivalentDomains": [["apple.com", "icloud.com"]],
    "user_user-3_domainSettings_defaultUriMatchStrategy": 1,
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user-1", "user-2", "user-3"],
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
    "user-3": {
      settings: {
        otherStuff: "otherStuff6",
      },
      otherStuff: "otherStuff7",
    },
    "user-4": {
      settings: {
        otherStuff: "otherStuff8",
      },
      otherStuff: "otherStuff9",
    },
  };
}

const domainSettingsStateDefinition: {
  stateDefinition: StateDefinitionLike;
} = {
  stateDefinition: {
    name: "domainSettings",
  },
};

describe("DomainSettingsMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: DomainSettingsMigrator;

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(exampleJSON(), 33);
      sut = new DomainSettingsMigrator(33, 34);
    });

    it("should remove global neverDomains and defaultUriMatch and equivalentDomains settings from all accounts", async () => {
      await sut.migrate(helper);
      expect(helper.set).toHaveBeenCalledTimes(4);
      expect(helper.set).toHaveBeenCalledWith("global", {
        otherStuff: "otherStuff1",
      });
      expect(helper.set).toHaveBeenCalledWith("user-1", {
        settings: {
          otherStuff: "otherStuff2",
        },
        otherStuff: "otherStuff3",
      });
      expect(helper.set).toHaveBeenCalledWith("user-1", {
        settings: {
          otherStuff: "otherStuff2",
        },
        otherStuff: "otherStuff3",
      });
      expect(helper.set).toHaveBeenCalledWith("user-2", {
        settings: {
          otherStuff: "otherStuff4",
        },
        otherStuff: "otherStuff5",
      });
      expect(helper.set).toHaveBeenCalledWith("user-3", {
        settings: {
          otherStuff: "otherStuff6",
        },
        otherStuff: "otherStuff7",
      });
    });

    it("should set global neverDomains and defaultUriMatchStrategy and equivalentDomains setting values for each account", async () => {
      await sut.migrate(helper);

      expect(helper.setToGlobal).toHaveBeenCalledTimes(1);
      expect(helper.setToGlobal).toHaveBeenCalledWith(
        { ...domainSettingsStateDefinition, key: "neverDomains" },
        mockNeverDomains,
      );

      expect(helper.setToUser).toHaveBeenCalledTimes(4);
      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-1",
        { ...domainSettingsStateDefinition, key: "defaultUriMatchStrategy" },
        3,
      );
      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-1",
        { ...domainSettingsStateDefinition, key: "equivalentDomains" },
        [],
      );
      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-2",
        { ...domainSettingsStateDefinition, key: "equivalentDomains" },
        [["apple.com", "icloud.com"]],
      );
      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-3",
        { ...domainSettingsStateDefinition, key: "defaultUriMatchStrategy" },
        1,
      );
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 34);
      sut = new DomainSettingsMigrator(33, 34);
    });

    it("should null out new values globally and for each account", async () => {
      await sut.rollback(helper);

      expect(helper.setToGlobal).toHaveBeenCalledTimes(1);
      expect(helper.setToGlobal).toHaveBeenCalledWith(
        { ...domainSettingsStateDefinition, key: "neverDomains" },
        null,
      );

      expect(helper.setToUser).toHaveBeenCalledTimes(4);
      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-1",
        { ...domainSettingsStateDefinition, key: "defaultUriMatchStrategy" },
        null,
      );
      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-1",
        { ...domainSettingsStateDefinition, key: "equivalentDomains" },
        null,
      );
      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-2",
        { ...domainSettingsStateDefinition, key: "equivalentDomains" },
        null,
      );
      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-3",
        { ...domainSettingsStateDefinition, key: "defaultUriMatchStrategy" },
        null,
      );
    });

    it("should add explicit value back to accounts", async () => {
      await sut.rollback(helper);

      expect(helper.set).toHaveBeenCalledTimes(4);
      expect(helper.set).toHaveBeenCalledWith("global", {
        neverDomains: mockNeverDomains,
        otherStuff: "otherStuff1",
      });
      expect(helper.set).toHaveBeenCalledWith("user-1", {
        settings: {
          defaultUriMatch: 3,
          settings: {
            equivalentDomains: [] as string[][],
          },
          otherStuff: "otherStuff2",
        },
        otherStuff: "otherStuff3",
      });
      expect(helper.set).toHaveBeenCalledWith("user-2", {
        settings: {
          settings: {
            equivalentDomains: [["apple.com", "icloud.com"]],
          },
          otherStuff: "otherStuff4",
        },
        otherStuff: "otherStuff5",
      });
      expect(helper.set).toHaveBeenCalledWith("user-3", {
        settings: {
          defaultUriMatch: 1,
          otherStuff: "otherStuff6",
        },
        otherStuff: "otherStuff7",
      });
    });

    it("should not try to restore values to missing accounts", async () => {
      await sut.rollback(helper);

      expect(helper.set).not.toHaveBeenCalledWith("user-4", any());
    });
  });
});
