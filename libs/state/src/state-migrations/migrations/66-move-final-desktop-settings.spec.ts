import { runMigrator } from "../migration-helper.spec";

import { MoveFinalDesktopSettingsMigrator } from "./66-move-final-desktop-settings";

describe("MoveDesktopSettings", () => {
  const sut = new MoveFinalDesktopSettingsMigrator(65, 66);

  const cases: {
    it: string;
    preMigration: Record<string, unknown>;
    postMigration: Record<string, unknown>;
  }[] = [
    {
      it: "moves truthy values",
      preMigration: {
        global_account_accounts: {
          user1: {},
          otherUser: {},
        },
        user1: {
          settings: {
            minimizeOnCopyToClipboard: true,
          },
        },
        otherUser: {
          settings: {
            random: "stuff",
          },
        },
        global: {
          enableBrowserIntegration: true,
          enableBrowserIntegrationFingerprint: true,
        },
      },
      postMigration: {
        global_account_accounts: {
          user1: {},
          otherUser: {},
        },
        global: {},
        user1: {
          settings: {},
        },
        otherUser: {
          settings: {
            random: "stuff",
          },
        },
        global_desktopSettings_browserIntegrationEnabled: true,
        user_user1_desktopSettings_minimizeOnCopy: true,
        global_desktopSettings_browserIntegrationFingerprintEnabled: true,
      },
    },
    {
      it: "moves falsey values",
      preMigration: {
        global_account_accounts: {
          user1: {},
          otherUser: {},
        },
        user1: {
          settings: {
            minimizeOnCopyToClipboard: false,
          },
        },
        otherUser: {
          settings: {
            random: "stuff",
          },
        },
        global: {
          enableBrowserIntegration: false,
          enableBrowserIntegrationFingerprint: false,
        },
      },
      postMigration: {
        global_account_accounts: {
          user1: {},
          otherUser: {},
        },
        global: {},
        user1: {
          settings: {},
        },
        otherUser: {
          settings: {
            random: "stuff",
          },
        },
        global_desktopSettings_browserIntegrationEnabled: false,
        user_user1_desktopSettings_minimizeOnCopy: false,
        global_desktopSettings_browserIntegrationFingerprintEnabled: false,
      },
    },
    {
      it: "migrates browser integration without fingerprint enabled",
      preMigration: {
        global_account_accounts: {
          user1: {},
          otherUser: {},
        },
        user1: {
          settings: {
            minimizeOnCopyToClipboard: false,
          },
        },
        otherUser: {
          settings: {
            random: "stuff",
          },
        },
        global: {
          enableBrowserIntegration: true,
        },
      },
      postMigration: {
        global_account_accounts: {
          user1: {},
          otherUser: {},
        },
        global: {},
        user1: {
          settings: {},
        },
        otherUser: {
          settings: {
            random: "stuff",
          },
        },
        global_desktopSettings_browserIntegrationEnabled: true,
        user_user1_desktopSettings_minimizeOnCopy: false,
      },
    },
    {
      it: "does not move non-existant values",
      preMigration: {
        global_account_accounts: {
          user1: {},
          otherUser: {},
        },
        user1: {
          settings: {},
        },
        otherUser: {
          settings: {
            random: "stuff",
          },
        },
        global: {},
      },
      postMigration: {
        global_account_accounts: {
          user1: {},
          otherUser: {},
        },
        global: {},
        user1: {
          settings: {},
        },
        otherUser: {
          settings: {
            random: "stuff",
          },
        },
      },
    },
  ];

  describe("migrate", () => {
    it.each(cases)("$it", async ({ preMigration, postMigration }) => {
      const actualOutput = await runMigrator(sut, preMigration, "migrate");
      expect(actualOutput).toEqual(postMigration);
    });
  });

  describe("rollback", () => {
    it.each(cases)("$it", async ({ postMigration, preMigration }) => {
      const actualOutput = await runMigrator(sut, postMigration, "rollback");
      expect(actualOutput).toEqual(preMigration);
    });
  });
});
