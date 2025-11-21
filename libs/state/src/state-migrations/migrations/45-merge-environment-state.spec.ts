import { runMigrator } from "../migration-helper.spec";

import { MergeEnvironmentState } from "./45-merge-environment-state";

describe("MergeEnvironmentState", () => {
  const migrator = new MergeEnvironmentState(44, 45);

  it("can migrate all data", async () => {
    const output = await runMigrator(migrator, {
      authenticatedAccounts: ["user1", "user2"],
      global: {
        extra: "data",
      },
      global_environment_region: "US",
      global_environment_urls: {
        base: "example.com",
      },
      user1: {
        extra: "data",
        settings: {
          extra: "data",
        },
      },
      user2: {
        extra: "data",
        settings: {
          extra: "data",
        },
      },
      extra: "data",
      user_user1_environment_region: "US",
      user_user2_environment_region: "EU",
      user_user1_environment_urls: {
        base: "example.com",
      },
      user_user2_environment_urls: {
        base: "other.example.com",
      },
    });

    expect(output).toEqual({
      authenticatedAccounts: ["user1", "user2"],
      global: {
        extra: "data",
      },
      global_environment_environment: {
        region: "US",
        urls: {
          base: "example.com",
        },
      },
      user1: {
        extra: "data",
        settings: {
          extra: "data",
        },
      },
      user2: {
        extra: "data",
        settings: {
          extra: "data",
        },
      },
      extra: "data",
      user_user1_environment_environment: {
        region: "US",
        urls: {
          base: "example.com",
        },
      },
      user_user2_environment_environment: {
        region: "EU",
        urls: {
          base: "other.example.com",
        },
      },
    });
  });

  it("handles missing parts", async () => {
    const output = await runMigrator(migrator, {
      authenticatedAccounts: ["user1", "user2"],
      global: {
        extra: "data",
      },
      user1: {
        extra: "data",
        settings: {
          extra: "data",
        },
      },
      user2: null,
    });

    expect(output).toEqual({
      authenticatedAccounts: ["user1", "user2"],
      global: {
        extra: "data",
      },
      user1: {
        extra: "data",
        settings: {
          extra: "data",
        },
      },
      user2: null,
    });
  });

  it("can migrate only global data", async () => {
    const output = await runMigrator(migrator, {
      authenticatedAccounts: [],
      global_environment_region: "Self-Hosted",
      global: {},
    });

    expect(output).toEqual({
      authenticatedAccounts: [],
      global_environment_environment: {
        region: "Self-Hosted",
        urls: undefined,
      },
      global: {},
    });
  });

  it("can migrate only user state", async () => {
    const output = await runMigrator(migrator, {
      authenticatedAccounts: ["user1"] as const,
      global: null,
      user1: { settings: {} },
      user_user1_environment_region: "Self-Hosted",
      user_user1_environment_urls: {
        base: "some-base-url",
        api: "some-api-url",
        identity: "some-identity-url",
        icons: "some-icons-url",
        notifications: "some-notifications-url",
        events: "some-events-url",
        webVault: "some-webVault-url",
        keyConnector: "some-keyConnector-url",
      },
    });

    expect(output).toEqual({
      authenticatedAccounts: ["user1"] as const,
      global: null,
      user1: { settings: {} },
      user_user1_environment_environment: {
        region: "Self-Hosted",
        urls: {
          base: "some-base-url",
          api: "some-api-url",
          identity: "some-identity-url",
          icons: "some-icons-url",
          notifications: "some-notifications-url",
          events: "some-events-url",
          webVault: "some-webVault-url",
          keyConnector: "some-keyConnector-url",
        },
      },
    });
  });
});
