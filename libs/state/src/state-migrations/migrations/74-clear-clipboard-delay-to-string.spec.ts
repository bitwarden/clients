import { MockProxy } from "jest-mock-extended";

import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import { ClearClipboardDelayToStringMigrator } from "./74-clear-clipboard-delay-to-string";

describe("ClearClipboardDelayToStringMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: ClearClipboardDelayToStringMigrator;

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper({}, 73);
      sut = new ClearClipboardDelayToStringMigrator(73, 74);
    });

    it("should call getAccounts", async () => {
      await sut.migrate(helper);

      // This should always be called in any migration
      expect(helper.getAccounts).toHaveBeenCalled();
    });

    it("should handle empty accounts gracefully", async () => {
      // Test with no accounts
      helper.getAccounts.mockResolvedValue([]);

      await expect(sut.migrate(helper)).resolves.not.toThrow();
    });

    it("should handle accounts with no clearClipboard settings", async () => {
      // Test with accounts but no clearClipboard settings
      helper.getAccounts.mockResolvedValue([
        { userId: "user-1", account: {} },
        { userId: "user-2", account: {} },
      ]);

      await expect(sut.migrate(helper)).resolves.not.toThrow();

      // Should still call getFromUser for each user
      expect(helper.getFromUser).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          key: "clearClipboardDelay",
          stateDefinition: expect.objectContaining({
            name: "autofillSettingsLocal",
          }),
        }),
      );

      expect(helper.getFromUser).toHaveBeenCalledWith(
        "user-2",
        expect.objectContaining({
          key: "clearClipboardDelay",
          stateDefinition: expect.objectContaining({
            name: "autofillSettingsLocal",
          }),
        }),
      );
    });

    it("should migrate a single user with an integer value", async () => {
      // Mock getAccounts to return one user
      helper.getAccounts.mockResolvedValue([{ userId: "user-1", account: {} }]);

      // Mock getFromUser to return an integer value
      helper.getFromUser.mockResolvedValue(10);

      await sut.migrate(helper);

      expect(helper.getFromUser).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          key: "clearClipboardDelay",
          stateDefinition: expect.objectContaining({
            name: "autofillSettingsLocal",
          }),
        }),
      );

      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          key: "clearClipboardDelay",
          stateDefinition: expect.objectContaining({
            name: "autofillSettingsLocal",
          }),
        }),
        "tenSeconds",
      );
    });

    it("should migrate null to fiveMinutes", async () => {
      helper.getAccounts.mockResolvedValue([{ userId: "user-1", account: {} }]);

      helper.getFromUser.mockResolvedValue(null);

      await sut.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          key: "clearClipboardDelay",
          stateDefinition: expect.objectContaining({
            name: "autofillSettingsLocal",
          }),
        }),
        "fiveMinutes",
      );
    });

    it("should not migrate undefined values", async () => {
      helper.getAccounts.mockResolvedValue([{ userId: "user-1", account: {} }]);

      helper.getFromUser.mockResolvedValue(undefined);

      await sut.migrate(helper);

      expect(helper.setToUser).not.toHaveBeenCalled();
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper({}, 74);
      sut = new ClearClipboardDelayToStringMigrator(73, 74);
    });

    it("should call getAccounts", async () => {
      await sut.rollback(helper);

      expect(helper.getAccounts).toHaveBeenCalled();
    });

    it("should rollback a string value to integer", async () => {
      helper.getAccounts.mockResolvedValue([{ userId: "user-1", account: {} }]);

      helper.getFromUser.mockResolvedValue("tenSeconds");

      await sut.rollback(helper);

      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          key: "clearClipboardDelay",
          stateDefinition: expect.objectContaining({
            name: "autofillSettingsLocal",
          }),
        }),
        10,
      );
    });
  });
});
