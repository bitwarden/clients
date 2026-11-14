import { TranslationService } from "./translation.service";

class TestTranslationService extends TranslationService {
  translationLocale: string;
}

describe("TranslationService", () => {
  it("falls back to default locale collator when translationLocale is invalid", async () => {
    const service = new TestTranslationService("invalid_tag", null, jest.fn());
    await service.init();

    expect(service.collator).not.toBeNull();
    expect(service.collator.compare("a", "b")).toBe(-1);
  });
});
