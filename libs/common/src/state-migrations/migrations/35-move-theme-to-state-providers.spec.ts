import { runMigrator } from "../migration-helper.spec";

import { MoveThemeToStateProviderMigrator } from "./35-move-theme-to-state-providers";

describe("MoveThemeToStateProviders", () => {
  const sut = new MoveThemeToStateProviderMigrator(34, 35);

  describe("migrate", () => {
    it("migrates global theme and deletes it", async () => {
      const output = await runMigrator(sut, {
        global: {
          theme: "dark",
        },
      });

      expect(output).toEqual({
        global_theming_selection: "dark",
        global: {},
      });
    });

    it.each([{}, null])(
      "doesn't touch it if global state looks like: '%s'",
      async (globalState) => {
        const output = await runMigrator(sut, {
          global: globalState,
        });

        expect(output).toEqual({
          global: globalState,
        });
      },
    );
  });

  describe("rollback", () => {
    it("migrates state provider theme back to original location when no global", async () => {
      const output = await runMigrator(
        sut,
        {
          global_theming_selection: "disk",
        },
        "rollback",
      );

      expect(output).toEqual({
        global: {
          theme: "disk",
        },
      });
    });

    it("migrates state provider theme back to legacy location when there is an existing global object", async () => {
      const output = await runMigrator(
        sut,
        {
          global_theming_selection: "disk",
          global: {
            other: "stuff",
          },
        },
        "rollback",
      );

      expect(output).toEqual({
        global: {
          theme: "disk",
          other: "stuff",
        },
      });
    });

    it("does nothing if no theme in state provider location", async () => {
      const output = await runMigrator(sut, {}, "rollback");
      expect(output).toEqual({});
    });
  });
});
