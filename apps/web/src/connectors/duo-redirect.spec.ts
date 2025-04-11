import { redirectToDuoFrameless } from "./duo-redirect";

describe("duo-redirect", () => {
  describe("redirectToDuoFrameless", () => {
    beforeEach(() => {
      Object.defineProperty(window, "location", {
        value: { href: "" },
        writable: true,
      });
    });

    it("should redirect to a valid Duo URL", () => {
      const validUrl = "https://api-123.duosecurity.com/auth";
      redirectToDuoFrameless(validUrl);
      expect(window.location.href).toBe(validUrl);
    });

    it("should redirect to a valid Duo Federal URL", () => {
      const validUrl = "https://api-123.duofederal.com/auth";
      redirectToDuoFrameless(validUrl);
      expect(window.location.href).toBe(validUrl);
    });

    it("should throw an error for an invalid URL", () => {
      const invalidUrl = "https://malicious-site.com";
      expect(() => redirectToDuoFrameless(invalidUrl)).toThrow("Invalid redirect URL");
    });

    it("should throw an error for an malicious URL with valid redirect embedded", () => {
      const invalidUrl = "https://malicious-site.com\\@api-123.duosecurity.com/auth";
      expect(() => redirectToDuoFrameless(invalidUrl)).toThrow("Invalid redirect URL");
    });

    it("should throw an error for a non-HTTPS URL", () => {
      const nonHttpsUrl = "http://api-123.duosecurity.com/auth";
      expect(() => redirectToDuoFrameless(nonHttpsUrl)).toThrow("Invalid redirect URL");
    });

    it("should throw an error for a URL with an invalid hostname", () => {
      const invalidHostnameUrl = "https://api-123.invalid.com";
      expect(() => redirectToDuoFrameless(invalidHostnameUrl)).toThrow("Invalid redirect URL");
    });

    it("should throw an error for a URL with credentials", () => {
      const UrlWithCredentials = "https://api-123.duosecurity.com:password@evil/attack";
      expect(() => redirectToDuoFrameless(UrlWithCredentials)).toThrow(
        "Invalid redirect URL: embedded credentials not allowed",
      );
    });
  });
});
