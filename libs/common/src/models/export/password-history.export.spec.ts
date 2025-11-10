import { PasswordHistoryExport } from "./password-history.export";

describe("PasswordHistoryExport", () => {
  describe("toView", () => {
    it.each([null, undefined, "", "   "])("should throw when password is %p", (value) => {
      const passwordHistory = new PasswordHistoryExport({
        password: value as any,
        lastUsedDate: new Date(),
      });
      expect(() => PasswordHistoryExport.toView(passwordHistory)).toThrow(
        "Password history password is required.",
      );
    });

    it("should map fields correctly", () => {
      const validPasswordHistory = {
        password: "PASSWORD",
        lastUsedDate: new Date("2023-01-01T00:00:00Z"),
      };
      const result = PasswordHistoryExport.toView(new PasswordHistoryExport(validPasswordHistory));
      expect(result).toBeDefined();
      expect(result.password).toBe(validPasswordHistory.password);
      expect(result.lastUsedDate).toBe(validPasswordHistory.lastUsedDate);
    });
  });
});
