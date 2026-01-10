import { runMigrator } from "../migration-helper.spec";

import { DeleteInstalledVersion } from "./52-delete-installed-version";

describe("DeleteInstalledVersion", () => {
  const sut = new DeleteInstalledVersion(51, 52);

  describe("migrate", () => {
    it("can delete data if there", async () => {
      const output = await runMigrator(sut, {
        authenticatedAccounts: ["user1"],
        global: {
          installedVersion: "2024.1.1",
        },
      });

      expect(output).toEqual({
        authenticatedAccounts: ["user1"],
        global: {},
      });
    });

    it("will run if installed version is not there", async () => {
      const output = await runMigrator(sut, {
        authenticatedAccounts: ["user1"],
        global: {},
      });

      expect(output).toEqual({
        authenticatedAccounts: ["user1"],
        global: {},
      });
    });
  });
});
