import {
  getQsParam,
  b64Decode,
  buildMobileDeeplinkUriFromParam,
  isKnownCloudOrigin,
  resolvePostMessageOrigin,
} from "./common";

describe("common connector utilities", () => {
  describe("getQsParam", () => {
    function setHref(url: string) {
      Object.defineProperty(window, "location", {
        value: { href: url },
        writable: true,
        configurable: true,
      });
    }

    it("returns the value for an existing query parameter", () => {
      setHref("https://example.com?foo=bar");
      expect(getQsParam("foo")).toBe("bar");
    });

    it("returns null when the parameter does not exist", () => {
      setHref("https://example.com?foo=bar");
      expect(getQsParam("missing")).toBeNull();
    });

    it("decodes URI-encoded values", () => {
      setHref("https://example.com?msg=hello%20world");
      expect(getQsParam("msg")).toBe("hello world");
    });

    it("returns empty string for a parameter with no value", () => {
      setHref("https://example.com?flag&other=1");
      expect(getQsParam("flag")).toBe("");
    });
  });

  describe("b64Decode", () => {
    it("decodes a base64 string", () => {
      const encoded = btoa("hello world");
      expect(b64Decode(encoded)).toBe("hello world");
    });

    it("handles spaceAsPlus replacement", () => {
      const original = btoa("test");
      const withSpaces = original.replace(/\+/g, " ");
      expect(b64Decode(withSpaces, true)).toBe("test");
    });
  });

  describe("buildMobileDeeplinkUriFromParam", () => {
    function setLocation(href: string, hostname: string) {
      Object.defineProperty(window, "location", {
        value: { href, hostname },
        writable: true,
        configurable: true,
      });
    }

    describe("when deeplinkScheme=https", () => {
      it("returns https://bitwarden.com for .com vaults", () => {
        setLocation(
          "https://vault.bitwarden.com/connector?deeplinkScheme=https",
          "vault.bitwarden.com",
        );
        expect(buildMobileDeeplinkUriFromParam("webauthn")).toBe(
          "https://bitwarden.com/webauthn-callback",
        );
      });

      it("returns https://bitwarden.eu for .eu vaults", () => {
        setLocation(
          "https://vault.bitwarden.eu/connector?deeplinkScheme=https",
          "vault.bitwarden.eu",
        );
        expect(buildMobileDeeplinkUriFromParam("webauthn")).toBe(
          "https://bitwarden.eu/webauthn-callback",
        );
      });

      it("returns https://bitwarden.pw for .pw vaults", () => {
        setLocation(
          "https://vault.bitwarden.pw/connector?deeplinkScheme=https",
          "vault.bitwarden.pw",
        );
        expect(buildMobileDeeplinkUriFromParam("webauthn")).toBe(
          "https://bitwarden.pw/webauthn-callback",
        );
      });

      it("defaults to bitwarden.com for unknown hostnames", () => {
        setLocation(
          "https://self-hosted.example.com/connector?deeplinkScheme=https",
          "self-hosted.example.com",
        );
        expect(buildMobileDeeplinkUriFromParam("webauthn")).toBe(
          "https://bitwarden.com/webauthn-callback",
        );
      });
    });

    describe("when deeplinkScheme is not https", () => {
      it("returns bitwarden:// for bitwarden scheme", () => {
        setLocation(
          "https://vault.bitwarden.com/connector?deeplinkScheme=bitwarden",
          "vault.bitwarden.com",
        );
        expect(buildMobileDeeplinkUriFromParam("webauthn")).toBe("bitwarden://webauthn-callback");
      });

      it("returns bitwarden:// when deeplinkScheme is absent", () => {
        setLocation("https://vault.bitwarden.com/connector", "vault.bitwarden.com");
        expect(buildMobileDeeplinkUriFromParam("webauthn")).toBe("bitwarden://webauthn-callback");
      });
    });

    describe("duo kind", () => {
      it("builds correct path for duo callbacks", () => {
        setLocation(
          "https://vault.bitwarden.com/connector?deeplinkScheme=https",
          "vault.bitwarden.com",
        );
        expect(buildMobileDeeplinkUriFromParam("duo")).toBe("https://bitwarden.com/duo-callback");
      });
    });
  });

  describe("isKnownCloudOrigin", () => {
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

  describe("resolvePostMessageOrigin", () => {
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
