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
      const validUrl = "https://api-123.duosecurity.com/oauth/v1/authorize";
      redirectToDuoFrameless(validUrl);
      expect(window.location.href).toBe(validUrl);
    });

    it("should redirect to a valid Duo Federal URL", () => {
      const validUrl = "https://api-123.duofederal.com/oauth/v1/authorize";
      redirectToDuoFrameless(validUrl);
      expect(window.location.href).toBe(validUrl);
    });

    it("should throw an error for an invalid URL", () => {
      const invalidUrl = "https://malicious-site.com";
      expect(() => redirectToDuoFrameless(invalidUrl)).toThrow("Invalid redirect URL");
    });

    it("should throw an error for an malicious URL with valid redirect embedded", () => {
      const invalidUrl = "https://malicious-site.com\\@api-123.duosecurity.com/oauth/v1/authorize";
      expect(() => redirectToDuoFrameless(invalidUrl)).toThrow("Invalid redirect URL");
    });

    it("should throw an error for a URL with a malicious subdomain", () => {
      const maliciousSubdomainUrl =
        "https://api-a86d5bde.duosecurity.com.evil.com/oauth/v1/authorize";
      expect(() => redirectToDuoFrameless(maliciousSubdomainUrl)).toThrow("Invalid redirect URL");
    });

    it("should throw an error for a URL using HTTP protocol", () => {
      const maliciousSubdomainUrl = "http://api-a86d5bde.duosecurity.com/oauth/v1/authorize";
      expect(() => redirectToDuoFrameless(maliciousSubdomainUrl)).toThrow(
        "Invalid redirect URL: invalid protocol",
      );
    });

    it("should throw an error for a URL with javascript code", () => {
      const maliciousSubdomainUrl = "javascript://https://api-a86d5bde.duosecurity.com%0Aalert(1)";
      expect(() => redirectToDuoFrameless(maliciousSubdomainUrl)).toThrow(
        "Invalid redirect URL: invalid protocol",
      );
    });

    it("should throw an error for a non-HTTPS URL", () => {
      const nonHttpsUrl = "http://api-123.duosecurity.com/auth";
      expect(() => redirectToDuoFrameless(nonHttpsUrl)).toThrow("Invalid redirect URL");
    });

    it("should throw an error for a URL with invalid port specified", () => {
      const urlWithPort = "https://api-123.duyosecurity.com:8080/auth";
      expect(() => redirectToDuoFrameless(urlWithPort)).toThrow(
        "Invalid redirect URL: port not allowed",
      );
    });

    it("should redirect to a valid Duo Federal URL with valid port", () => {
      const validUrl = "https://api-123.duofederal.com:443/oauth/v1/authorize";
      redirectToDuoFrameless(validUrl);
      expect(window.location.href).toBe(validUrl);
    });

    it("should throw an error for a URL with an invalid pathname", () => {
      const urlWithPort = "https://api-123.duyosecurity.com/../evil/path/here/";
      expect(() => redirectToDuoFrameless(urlWithPort)).toThrow(
        "Invalid redirect URL: invalid pathname",
      );
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
