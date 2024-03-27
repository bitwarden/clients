import { runMigrator } from "../migration-helper.spec";

import { MoveDdgToStateProviderMigrator } from "./48-move-ddg-to-state-provider";

describe("MoveDdgToStateProviderMigrator", () => {
  const migrator = new MoveDdgToStateProviderMigrator(47, 48);

  it("migrate", async () => {
    const output = await runMigrator(migrator, {
      global: {
        enableDuckDuckGoBrowserIntegration: true,
        otherStuff: "otherStuff1",
      },
      otherStuff: "otherStuff2",
    });

    expect(output).toEqual({
      global_autofillSettings_enableDuckDuckGoBrowserIntegration: true,
      global: {
        otherStuff: "otherStuff1",
      },
      otherStuff: "otherStuff2",
    });
  });

  it("rollback", async () => {
    const output = await runMigrator(
      migrator,
      {
        global_autofillSettings_enableDuckDuckGoBrowserIntegration: true,
        global: {
          otherStuff: "otherStuff1",
        },
        otherStuff: "otherStuff2",
      },
      "rollback",
    );

    expect(output).toEqual({
      global: {
        enableDuckDuckGoBrowserIntegration: true,
        otherStuff: "otherStuff1",
      },
      otherStuff: "otherStuff2",
    });
  });
});
