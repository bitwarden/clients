import { runMigrator } from "../migration-helper.spec";

import { MoveLastSyncDate } from "./68-move-last-sync-date";

describe("MoveLastSyncDate", () => {
  const sut = new MoveLastSyncDate(67, 68);
  it("migrates data", async () => {
    const output = await runMigrator(sut, {
      global_account_accounts: {
        user1: null,
        user2: null,
        user3: null,
        user4: null,
        user5: null,
      },
      user1: {
        profile: {
          lastSync: "2024-07-24T14:27:25.703Z",
        },
      },
      user2: {},
      user3: { profile: null },
      user4: { profile: {} },
      user5: { profile: { lastSync: null } },
    });

    expect(output).toEqual({
      global_account_accounts: {
        user1: null,
        user2: null,
        user3: null,
        user4: null,
        user5: null,
      },
      user1: {
        profile: {},
      },
      user2: {},
      user3: { profile: null },
      user4: { profile: {} },
      user5: { profile: { lastSync: null } },
      user_user1_sync_lastSync: "2024-07-24T14:27:25.703Z",
    });
  });

  it("rolls back data", async () => {
    const output = await runMigrator(
      sut,
      {
        global_account_accounts: {
          user1: null,
          user2: null,
          user3: null,
          user4: null,
          user5: null,
        },
        user1: {
          profile: {
            extraProperty: "hello",
          },
        },
        user2: {},
        user3: { profile: null },
        user4: { profile: {} },
        user5: { profile: { lastSync: null } },
        user_user1_sync_lastSync: "2024-07-24T14:27:25.703Z",
      },
      "rollback",
    );

    expect(output).toEqual({
      global_account_accounts: {
        user1: null,
        user2: null,
        user3: null,
        user4: null,
        user5: null,
      },
      user1: {
        profile: {
          lastSync: "2024-07-24T14:27:25.703Z",
          extraProperty: "hello",
        },
      },
      user2: {},
      user3: { profile: null },
      user4: { profile: {} },
      user5: { profile: { lastSync: null } },
    });
  });
});
