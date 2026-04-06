import { MockProxy, any } from "jest-mock-extended";

import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import { SmOnboardingTasksMigrator } from "./24-move-sm-onboarding-key-to-state-providers";

function exampleJSON() {
  return {
    authenticatedAccounts: ["user-1", "user-2", "user-3"],
    "user-1": {
      settings: {
        smOnboardingTasks: {
          "0bd005de-c722-473b-a00c-b10101006fcd": {
            createProject: true,
            createSecret: true,
            createServiceAccount: true,
            importSecrets: true,
          },
          "2f0d26ec-493a-4ed7-9183-b10d013597c8": {
            createProject: false,
            createSecret: true,
            createServiceAccount: false,
            importSecrets: true,
          },
        },
        someOtherProperty: "Some other value",
      },
      otherStuff: "otherStuff",
    },
    "user-2": {
      settings: {
        smOnboardingTasks: {
          "000000-0000000-0000000-000000000": {
            createProject: false,
            createSecret: false,
            createServiceAccount: false,
            importSecrets: false,
          },
        },
        someOtherProperty: "Some other value",
      },
      otherStuff: "otherStuff",
    },
  };
}

function rollbackJSON() {
  return {
    "user_user-1_smOnboarding_tasks": {
      "0bd005de-c722-473b-a00c-b10101006fcd": {
        createProject: true,
        createSecret: true,
        createServiceAccount: true,
        importSecrets: true,
      },
      "2f0d26ec-493a-4ed7-9183-b10d013597c8": {
        createProject: false,
        createSecret: true,
        createServiceAccount: false,
        importSecrets: true,
      },
    },
    "user_user-2_smOnboarding_tasks": {
      "000000-0000000-0000000-000000000": {
        createProject: false,
        createSecret: false,
        createServiceAccount: false,
        importSecrets: false,
      },
    },
    authenticatedAccounts: ["user-1", "user-2"],
    "user-1": {
      settings: {
        someOtherProperty: "Some other value",
      },
      otherStuff: "otherStuff",
    },
    "user-2": {
      settings: {
        someOtherProperty: "Some other value",
      },
      otherStuff: "otherStuff",
    },
  };
}

describe("SmOnboardingTasksMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: SmOnboardingTasksMigrator;

  const keyDefinitionLike = {
    key: "tasks",
    stateDefinition: { name: "smOnboarding" },
  };

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(exampleJSON(), 23);
      sut = new SmOnboardingTasksMigrator(23, 24);
    });

    it("should remove smOnboardingTasks from all accounts", async () => {
      await sut.migrate(helper);
      expect(helper.set).toHaveBeenCalledWith("user-1", {
        settings: {
          someOtherProperty: "Some other value",
        },
        otherStuff: "otherStuff",
      });
    });

    it("should set smOnboardingTasks provider value for each account", async () => {
      await sut.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledWith("user-1", keyDefinitionLike, {
        "0bd005de-c722-473b-a00c-b10101006fcd": {
          createProject: true,
          createSecret: true,
          createServiceAccount: true,
          importSecrets: true,
        },
        "2f0d26ec-493a-4ed7-9183-b10d013597c8": {
          createProject: false,
          createSecret: true,
          createServiceAccount: false,
          importSecrets: true,
        },
      });

      expect(helper.setToUser).toHaveBeenCalledWith("user-2", keyDefinitionLike, {
        "000000-0000000-0000000-000000000": {
          createProject: false,
          createSecret: false,
          createServiceAccount: false,
          importSecrets: false,
        },
      });
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 24);
      sut = new SmOnboardingTasksMigrator(23, 24);
    });

    it.each(["user-1", "user-2"])("should null out new values", async (userId) => {
      await sut.rollback(helper);

      expect(helper.setToUser).toHaveBeenCalledWith(userId, keyDefinitionLike, null);
    });

    it("should add smOnboardingTasks back to accounts", async () => {
      await sut.rollback(helper);

      expect(helper.set).toHaveBeenCalledWith("user-1", {
        settings: {
          smOnboardingTasks: {
            "0bd005de-c722-473b-a00c-b10101006fcd": {
              createProject: true,
              createSecret: true,
              createServiceAccount: true,
              importSecrets: true,
            },
            "2f0d26ec-493a-4ed7-9183-b10d013597c8": {
              createProject: false,
              createSecret: true,
              createServiceAccount: false,
              importSecrets: true,
            },
          },
          someOtherProperty: "Some other value",
        },
        otherStuff: "otherStuff",
      });

      expect(helper.set).toHaveBeenCalledWith("user-2", {
        settings: {
          smOnboardingTasks: {
            "000000-0000000-0000000-000000000": {
              createProject: false,
              createSecret: false,
              createServiceAccount: false,
              importSecrets: false,
            },
          },
          someOtherProperty: "Some other value",
        },
        otherStuff: "otherStuff",
      });
    });

    it("should not try to restore values to missing accounts", async () => {
      await sut.rollback(helper);

      expect(helper.set).not.toHaveBeenCalledWith("user-3", any());
    });
  });
});
