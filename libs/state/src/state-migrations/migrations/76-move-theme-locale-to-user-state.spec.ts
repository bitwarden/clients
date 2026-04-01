import { runMigrator } from "../migration-helper.spec";

import { MoveThemeLocaleToUserStateMigrator } from "./76-move-theme-locale-to-user-state";

describe("MoveThemeLocaleToUserStateMigrator", () => {
  const sut = new MoveThemeLocaleToUserStateMigrator(75, 76);

  describe("migrate", () => {
    it("copies theme and locale from global to all users", async () => {
      const output = await runMigrator(sut, {
        global_account_accounts: {
          user1: null,
          user2: null,
        },
        global_theming_selection: "dark",
        global_translation_locale: "de",
      });

      expect(output).toEqual(
        expect.objectContaining({
          global_account_accounts: expect.objectContaining({
            user1: null,
            user2: null,
          }),
          user_user1_theming_selection: "dark",
          user_user1_translation_locale: "de",
          user_user2_theming_selection: "dark",
          user_user2_translation_locale: "de",
        }),
      );
      // Global entries should be removed
      expect(output).not.toHaveProperty("global_theming_selection");
      expect(output).not.toHaveProperty("global_translation_locale");
    });

    it("migrates only theme when locale is not set", async () => {
      const output = await runMigrator(sut, {
        global_account_accounts: {
          user1: null,
        },
        global_theming_selection: "light",
      });

      expect(output).toEqual(
        expect.objectContaining({
          user_user1_theming_selection: "light",
        }),
      );
      expect(output).not.toHaveProperty("global_theming_selection");
      expect(output).not.toHaveProperty("user_user1_translation_locale");
    });

    it("migrates only locale when theme is not set", async () => {
      const output = await runMigrator(sut, {
        global_account_accounts: {
          user1: null,
        },
        global_translation_locale: "fr",
      });

      expect(output).toEqual(
        expect.objectContaining({
          user_user1_translation_locale: "fr",
        }),
      );
      expect(output).not.toHaveProperty("global_translation_locale");
      expect(output).not.toHaveProperty("user_user1_theming_selection");
    });

    it("does nothing when neither theme nor locale is set", async () => {
      const output = await runMigrator(sut, {
        global_account_accounts: {
          user1: null,
        },
      });

      expect(output).not.toHaveProperty("global_theming_selection");
      expect(output).not.toHaveProperty("global_translation_locale");
      expect(output).not.toHaveProperty("user_user1_theming_selection");
      expect(output).not.toHaveProperty("user_user1_translation_locale");
    });

    it("does not overwrite existing user values", async () => {
      const output = await runMigrator(sut, {
        global_account_accounts: {
          user1: null,
          user2: null,
        },
        global_theming_selection: "dark",
        global_translation_locale: "de",
        user_user1_theming_selection: "light",
        user_user1_translation_locale: "fr",
      });

      expect(output).toEqual(
        expect.objectContaining({
          user_user1_theming_selection: "light",
          user_user1_translation_locale: "fr",
          user_user2_theming_selection: "dark",
          user_user2_translation_locale: "de",
        }),
      );
      expect(output).not.toHaveProperty("global_theming_selection");
      expect(output).not.toHaveProperty("global_translation_locale");
    });

    it("handles no known users", async () => {
      const output = await runMigrator(sut, {
        global_account_accounts: {},
        global_theming_selection: "dark",
        global_translation_locale: "de",
      });

      // Global entries should still be removed even with no users
      expect(output).not.toHaveProperty("global_theming_selection");
      expect(output).not.toHaveProperty("global_translation_locale");
    });
  });

  describe("rollback", () => {
    it("restores first user values to global and removes user entries", async () => {
      const output = await runMigrator(
        sut,
        {
          global_account_accounts: {
            user1: null,
            user2: null,
          },
          user_user1_theming_selection: "dark",
          user_user1_translation_locale: "de",
          user_user2_theming_selection: "light",
          user_user2_translation_locale: "fr",
        },
        "rollback",
      );

      expect(output).toEqual(
        expect.objectContaining({
          global_theming_selection: "dark",
          global_translation_locale: "de",
        }),
      );
      expect(output).not.toHaveProperty("user_user1_theming_selection");
      expect(output).not.toHaveProperty("user_user1_translation_locale");
      expect(output).not.toHaveProperty("user_user2_theming_selection");
      expect(output).not.toHaveProperty("user_user2_translation_locale");
    });

    it("handles no user values", async () => {
      const output = await runMigrator(
        sut,
        {
          global_account_accounts: {
            user1: null,
          },
        },
        "rollback",
      );

      expect(output).not.toHaveProperty("global_theming_selection");
      expect(output).not.toHaveProperty("global_translation_locale");
    });
  });
});
