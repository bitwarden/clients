import { runMigrator } from "../migration-helper.spec";

import { InitializeFeatureFlagOverridesMigrator } from "./79-initialize-feature-flag-overrides";

describe("InitializeFeatureFlagOverridesMigrator", () => {
  const sut = new InitializeFeatureFlagOverridesMigrator(78, 79);

  describe("migrate", () => {
    it("initializes to an empty object when the key is absent", async () => {
      const output = await runMigrator(sut, {});

      expect(output).toEqual({
        global_config_featureFlagOverrides: {},
      });
    });

    it("initializes to an empty object when the value is null", async () => {
      const output = await runMigrator(sut, {
        global_config_featureFlagOverrides: null,
      });

      expect(output).toEqual({
        global_config_featureFlagOverrides: {},
      });
    });

    it("leaves an existing override map unchanged", async () => {
      const overrides = { "some-flag": true, "another-flag": 99 };

      const output = await runMigrator(sut, {
        global_config_featureFlagOverrides: overrides,
      });

      expect(output).toEqual({
        global_config_featureFlagOverrides: overrides,
      });
    });
  });

  describe("rollback", () => {
    it("leaves the overrides unchanged", async () => {
      const overrides = { "some-flag": true };

      const output = await runMigrator(
        sut,
        {
          global_config_featureFlagOverrides: overrides,
        },
        "rollback",
      );

      expect(output).toEqual({
        global_config_featureFlagOverrides: overrides,
      });
    });
  });
});
