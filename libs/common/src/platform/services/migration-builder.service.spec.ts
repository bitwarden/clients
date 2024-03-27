import { mock } from "jest-mock-extended";

import { FakeStorageService } from "../../../spec/fake-storage.service";
import { MigrationHelper } from "../../state-migrations/migration-helper";

import { MigrationBuilderService } from "./migration-builder.service";

describe("MigrationBuilderService", () => {
  // All migrations from 10+ should be capable of having a null account object or null global object
  const startingStateVersion = 10;

  const noAccounts = {
    stateVersion: startingStateVersion,
    authenticatedAccounts: <string[]>[],
  };

  const nullAndUndefinedAccounts = {
    stateVersion: startingStateVersion,
    authenticatedAccounts: ["account1", "account2"],
    account1: <object>null,
    account2: <object>undefined,
  };

  const emptyAccountObject = {
    stateVersion: startingStateVersion,
    authenticatedAccounts: ["account1"],
    account1: {},
  };

  const nullCommonAccountProperties = {
    stateVersion: startingStateVersion,
    authenticatedAccounts: ["account1"],
    account1: {
      data: <object>null,
      keys: <object>null,
      profile: <object>null,
      settings: <object>null,
      tokens: <object>null,
    },
  };

  const emptyCommonAccountProperties = {
    stateVersion: startingStateVersion,
    authenticatedAccounts: ["account1"],
    account1: {
      data: {},
      keys: {},
      profile: {},
      settings: {},
      tokens: {},
    },
  };

  const nullGlobal = {
    stateVersion: startingStateVersion,
    global: <object>null,
  };

  const undefinedGlobal = {
    stateVersion: startingStateVersion,
    global: <object>undefined,
  };

  const emptyGlobalObject = {
    stateVersion: startingStateVersion,
    global: {},
  };

  it.each([
    noAccounts,
    nullAndUndefinedAccounts,
    emptyAccountObject,
    nullCommonAccountProperties,
    emptyCommonAccountProperties,
    nullGlobal,
    undefinedGlobal,
    emptyGlobalObject,
  ])("should not produce migrations that throw when given data: %s", async (startingState) => {
    const sut = new MigrationBuilderService();

    const helper = new MigrationHelper(
      startingStateVersion,
      new FakeStorageService(startingState),
      mock(),
      "general",
    );

    await sut.build().migrate(helper);
  });
});
