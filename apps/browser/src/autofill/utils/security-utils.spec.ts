import { isEventTrusted, shouldValidateEventTrusted } from "./security-utils";

describe("Security Utils", () => {
  let originalTestConfig: typeof globalThis.AUTOFILL_TEST_CONFIG;

  beforeEach(() => {
    // Save original config
    originalTestConfig = globalThis.AUTOFILL_TEST_CONFIG;
  });

  afterEach(() => {
    // Restore original config
    globalThis.AUTOFILL_TEST_CONFIG = originalTestConfig;
  });

  describe("shouldValidateEventTrusted", () => {
    it("returns true when validation is not disabled", () => {
      globalThis.AUTOFILL_TEST_CONFIG = undefined;
      expect(shouldValidateEventTrusted()).toBe(true);
    });

    it("returns true when test config exists but validation is not disabled", () => {
      globalThis.AUTOFILL_TEST_CONFIG = { disableEventTrustedValidation: false };
      expect(shouldValidateEventTrusted()).toBe(true);
    });

    it("returns false when validation is disabled in test config", () => {
      globalThis.AUTOFILL_TEST_CONFIG = { disableEventTrustedValidation: true };
      expect(shouldValidateEventTrusted()).toBe(false);
    });
  });

  describe("isEventTrusted", () => {
    it("returns false for untrusted synthetic events when validation is enabled", () => {
      globalThis.AUTOFILL_TEST_CONFIG = undefined;
      const untrustedEvent = new Event("click"); // synthetic events are not trusted by default
      expect(isEventTrusted(untrustedEvent)).toBe(false);
    });

    it("returns true for untrusted events when validation is disabled (test mode)", () => {
      globalThis.AUTOFILL_TEST_CONFIG = { disableEventTrustedValidation: true };
      const untrustedEvent = new Event("click"); // synthetic events are not trusted
      expect(isEventTrusted(untrustedEvent)).toBe(true);
    });

    it("bypasses isTrusted check when validation is disabled", () => {
      // This test validates that our security utils correctly allow events in test mode
      globalThis.AUTOFILL_TEST_CONFIG = { disableEventTrustedValidation: true };

      // Create any event - even synthetic ones should be allowed in test mode
      const syntheticEvent = new Event("keyup");
      expect(syntheticEvent.isTrusted).toBe(false); // Confirm it's synthetic
      expect(isEventTrusted(syntheticEvent)).toBe(true); // But our util allows it in test mode
    });
  });
});
