import { isBrowserSafariApi } from "./browser-service";

describe("browser-service", () => {
  describe("isBrowserSafariApi", () => {
    it("returns true if browser is safari", () => {
      jest
        .spyOn(navigator, "userAgent", "get")
        .mockReturnValue(
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15",
        );

      const result = isBrowserSafariApi();

      expect(result).toBe(true);
    });

    it("returns false if browser is chrome", () => {
      jest
        .spyOn(navigator, "userAgent", "get")
        .mockReturnValue(
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        );

      const result = isBrowserSafariApi();

      expect(result).toBe(false);
    });

    it("returns false if browser is firefox", () => {
      jest
        .spyOn(navigator, "userAgent", "get")
        .mockReturnValue(
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:130.0) Gecko/20100101 Firefox/130.0",
        );

      const result = isBrowserSafariApi();

      expect(result).toBe(false);
    });
  });
});
