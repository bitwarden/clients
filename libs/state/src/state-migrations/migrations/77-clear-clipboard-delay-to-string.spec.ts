import { MockProxy } from "jest-mock-extended";

import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import { ClearClipboardDelayToStringMigrator } from "./77-clear-clipboard-delay-to-string";

describe("ClearClipboardDelayToStringMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: ClearClipboardDelayToStringMigrator;

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper({}, 76);
      sut = new ClearClipboardDelayToStringMigrator(76, 77);
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

    it("should not migrate undefined values and should NOT set flag", async () => {
      helper.getAccounts.mockResolvedValue([{ userId: "user-1", account: {} }]);

      helper.getFromUser.mockResolvedValue(undefined);

      await sut.migrate(helper);

      // Should NOT set the flag for users with no prior value
      expect(helper.setToUser).not.toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          key: "hadPreMigrationClipboardValue",
        }),
        true,
      );

      // Should NOT set the clipboard delay value
      expect(helper.setToUser).not.toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          key: "clearClipboardDelay",
        }),
        expect.anything(),
      );
    });

    it("should set hadPreMigrationClipboardValue flag for users with null value", async () => {
      helper.getAccounts.mockResolvedValue([{ userId: "user-1", account: {} }]);
      helper.getFromUser.mockResolvedValue(null);

      await sut.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          key: "hadPreMigrationClipboardValue",
          stateDefinition: expect.objectContaining({
            name: "autofillSettingsLocal",
          }),
        }),
        true,
      );
    });

    it("should NOT set hadPreMigrationClipboardValue flag for users with integer value", async () => {
      helper.getAccounts.mockResolvedValue([{ userId: "user-1", account: {} }]);
      helper.getFromUser.mockResolvedValue(300);

      await sut.migrate(helper);

      expect(helper.setToUser).not.toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          key: "hadPreMigrationClipboardValue",
        }),
        true,
      );
    });

    it("should NOT set flag when user had undefined value", async () => {
      helper.getAccounts.mockResolvedValue([{ userId: "user-1", account: {} }]);
      helper.getFromUser.mockResolvedValue(undefined);

      await sut.migrate(helper);

      expect(helper.setToUser).not.toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          key: "hadPreMigrationClipboardValue",
        }),
        true,
      );
    });

    it("should only set flag for users who had null, not for users with integer values", async () => {
      helper.getAccounts.mockResolvedValue([
        { userId: "user-1", account: {} },
        { userId: "user-2", account: {} },
      ]);
      helper.getFromUser.mockResolvedValueOnce(null).mockResolvedValueOnce(300);

      await sut.migrate(helper);

      // user-1 had null (old "Never") — flag should be set
      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ key: "hadPreMigrationClipboardValue" }),
        true,
      );
      // user-2 had 300 (explicit fiveMinutes) — flag should NOT be set
      expect(helper.setToUser).not.toHaveBeenCalledWith(
        "user-2",
        expect.objectContaining({ key: "hadPreMigrationClipboardValue" }),
        true,
      );
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper({}, 76);
      sut = new ClearClipboardDelayToStringMigrator(76, 77);
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

    it("should remove hadPreMigrationClipboardValue flag on rollback", async () => {
      helper.getAccounts.mockResolvedValue([{ userId: "user-1", account: {} }]);
      helper.getFromUser.mockResolvedValue("never");

      await sut.rollback(helper);

      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          key: "hadPreMigrationClipboardValue",
          stateDefinition: expect.objectContaining({
            name: "autofillSettingsLocal",
          }),
        }),
        undefined,
      );
    });
  });
});
