import { TranslationService } from "./translation.service";

class TestTranslationService extends TranslationService {
  translationLocale: string;
}

describe("TranslationService", () => {
  const getLocalesJson = jest.fn();

  function createService(systemLanguage: string) {
    return new TestTranslationService(systemLanguage, "locales", getLocalesJson);
  }

  beforeEach(() => {
    getLocalesJson.mockReset();
    getLocalesJson.mockResolvedValue({ greeting: { message: "Hello" } });
  });

  describe("init", () => {
    it.each(["chrome://global/locale/intl.properties", "it-IT-x"])(
      "falls back to a usable default collator for invalid system language %s",
      async (systemLanguage) => {
        const service = createService(systemLanguage);

        await service.init();

        expect(service.translationLocale).toBe("en");
        expect(service.t("greeting")).toBe("Hello");
        expect(service.collator.resolvedOptions().locale).toBe("en");
        expect(service.collator.compare("Group 2", "Group 10")).toBeLessThan(0);
        expect(service.collator.compare("Álpha", "alpha")).toBe(0);
      },
    );

    it("falls back to the configured default locale for an invalid explicit locale", async () => {
      const service = createService("en");
      service.defaultLocale = "sv";
      service.supportedTranslationLocales = ["sv"];

      await service.init("it-IT-x");

      expect(service.translationLocale).toBe("sv");
      expect(getLocalesJson).toHaveBeenCalledWith("sv");
      expect(["Ö", "Z", "Ä"].sort(service.collator.compare)).toEqual(["Z", "Ä", "Ö"]);
    });

    it("preserves collation for a valid system language without a supported translation", async () => {
      const service = createService("sv-FI");

      await service.init();

      expect(service.translationLocale).toBe("en");
      expect(["Ö", "Z", "Ä"].sort(service.collator.compare)).toEqual(["Z", "Ä", "Ö"]);
    });

    it("uses a valid explicit locale instead of an invalid system language", async () => {
      const service = createService("chrome://global/locale/intl.properties");
      service.supportedTranslationLocales = ["en", "sv"];

      await service.init("sv");

      expect(service.translationLocale).toBe("sv");
      expect(["Ö", "Z", "Ä"].sort(service.collator.compare)).toEqual(["Z", "Ä", "Ö"]);
    });
  });
});
