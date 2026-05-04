import { runMigrator } from "../migration-helper.spec";
import { IRREVERSIBLE } from "../migrator";

import { MigrateSsoRequiredCache } from "./78-migrate-sso-required-cache";

describe("MigrateSsoRequiredCache", () => {
  const sut = new MigrateSsoRequiredCache(77, 78);

  describe("migrate", () => {
    it("sets the cache to null when it contains the old string[] format", async () => {
      const output = await runMigrator(sut, {
        global_ssoLoginLocal_ssoRequiredCache: ["user@example.com"],
      });

      expect(output).toEqual({
        global_ssoLoginLocal_ssoRequiredCache: null,
      });
    });

    it("sets the cache to null when it contains multiple entries in the old string[] format", async () => {
      const output = await runMigrator(sut, {
        global_ssoLoginLocal_ssoRequiredCache: ["user1@example.com", "user2@example.com"],
      });

      expect(output).toEqual({
        global_ssoLoginLocal_ssoRequiredCache: null,
      });
    });

    it("does not modify the cache when it already contains the new SsoRequiredCacheEntry[] format", async () => {
      const cache = [{ email: "user@example.com", webVaultUrl: "https://vault.bitwarden.com" }];

      const output = await runMigrator(sut, {
        global_ssoLoginLocal_ssoRequiredCache: cache,
      });

      expect(output).toEqual({
        global_ssoLoginLocal_ssoRequiredCache: cache,
      });
    });

    it("does nothing when the cache is null", async () => {
      const output = await runMigrator(sut, {
        global_ssoLoginLocal_ssoRequiredCache: null,
      });

      expect(output).toEqual({
        global_ssoLoginLocal_ssoRequiredCache: null,
      });
    });

    it("does nothing when the cache is empty", async () => {
      const output = await runMigrator(sut, {
        global_ssoLoginLocal_ssoRequiredCache: [],
      });

      expect(output).toEqual({
        global_ssoLoginLocal_ssoRequiredCache: [],
      });
    });

    it("does nothing when the cache key is absent", async () => {
      const output = await runMigrator(sut, {});

      expect(output).toEqual({});
    });
  });

  describe("rollback", () => {
    it("is irreversible", async () => {
      await expect(runMigrator(sut, {}, "rollback")).rejects.toThrow(IRREVERSIBLE);
    });
  });
});
