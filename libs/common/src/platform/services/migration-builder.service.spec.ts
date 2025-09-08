import { mock } from "jest-mock-extended";

import { MigrationHelper } from "@bitwarden/state";

import { FakeStorageService } from "../../../spec/fake-storage.service";
import { ClientType } from "../../enums";

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

  const startingStates = [
    { data: noAccounts, description: "No Accounts" },
    { data: nullAndUndefinedAccounts, description: "Null and Undefined Accounts" },
    { data: emptyAccountObject, description: "Empty Account Object" },
    { data: nullCommonAccountProperties, description: "Null Common Account Properties" },
    { data: emptyCommonAccountProperties, description: "Empty Common Account Properties" },
    { data: nullGlobal, description: "Null Global" },
    { data: undefinedGlobal, description: "Undefined Global" },
    { data: emptyGlobalObject, description: "Empty Global Object" },
  ];

  const clientTypes = Object.values(ClientType);

  // Generate all possible test cases
  const testCases = startingStates.flatMap((startingState) =>
    clientTypes.map((clientType) => ({ startingState, clientType })),
  );

  it.each(testCases)(
    "should not produce migrations that throw when given $startingState.description for client $clientType",
    async ({ startingState, clientType }) => {
      const sut = new MigrationBuilderService();

      const helper = new MigrationHelper(
        startingStateVersion,
        new FakeStorageService(startingState),
        mock(),
        "general",
        clientType,
      );

      await sut.build().migrate(helper);
    },
  );
});
