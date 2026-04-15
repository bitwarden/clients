import { NotificationTypes } from "./abstractions/notification-bar";
import { isAtRiskPasswordNotification } from "./utils";

describe("isAtRiskPasswordNotification", () => {
  describe("type check", () => {
    it.each([
      ["Add", NotificationTypes.Add],
      ["Change", NotificationTypes.Change],
      ["Unlock", NotificationTypes.Unlock],
    ])("returns false when type is %s", (_, type) => {
      expect(isAtRiskPasswordNotification({ type, params: { organizationName: "Acme" } })).toBe(
        false,
      );
    });

    it("returns false when type is absent", () => {
      expect(isAtRiskPasswordNotification({ params: { organizationName: "Acme" } })).toBe(false);
    });
  });

  describe("params shape", () => {
    it("returns false when params is absent", () => {
      expect(isAtRiskPasswordNotification({ type: NotificationTypes.AtRiskPassword })).toBe(false);
    });

    it("returns false when params is null", () => {
      expect(
        isAtRiskPasswordNotification({ type: NotificationTypes.AtRiskPassword, params: null }),
      ).toBe(false);
    });

    it.each([
      ["a string", "bad"],
      ["a number", 42],
      ["a boolean", true],
    ])("returns false when params is %s", (_, params) => {
      expect(isAtRiskPasswordNotification({ type: NotificationTypes.AtRiskPassword, params })).toBe(
        false,
      );
    });

    it("returns false when params is an array (organizationName absent)", () => {
      expect(
        isAtRiskPasswordNotification({ type: NotificationTypes.AtRiskPassword, params: [] }),
      ).toBe(false);
    });

    it("returns false when organizationName is absent", () => {
      expect(
        isAtRiskPasswordNotification({ type: NotificationTypes.AtRiskPassword, params: {} }),
      ).toBe(false);
    });

    it("returns false when organizationName is not a string", () => {
      expect(
        isAtRiskPasswordNotification({
          type: NotificationTypes.AtRiskPassword,
          params: { organizationName: 42 },
        }),
      ).toBe(false);
    });

    it("returns true when organizationName is an empty string", () => {
      expect(
        isAtRiskPasswordNotification({
          type: NotificationTypes.AtRiskPassword,
          params: { organizationName: "", hasPasswordChangeUri: false },
        }),
      ).toBe(true);
    });

    it("returns false when hasPasswordChangeUri is absent", () => {
      expect(
        isAtRiskPasswordNotification({
          type: NotificationTypes.AtRiskPassword,
          params: { organizationName: "Acme" },
        }),
      ).toBe(false);
    });

    it("returns true when hasPasswordChangeUri is true", () => {
      expect(
        isAtRiskPasswordNotification({
          type: NotificationTypes.AtRiskPassword,
          params: { organizationName: "Acme", hasPasswordChangeUri: true },
        }),
      ).toBe(true);
    });

    it("returns true when hasPasswordChangeUri is false", () => {
      expect(
        isAtRiskPasswordNotification({
          type: NotificationTypes.AtRiskPassword,
          params: { organizationName: "Acme", hasPasswordChangeUri: false },
        }),
      ).toBe(true);
    });

    it("returns false when hasPasswordChangeUri is not a boolean", () => {
      expect(
        isAtRiskPasswordNotification({
          type: NotificationTypes.AtRiskPassword,
          params: { organizationName: "Acme", hasPasswordChangeUri: "true" },
        }),
      ).toBe(false);
    });

    it("returns false when hasPasswordChangeUri is null", () => {
      expect(
        isAtRiskPasswordNotification({
          type: NotificationTypes.AtRiskPassword,
          params: { organizationName: "Acme", hasPasswordChangeUri: null },
        }),
      ).toBe(false);
    });
  });
});
