import { ServerSettings } from "./server-settings";

describe("ServerSettings", () => {
  describe("disableUserRegistration", () => {
    it("defaults disableUserRegistration to false", () => {
      const settings = new ServerSettings();
      expect(settings.disableUserRegistration).toBe(false);
    });

    it("sets disableUserRegistration to true when provided", () => {
      const settings = new ServerSettings({ disableUserRegistration: true });
      expect(settings.disableUserRegistration).toBe(true);
    });

    it("sets disableUserRegistration to false when provided", () => {
      const settings = new ServerSettings({ disableUserRegistration: false });
      expect(settings.disableUserRegistration).toBe(false);
    });
  });

  describe("suppressOnboardingInterstitials", () => {
    it("defaults suppressOnboardingInterstitials to false", () => {
      const settings = new ServerSettings();
      expect(settings.suppressOnboardingInterstitials).toBe(false);
    });

    it("sets suppressOnboardingInterstitials to true when provided", () => {
      const settings = new ServerSettings({ suppressOnboardingInterstitials: true });
      expect(settings.suppressOnboardingInterstitials).toBe(true);
    });

    it("sets suppressOnboardingInterstitials to false when provided", () => {
      const settings = new ServerSettings({ suppressOnboardingInterstitials: false });
      expect(settings.suppressOnboardingInterstitials).toBe(false);
    });
  });
});
