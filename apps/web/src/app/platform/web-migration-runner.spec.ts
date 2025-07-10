// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { MockProxy, mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import { MigrationBuilderService } from "@bitwarden/common/platform/services/migration-builder.service";
import { WindowStorageService } from "@bitwarden/common/platform/storage/window-storage.service";
import { MigrationBuilder } from "@bitwarden/common/state-migrations/migration-builder";
import { MigrationHelper } from "@bitwarden/common/state-migrations/migration-helper";

import { WebMigrationRunner } from "./web-migration-runner";

describe("WebMigrationRunner", () => {
  let logService: MockProxy<LogService>;
  let sessionStorageService: MockProxy<AbstractStorageService>;
  let localStorageService: MockProxy<WindowStorageService>;
  let migrationBuilderService: MockProxy<MigrationBuilderService>;

  let sut: WebMigrationRunner;

  beforeEach(() => {
    logService = mock();
    sessionStorageService = mock();
    localStorageService = mock();
    migrationBuilderService = mock();

    sut = new WebMigrationRunner(
      sessionStorageService,
      logService,
      migrationBuilderService,
      localStorageService,
    );
  });

  const mockMigrationBuilder = (migration: (helper: MigrationHelper) => Promise<void>) => {
    migrationBuilderService.build.mockReturnValue({
      migrate: async (helper: MigrationHelper) => {
        await migration(helper);
      },
      with: () => {
        throw new Error("Don't use this in tests.");
      },
      rollback: () => {
        throw new Error("Don't use this in tests.");
      },
    } as unknown as MigrationBuilder);
  };

  const mockGet = (
    mockStorage: MockProxy<AbstractStorageService>,
    data: Record<string, unknown>,
  ) => {
    mockStorage.get.mockImplementation((key) => {
      return Promise.resolve(data[key]);
    });
  };

  it("should run migration for both storage locations", async () => {
    mockGet(sessionStorageService, {
      stateVersion: 4,
    });
    mockGet(localStorageService, {});

    mockMigrationBuilder(async (helper) => {
      await helper.set("something", "something");
    });

    await sut.run();

    expect(sessionStorageService.save).toHaveBeenCalledWith("something", "something");
    expect(localStorageService.save).toHaveBeenCalledWith("something", "something");
  });

  it("should only migrate data in one migration if written defensively", async () => {
    mockGet(sessionStorageService, {
      stateVersion: 4,
    });
    mockGet(localStorageService, {
      user1: {
        settings: {
          myData: "value",
        },
      },
    });

    mockMigrationBuilder(async (helper) => {
      const account = await helper.get<{ settings?: { myData?: string } }>("user1");
      const value = account?.settings?.myData;
      if (value) {
        await helper.setToUser("user1", { key: "key", stateDefinition: { name: "state" } }, value);
      }
    });

    await sut.run();

    expect(sessionStorageService.save).not.toHaveBeenCalled();
    expect(localStorageService.save).toHaveBeenCalledWith("user_user1_state_key", "value");
  });

  it("should gather accounts differently", async () => {
    mockGet(sessionStorageService, {
      stateVersion: 10,
      authenticatedAccounts: ["sessionUser1", "sessionUser2"],
      sessionUser1: {
        data: 1,
      },
      sessionUser2: {
        data: null,
      },
      sessionUser3: {
        // User does NOT have authenticated accounts entry
        data: 3,
      },
    });

    const localStorageObject = {
      "8118af89-a621-4b0f-8dd2-4449569e5067": {
        data: 4,
      },
      "cc202dba-55f8-4cbe-8c66-de37e48e7827": {
        data: <number>null,
      },
      otherThing: {
        data: 6,
      },
      "badd2aff-a380-468f-855a-e476557055d5": <object>null,
      "01f81ccd-fb18-460c-9a6b-811ef5300d4b": 3,
    };

    mockGet(localStorageService, localStorageObject);
    localStorageService.getKeys.mockReturnValue(Object.keys(localStorageObject));

    mockMigrationBuilder(async (helper) => {
      type ExpectedAccountType = {
        data?: number;
      };
      async function migrateAccount(userId: string, account: ExpectedAccountType) {
        const value = account?.data;
        if (value != null) {
          await helper.setToUser(userId, { key: "key", stateDefinition: { name: "state" } }, value);
          delete account.data;
          await helper.set(userId, account);
        }
      }

      const accounts = await helper.getAccounts();
      await Promise.all(accounts.map(({ userId, account }) => migrateAccount(userId, account)));
    });

    await sut.run();

    // Session storage has two users but only one with data
    expect(sessionStorageService.save).toHaveBeenCalledTimes(2);
    // Should move the data to the new location first
    expect(sessionStorageService.save).toHaveBeenNthCalledWith(1, "user_sessionUser1_state_key", 1);
    // Should then delete the migrated data and resave object
    expect(sessionStorageService.save).toHaveBeenNthCalledWith(2, "sessionUser1", {});

    expect(sessionStorageService.get).toHaveBeenCalledTimes(4);
    // Should first get the state version so it knowns which migrations to run (not really used in this test)
    expect(sessionStorageService.get).toHaveBeenNthCalledWith(1, "stateVersion");
    // "base" migration runner should trust the authenticatedAccounts stored value for knowing which accounts to migrate
    expect(sessionStorageService.get).toHaveBeenNthCalledWith(2, "authenticatedAccounts");
    // Should get the data for each user
    expect(sessionStorageService.get).toHaveBeenNthCalledWith(3, "sessionUser1");
    expect(sessionStorageService.get).toHaveBeenNthCalledWith(4, "sessionUser2");

    expect(localStorageService.save).toHaveBeenCalledTimes(2);
    // Should migrate data for a user in local storage
    expect(localStorageService.save).toHaveBeenNthCalledWith(
      1,
      "user_8118af89-a621-4b0f-8dd2-4449569e5067_state_key",
      4,
    );
    // Should update object with migrated data deleted
    expect(localStorageService.save).toHaveBeenNthCalledWith(
      2,
      "8118af89-a621-4b0f-8dd2-4449569e5067",
      {},
    );

    expect(localStorageService.get).toHaveBeenCalledTimes(5);
    expect(localStorageService.get).toHaveBeenNthCalledWith(1, "stateVersion");
    expect(localStorageService.get).toHaveBeenNthCalledWith(
      2,
      "8118af89-a621-4b0f-8dd2-4449569e5067",
    );
    expect(localStorageService.get).toHaveBeenNthCalledWith(
      3,
      "cc202dba-55f8-4cbe-8c66-de37e48e7827",
    );
    expect(localStorageService.get).toHaveBeenNthCalledWith(
      4,
      "badd2aff-a380-468f-855a-e476557055d5",
    );
    expect(localStorageService.get).toHaveBeenNthCalledWith(
      5,
      "01f81ccd-fb18-460c-9a6b-811ef5300d4b",
    );
  });

  it("should default currentVersion to 12 if no stateVersion exists", async () => {
    mockGet(sessionStorageService, {
      stateVersion: 14,
    });
    mockGet(localStorageService, {});

    let runCount = 0;

    mockMigrationBuilder(async (helper) => {
      if (runCount === 0) {
        // This should be the session storage run
        expect(helper.currentVersion).toBe(14);
      } else if (runCount === 1) {
        // This should be the local storage run, and it should be the default version
        expect(helper.currentVersion).toBe(12);
      } else {
        throw new Error("Should not have been called more than twice");
      }

      runCount++;
    });

    await sut.run();
  });

  it("should respect local storage stateVersion", async () => {
    mockGet(sessionStorageService, {
      stateVersion: 14,
    });
    mockGet(localStorageService, {
      stateVersion: 18,
    });

    let runCount = 0;

    mockMigrationBuilder(async (helper) => {
      if (runCount === 0) {
        // This should be the session storage run
        expect(helper.currentVersion).toBe(14);
      } else if (runCount === 1) {
        // This should be the local storage run, and it should be the default version
        expect(helper.currentVersion).toBe(18);
      } else {
        throw new Error("Should not have been called more than twice");
      }

      runCount++;
    });

    await sut.run();
  });
});
