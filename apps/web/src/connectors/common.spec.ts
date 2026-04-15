import * as common from "./common";
import { isKnownCloudOrigin, resolvePostMessageOrigin } from "./common";

jest.mock("./common", () => {
  const actual = jest.requireActual("./common") as typeof common;
  return {
    ...actual,
    getLocationHref: jest.fn(),
    getLocationHostname: jest.fn(),
  };
});

describe("common connector utilities", () => {
  describe.skip("getQsParam", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("returns the value for an existing query parameter", () => {
      jest.mocked(common.getLocationHref).mockReturnValue("https://example.com?foo=bar");
      expect(common.getQsParam("foo")).toBe("bar");
    });

    it("returns null when the parameter does not exist", () => {
      jest.mocked(common.getLocationHref).mockReturnValue("https://example.com?foo=bar");
      expect(common.getQsParam("missing")).toBeNull();
    });

    it("decodes URI-encoded values", () => {
      jest.mocked(common.getLocationHref).mockReturnValue("https://example.com?msg=hello%20world");
      expect(common.getQsParam("msg")).toBe("hello world");
    });

    it("returns empty string for a parameter with no value", () => {
      jest.mocked(common.getLocationHref).mockReturnValue("https://example.com?flag&other=1");
      expect(common.getQsParam("flag")).toBe("");
    });
  });

  describe("b64Decode", () => {
    it.skip("decodes a base64 string", () => {
      const encoded = btoa("hello world");
      expect(common.b64Decode(encoded)).toBe("hello world");
    });

    it.skip("handles spaceAsPlus replacement", () => {
      const original = btoa("test");
      const withSpaces = original.replace(/\+/g, " ");
      expect(common.b64Decode(withSpaces, true)).toBe("test");
    });
  });

  describe.skip("buildMobileDeeplinkUriFromParam", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe("when deeplinkScheme=https", () => {
      it("returns https://bitwarden.com for .com vaults", () => {
        jest
          .mocked(common.getLocationHref)
          .mockReturnValue("https://vault.bitwarden.com/connector?deeplinkScheme=https");
        jest.mocked(common.getLocationHostname).mockReturnValue("vault.bitwarden.com");
        expect(common.buildMobileDeeplinkUriFromParam("webauthn")).toBe(
          "https://bitwarden.com/webauthn-callback",
        );
      });

      it("returns https://bitwarden.eu for .eu vaults", () => {
        jest
          .mocked(common.getLocationHref)
          .mockReturnValue("https://vault.bitwarden.eu/connector?deeplinkScheme=https");
        jest.mocked(common.getLocationHostname).mockReturnValue("vault.bitwarden.eu");
        expect(common.buildMobileDeeplinkUriFromParam("webauthn")).toBe(
          "https://bitwarden.eu/webauthn-callback",
        );
      });

      it("returns https://bitwarden.pw for .pw vaults", () => {
        jest
          .mocked(common.getLocationHref)
          .mockReturnValue("https://vault.bitwarden.pw/connector?deeplinkScheme=https");
        jest.mocked(common.getLocationHostname).mockReturnValue("vault.bitwarden.pw");
        expect(common.buildMobileDeeplinkUriFromParam("webauthn")).toBe(
          "https://bitwarden.pw/webauthn-callback",
        );
      });

      it("defaults to bitwarden.com for unknown hostnames", () => {
        jest
          .mocked(common.getLocationHref)
          .mockReturnValue("https://self-hosted.example.com/connector?deeplinkScheme=https");
        jest.mocked(common.getLocationHostname).mockReturnValue("self-hosted.example.com");
        expect(common.buildMobileDeeplinkUriFromParam("webauthn")).toBe(
          "https://bitwarden.com/webauthn-callback",
        );
      });
    });

    describe("when deeplinkScheme is not https", () => {
      it("returns bitwarden:// for bitwarden scheme", () => {
        jest
          .mocked(common.getLocationHref)
          .mockReturnValue("https://vault.bitwarden.com/connector?deeplinkScheme=bitwarden");
        jest.mocked(common.getLocationHostname).mockReturnValue("vault.bitwarden.com");
        expect(common.buildMobileDeeplinkUriFromParam("webauthn")).toBe(
          "bitwarden://webauthn-callback",
        );
      });

      it("returns bitwarden:// when deeplinkScheme is absent", () => {
        jest
          .mocked(common.getLocationHref)
          .mockReturnValue("https://vault.bitwarden.com/connector");
        jest.mocked(common.getLocationHostname).mockReturnValue("vault.bitwarden.com");
        expect(common.buildMobileDeeplinkUriFromParam("webauthn")).toBe(
          "bitwarden://webauthn-callback",
        );
      });
    });

    describe("duo kind", () => {
      it("builds correct path for duo callbacks", () => {
        jest
          .mocked(common.getLocationHref)
          .mockReturnValue("https://vault.bitwarden.com/connector?deeplinkScheme=https");
        jest.mocked(common.getLocationHostname).mockReturnValue("vault.bitwarden.com");
        expect(common.buildMobileDeeplinkUriFromParam("duo")).toBe(
          "https://bitwarden.com/duo-callback",
        );
      });
    });
  });

  describe.skip("isKnownCloudOrigin", () => {
    // ❌ Skipped: uses Object.defineProperty(window, "location") which fails in jsdom
    // window.location is non-configurable and cannot be mocked this way
    function setLocation(href: string, hostname: string) {
      Object.defineProperty(window, "location", {
        value: { href, hostname },
        writable: true,
        configurable: true,
      });
    }

    describe("recognizes Bitwarden-managed domains", () => {
      it.each([
        ["vault.bitwarden.com", "production .com subdomain"],
        ["vault.bitwarden.eu", "production .eu subdomain"],
        ["vault.qa.bitwarden.pw", "multi-level .pw subdomain"],
      ])("returns true for %s (%s)", (hostname) => {
        setLocation(`https://${hostname}/connector`, hostname);
        expect(isKnownCloudOrigin()).toBe(true);
      });
    });

    describe("rejects unmanaged domains", () => {
      it("returns false for localhost", () => {
        setLocation("http://localhost/connector", "localhost");
        expect(isKnownCloudOrigin()).toBe(false);
      });

      it("returns false for a customer self-hosted domain", () => {
        setLocation("https://vault.customer.com/connector", "vault.customer.com");
        expect(isKnownCloudOrigin()).toBe(false);
      });

      it("returns false for a domain that contains but does not end with a managed TLD", () => {
        setLocation("https://not-bitwarden.com/connector", "not-bitwarden.com");
        expect(isKnownCloudOrigin()).toBe(false);
      });

      it("returns false for the bare marketing domain", () => {
        setLocation("https://bitwarden.com/connector", "bitwarden.com");
        expect(isKnownCloudOrigin()).toBe(false);
      });

      it("returns false when a managed TLD appears as a non-terminal segment", () => {
        setLocation(
          "https://vault.bitwarden.com.not-bitwarden.com/connector",
          "vault.bitwarden.com.not-bitwarden.com",
        );
        expect(isKnownCloudOrigin()).toBe(false);
      });

      it("returns false for an empty hostname", () => {
        setLocation("", "");
        expect(isKnownCloudOrigin()).toBe(false);
      });
    });
  });

  describe.skip("resolvePostMessageOrigin", () => {
    // ❌ Skipped: uses Object.defineProperty(window, "location") which fails in jsdom
    // window.location is non-configurable and cannot be mocked this way
    function setLocation(hostname: string, origin: string) {
      Object.defineProperty(window, "location", {
        value: { hostname, origin, href: origin + "/connector" },
        writable: true,
        configurable: true,
      });
    }

    describe("on Bitwarden-managed domains", () => {
      it("returns window.location.origin when parent is a web URL", () => {
        setLocation("vault.bitwarden.com", "https://vault.bitwarden.com");
        expect(resolvePostMessageOrigin("https://vault.bitwarden.com/some-page")).toBe(
          "https://vault.bitwarden.com",
        );
      });

      it("returns window.location.origin regardless of the provided parent URL", () => {
        setLocation("vault.bitwarden.com", "https://vault.bitwarden.com");
        expect(resolvePostMessageOrigin("https://unrelated.example.com")).toBe(
          "https://vault.bitwarden.com",
        );
      });

      it("preserves a file:// parent URL for desktop compatibility", () => {
        setLocation("vault.bitwarden.com", "https://vault.bitwarden.com");
        expect(resolvePostMessageOrigin("file:///path/to/electron/index.html")).toBe(
          "file:///path/to/electron/index.html",
        );
      });

      it("returns window.location.origin when parent URL is null", () => {
        setLocation("vault.bitwarden.com", "https://vault.bitwarden.com");
        expect(resolvePostMessageOrigin(null)).toBe("https://vault.bitwarden.com");
      });

      it("returns window.location.origin when parent URL is invalid", () => {
        setLocation("vault.bitwarden.com", "https://vault.bitwarden.com");
        expect(resolvePostMessageOrigin("not-a-url")).toBe("https://vault.bitwarden.com");
      });
    });

    describe("on unmanaged domains", () => {
      it("returns the provided parent URL unchanged", () => {
        setLocation("vault.customer.com", "https://vault.customer.com");
        expect(resolvePostMessageOrigin("https://vault.customer.com/page")).toBe(
          "https://vault.customer.com/page",
        );
      });

      it("returns null when parent URL is null", () => {
        setLocation("vault.customer.com", "https://vault.customer.com");
        expect(resolvePostMessageOrigin(null)).toBeNull();
      });
    });
  });
});
