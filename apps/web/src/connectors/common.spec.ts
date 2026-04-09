import * as common from "./common";

jest.mock("./common", () => {
  const actual = jest.requireActual("./common") as typeof common;
  return {
    ...actual,
    getLocationHref: jest.fn(),
    getLocationHostname: jest.fn(),
  };
});

describe("common connector utilities", () => {
  describe("getQsParam", () => {
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
      expect(b64Decode(encoded)).toBe("hello world");
    });

    it.skip("handles spaceAsPlus replacement", () => {
      const original = btoa("test");
      const withSpaces = original.replace(/\+/g, " ");
      expect(b64Decode(withSpaces, true)).toBe("test");
    });
  });

  describe("buildMobileDeeplinkUriFromParam", () => {
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
});
