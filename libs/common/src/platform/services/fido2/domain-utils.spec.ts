import { isValidRpId } from "./domain-utils";

// Spec: If options.rp.id is not a registrable domain suffix of and is not equal to effectiveDomain, return a DOMException whose name is "SecurityError", and terminate this algorithm.
describe("validateRpId", () => {
  let mockFetch: jest.Mock;
  let webAuthnRelatedOriginsFeatureFlag = false;

  beforeEach(() => {
    mockFetch = jest.fn();
    // Default: ROR requests fail (no .well-known/webauthn endpoint)
    mockFetch.mockRejectedValue(new Error("Network error"));
  });

  describe("classic domain validation", () => {
    it("should not be valid when rpId is null", async () => {
      const origin = "example.com";

      expect(await isValidRpId(null, origin, webAuthnRelatedOriginsFeatureFlag)).toBe(false);
    });

    it("should not be valid when origin is null", async () => {
      const rpId = "example.com";

      expect(await isValidRpId(rpId, null, webAuthnRelatedOriginsFeatureFlag)).toBe(false);
    });

    it("should not be valid when rpId is more specific than origin", async () => {
      const rpId = "sub.login.bitwarden.com";
      const origin = "https://login.bitwarden.com:1337";

      expect(await isValidRpId(rpId, origin, webAuthnRelatedOriginsFeatureFlag, mockFetch)).toBe(
        false,
      );
    });

    it("should not be valid when effective domains of rpId and origin do not match", async () => {
      const rpId = "passwordless.dev";
      const origin = "https://login.bitwarden.com:1337";

      expect(await isValidRpId(rpId, origin, webAuthnRelatedOriginsFeatureFlag, mockFetch)).toBe(
        false,
      );
    });

    it("should not be valid when subdomains are the same but effective domains of rpId and origin do not match", async () => {
      const rpId = "login.passwordless.dev";
      const origin = "https://login.bitwarden.com:1337";

      expect(await isValidRpId(rpId, origin, webAuthnRelatedOriginsFeatureFlag, mockFetch)).toBe(
        false,
      );
    });

    it("should not be valid when rpId and origin are both different TLD", async () => {
      const rpId = "bitwarden";
      const origin = "localhost";

      expect(await isValidRpId(rpId, origin, webAuthnRelatedOriginsFeatureFlag, mockFetch)).toBe(
        false,
      );
    });

    // Only allow localhost for rpId, need to properly investigate the implications of
    // adding support for ip-addresses and other TLDs
    it("should not be valid when rpId and origin are both the same TLD", async () => {
      const rpId = "bitwarden";
      const origin = "bitwarden";

      expect(await isValidRpId(rpId, origin, webAuthnRelatedOriginsFeatureFlag, mockFetch)).toBe(
        false,
      );
    });

    it("should not be valid when rpId and origin are ip-addresses", async () => {
      const rpId = "127.0.0.1";
      const origin = "127.0.0.1";

      expect(await isValidRpId(rpId, origin, webAuthnRelatedOriginsFeatureFlag, mockFetch)).toBe(
        false,
      );
    });

    it("should be valid when domains of rpId and origin are localhost", async () => {
      const rpId = "localhost";
      const origin = "https://localhost:8080";

      expect(await isValidRpId(rpId, origin, webAuthnRelatedOriginsFeatureFlag, mockFetch)).toBe(
        true,
      );
    });

    it("should be valid when domains of rpId and origin are the same", async () => {
      const rpId = "bitwarden.com";
      const origin = "https://bitwarden.com";

      expect(await isValidRpId(rpId, origin, webAuthnRelatedOriginsFeatureFlag, mockFetch)).toBe(
        true,
      );
    });

    it("should be valid when origin is a subdomain of rpId", async () => {
      const rpId = "bitwarden.com";
      const origin = "https://login.bitwarden.com:1337";

      expect(await isValidRpId(rpId, origin, webAuthnRelatedOriginsFeatureFlag, mockFetch)).toBe(
        true,
      );
    });

    it("should be valid when domains of rpId and origin are the same and they are both subdomains", async () => {
      const rpId = "login.bitwarden.com";
      const origin = "https://login.bitwarden.com:1337";

      expect(await isValidRpId(rpId, origin, webAuthnRelatedOriginsFeatureFlag, mockFetch)).toBe(
        true,
      );
    });

    it("should be valid when origin is a subdomain of rpId and they are both subdomains", async () => {
      const rpId = "login.bitwarden.com";
      const origin = "https://sub.login.bitwarden.com:1337";

      expect(await isValidRpId(rpId, origin, webAuthnRelatedOriginsFeatureFlag, mockFetch)).toBe(
        true,
      );
    });

    it("should not be valid for a partial match of a subdomain", async () => {
      const rpId = "accounts.example.com";
      const origin = "https://evilaccounts.example.com";

      expect(await isValidRpId(rpId, origin, webAuthnRelatedOriginsFeatureFlag)).toBe(false);
    });
  });

  describe("Related Origin Requests (ROR)", () => {
    // Helper to create a mock fetch response
    function mockRorResponse(origins: string[], status = 200, contentType = "application/json") {
      mockFetch.mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        headers: new Headers({ "content-type": contentType }),
        json: async () => ({ origins }),
      });
    }

    it("should not proceed with ROR check when  valid when feature flag disabled", async () => {
      const rpId = "accounts.meta.com";
      const origin = "https://accountscenter.facebook.com";

      mockRorResponse([origin, "https://www.facebook.com", "https://www.instagram.com"]);

      expect(await isValidRpId(rpId, origin, false, mockFetch)).toBe(false);
      expect(mockFetch).not.toHaveBeenCalledWith(
        `https://${rpId}/.well-known/webauthn`,
        expect.objectContaining({
          credentials: "omit",
          referrerPolicy: "no-referrer",
        }),
      );
    });

    webAuthnRelatedOriginsFeatureFlag = true;

    it("should be valid when origin is listed in .well-known/webauthn", async () => {
      const rpId = "accounts.meta.com";
      const origin = "https://accountscenter.facebook.com";

      mockRorResponse([origin, "https://www.facebook.com", "https://www.instagram.com"]);

      expect(await isValidRpId(rpId, origin, webAuthnRelatedOriginsFeatureFlag, mockFetch)).toBe(
        true,
      );
      expect(mockFetch).toHaveBeenCalledWith(
        `https://${rpId}/.well-known/webauthn`,
        expect.objectContaining({
          credentials: "omit",
          referrerPolicy: "no-referrer",
        }),
      );
    });

    it("should not be valid when origin is not listed in .well-known/webauthn", async () => {
      const rpId = "accounts.meta.com";
      const origin = "https://evil.com";

      mockRorResponse(["https://www.facebook.com", "https://www.instagram.com"]);

      expect(await isValidRpId(rpId, origin, webAuthnRelatedOriginsFeatureFlag, mockFetch)).toBe(
        false,
      );
    });

    it("should not be valid when .well-known/webauthn returns non-200 status", async () => {
      const rpId = "accounts.meta.com";
      const origin = "https://accountscenter.facebook.com";

      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers({ "content-type": "application/json" }),
      });

      expect(await isValidRpId(rpId, origin, webAuthnRelatedOriginsFeatureFlag, mockFetch)).toBe(
        false,
      );
    });

    it("should not be valid when .well-known/webauthn returns non-JSON content-type", async () => {
      const rpId = "accounts.meta.com";
      const origin = "https://accountscenter.facebook.com";

      mockRorResponse([origin], 200, "text/html");

      expect(await isValidRpId(rpId, origin, webAuthnRelatedOriginsFeatureFlag, mockFetch)).toBe(
        false,
      );
    });

    it("should not be valid when .well-known/webauthn response has no origins array", async () => {
      const rpId = "accounts.meta.com";
      const origin = "https://accountscenter.facebook.com";

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ notOrigins: "invalid" }),
      });

      expect(await isValidRpId(rpId, origin, webAuthnRelatedOriginsFeatureFlag, mockFetch)).toBe(
        false,
      );
    });

    it("should not be valid when .well-known/webauthn response has empty origins array", async () => {
      const rpId = "accounts.meta.com";
      const origin = "https://accountscenter.facebook.com";

      mockRorResponse([]);

      expect(await isValidRpId(rpId, origin, webAuthnRelatedOriginsFeatureFlag, mockFetch)).toBe(
        false,
      );
    });

    it("should not be valid when .well-known/webauthn response has non-string origins", async () => {
      const rpId = "accounts.meta.com";
      const origin = "https://accountscenter.facebook.com";

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ origins: [123, { url: origin }] }),
      });

      expect(await isValidRpId(rpId, origin, webAuthnRelatedOriginsFeatureFlag, mockFetch)).toBe(
        false,
      );
    });

    it("should not be valid when fetch throws an error", async () => {
      const rpId = "accounts.meta.com";
      const origin = "https://accountscenter.facebook.com";

      mockFetch.mockRejectedValue(new Error("Network error"));

      expect(await isValidRpId(rpId, origin, webAuthnRelatedOriginsFeatureFlag, mockFetch)).toBe(
        false,
      );
    });

    it("should not be valid when fetch times out", async () => {
      const rpId = "accounts.meta.com";
      const origin = "https://accountscenter.facebook.com";

      mockFetch.mockRejectedValue(new DOMException("The operation was aborted.", "AbortError"));

      expect(await isValidRpId(rpId, origin, webAuthnRelatedOriginsFeatureFlag, mockFetch)).toBe(
        false,
      );
    });

    it("should skip classic validation and use ROR when domains do not match", async () => {
      // This is the Facebook/Meta use case
      const rpId = "accounts.meta.com";
      const origin = "https://accountscenter.facebook.com";

      mockRorResponse([origin]);

      // Classic validation would fail (different domains), but ROR should succeed
      expect(await isValidRpId(rpId, origin, webAuthnRelatedOriginsFeatureFlag, mockFetch)).toBe(
        true,
      );
    });

    it("should not call ROR endpoint when classic validation succeeds", async () => {
      const rpId = "bitwarden.com";
      const origin = "https://bitwarden.com";

      // Classic validation succeeds, so ROR should not be called
      expect(await isValidRpId(rpId, origin, webAuthnRelatedOriginsFeatureFlag, mockFetch)).toBe(
        true,
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should require exact origin match (including port)", async () => {
      const rpId = "accounts.meta.com";
      const origin = "https://accountscenter.facebook.com:8443";

      // Only the non-port version is listed
      mockRorResponse(["https://accountscenter.facebook.com"]);

      expect(await isValidRpId(rpId, origin, webAuthnRelatedOriginsFeatureFlag, mockFetch)).toBe(
        false,
      );
    });

    it("should handle invalid URLs in origins array gracefully", async () => {
      const rpId = "accounts.meta.com";
      const origin = "https://accountscenter.facebook.com";

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          origins: ["not-a-valid-url", "://also-invalid", origin],
        }),
      });

      // Should still find the valid origin despite invalid entries
      expect(await isValidRpId(rpId, origin, webAuthnRelatedOriginsFeatureFlag, mockFetch)).toBe(
        true,
      );
    });

    it("should enforce max labels limit", async () => {
      const rpId = "example.com";
      const origin = "https://site6.com";

      // Create origins from 6 different eTLD+1 labels
      // Only the first 5 should be processed
      mockRorResponse([
        "https://site1.com",
        "https://site2.com",
        "https://site3.com",
        "https://site4.com",
        "https://site5.com",
        "https://site6.com", // This is the 6th label, should be skipped
      ]);

      // The origin is in the list but should be skipped due to max labels limit
      expect(await isValidRpId(rpId, origin, webAuthnRelatedOriginsFeatureFlag, mockFetch)).toBe(
        false,
      );
    });

    it("should allow multiple origins from the same eTLD+1", async () => {
      const rpId = "example.com";
      const origin = "https://sub2.facebook.com";

      // All these are from facebook.com (same eTLD+1), so they count as 1 label
      mockRorResponse([
        "https://www.facebook.com",
        "https://sub1.facebook.com",
        "https://sub2.facebook.com",
        "https://sub3.facebook.com",
      ]);

      expect(await isValidRpId(rpId, origin, webAuthnRelatedOriginsFeatureFlag, mockFetch)).toBe(
        true,
      );
    });
  });
});
