import { FallbackRequestedError } from "@bitwarden/common/platform/abstractions/fido2/fido2-client.service.abstraction";

import { ProxyRequestContext, WebauthnJsonUtils } from "./webauthn-json-utils";

const context: ProxyRequestContext = {
  origin: "https://example.com",
  sameOriginWithAncestors: true,
};

describe("WebauthnJsonUtils", () => {
  describe("parseCreateRequest", () => {
    const baseCreate = {
      rp: { id: "example.com", name: "Example" },
      user: { id: "dXNlcg", name: "alice", displayName: "Alice" },
      challenge: "Y2hhbA",
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      authenticatorSelection: { userVerification: "required" as const },
      excludeCredentials: [
        { id: "ZXhjbA", type: "public-key" as const, transports: ["internal" as const] },
      ],
      extensions: { credProps: true },
      attestation: "none" as const,
      timeout: 60000,
    };

    it("maps every standard field through unchanged and injects origin from context", () => {
      const params = WebauthnJsonUtils.parseCreateRequest(JSON.stringify(baseCreate), context);

      expect(params).toEqual({
        origin: "https://example.com",
        sameOriginWithAncestors: true,
        attestation: "none",
        authenticatorSelection: {
          requireResidentKey: undefined,
          residentKey: undefined,
          userVerification: "required",
        },
        challenge: "Y2hhbA",
        excludeCredentials: [{ id: "ZXhjbA", transports: ["internal"], type: "public-key" }],
        extensions: { credProps: true },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }],
        rp: { id: "example.com", name: "Example" },
        user: { id: "dXNlcg", displayName: "Alice", name: "alice" },
        timeout: 60000,
        fallbackSupported: true,
      });
    });

    it("propagates sameOriginWithAncestors=false from context", () => {
      const params = WebauthnJsonUtils.parseCreateRequest(JSON.stringify(baseCreate), {
        origin: context.origin,
        sameOriginWithAncestors: false,
      });
      expect(params.sameOriginWithAncestors).toBe(false);
    });

    it("coerces string `alg` values and drops NaN entries", () => {
      const params = WebauthnJsonUtils.parseCreateRequest(
        JSON.stringify({
          ...baseCreate,
          pubKeyCredParams: [
            { type: "public-key", alg: "-7" },
            { type: "public-key", alg: "not-a-number" },
          ],
        }),
        context,
      );
      expect(params.pubKeyCredParams).toEqual([{ alg: -7, type: "public-key" }]);
    });

    it("throws when the envelope is missing required fields", () => {
      expect(() =>
        WebauthnJsonUtils.parseCreateRequest(
          JSON.stringify({ ...baseCreate, rp: undefined }),
          context,
        ),
      ).toThrow(/Malformed/);
      expect(() =>
        WebauthnJsonUtils.parseCreateRequest(
          JSON.stringify({ ...baseCreate, user: undefined }),
          context,
        ),
      ).toThrow(/Malformed/);
    });
  });

  describe("parseGetRequest", () => {
    const baseGet = {
      challenge: "Y2hhbA",
      timeout: 60000,
      rpId: "example.com",
      allowCredentials: [
        { id: "Y3JlZA", type: "public-key" as const, transports: ["usb" as const] },
      ],
      userVerification: "preferred" as const,
      mediation: "optional" as const,
    };

    it("maps every standard field through unchanged and injects context", () => {
      const params = WebauthnJsonUtils.parseGetRequest(JSON.stringify(baseGet), context);
      expect(params).toEqual({
        origin: "https://example.com",
        sameOriginWithAncestors: true,
        allowedCredentials: [{ id: "Y3JlZA", transports: ["usb"] }],
        challenge: "Y2hhbA",
        rpId: "example.com",
        userVerification: "preferred",
        timeout: 60000,
        mediation: "optional",
        fallbackSupported: true,
      });
    });

    it("returns an empty allowedCredentials when allowCredentials is missing", () => {
      const { allowCredentials: _omit, ...rest } = baseGet;
      void _omit;
      const params = WebauthnJsonUtils.parseGetRequest(JSON.stringify(rest), context);
      expect(params.allowedCredentials).toEqual([]);
    });

    it("throws when the envelope is missing a challenge", () => {
      expect(() =>
        WebauthnJsonUtils.parseGetRequest(
          JSON.stringify({ ...baseGet, challenge: undefined }),
          context,
        ),
      ).toThrow(/Malformed/);
    });
  });

  describe("serializeCreateResponse", () => {
    it("emits a RegistrationResponseJSON with base64url fields passed through", () => {
      const json = WebauthnJsonUtils.serializeCreateResponse({
        credentialId: "Y3JlZA",
        clientDataJSON: "Y2RhdGE",
        attestationObject: "YXR0",
        authData: "YXV0aA",
        publicKey: "cGs",
        publicKeyAlgorithm: -7,
        transports: ["internal"],
        extensions: { credProps: { rk: true } },
      });
      expect(JSON.parse(json)).toEqual({
        id: "Y3JlZA",
        rawId: "Y3JlZA",
        response: {
          clientDataJSON: "Y2RhdGE",
          authenticatorData: "YXV0aA",
          transports: ["internal"],
          publicKey: "cGs",
          publicKeyAlgorithm: -7,
          attestationObject: "YXR0",
        },
        authenticatorAttachment: "platform",
        clientExtensionResults: { credProps: { rk: true } },
        type: "public-key",
      });
    });
  });

  describe("serializeGetResponse", () => {
    it("emits an AuthenticationResponseJSON with base64url fields passed through", () => {
      const json = WebauthnJsonUtils.serializeGetResponse({
        credentialId: "Y3JlZA",
        clientDataJSON: "Y2RhdGE",
        authenticatorData: "YXV0aA",
        signature: "c2ln",
        userHandle: "dWg",
      });
      expect(JSON.parse(json)).toEqual({
        id: "Y3JlZA",
        rawId: "Y3JlZA",
        response: {
          clientDataJSON: "Y2RhdGE",
          authenticatorData: "YXV0aA",
          signature: "c2ln",
          userHandle: "dWg",
        },
        authenticatorAttachment: "platform",
        clientExtensionResults: {},
        type: "public-key",
      });
    });
  });

  describe("toProxyError", () => {
    it("uses the DOMException name and message when available", () => {
      const err = new DOMException("nope", "NotAllowedError");
      expect(WebauthnJsonUtils.toProxyError(err)).toEqual({
        name: "NotAllowedError",
        message: "nope",
      });
    });

    it("maps FallbackRequestedError to NotAllowedError so Chrome shows its native picker", () => {
      expect(WebauthnJsonUtils.toProxyError(new FallbackRequestedError())).toEqual({
        name: "NotAllowedError",
        message: "Fallback to browser requested",
      });
    });

    it("falls back to UnknownError for arbitrary errors", () => {
      expect(WebauthnJsonUtils.toProxyError(new Error("boom"))).toEqual({
        name: "UnknownError",
        message: "boom",
      });
      expect(WebauthnJsonUtils.toProxyError(null)).toEqual({
        name: "UnknownError",
        message: "",
      });
    });
  });

  describe("malformed input handling", () => {
    it("parseCreateRequest throws on non-JSON input", () => {
      expect(() => WebauthnJsonUtils.parseCreateRequest("not-json", context)).toThrow();
    });

    it("parseGetRequest throws on non-JSON input", () => {
      expect(() => WebauthnJsonUtils.parseGetRequest("not-json", context)).toThrow();
    });

    it("parseCreateRequest throws when rp is missing", () => {
      const malformed = JSON.stringify({
        user: { id: "u", name: "n", displayName: "d" },
        challenge: "c",
        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      });
      expect(() => WebauthnJsonUtils.parseCreateRequest(malformed, context)).toThrow(
        "Malformed proxy create request",
      );
    });

    it("parseCreateRequest throws when user is missing", () => {
      const malformed = JSON.stringify({
        rp: { id: "example.com", name: "Example" },
        challenge: "c",
        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      });
      expect(() => WebauthnJsonUtils.parseCreateRequest(malformed, context)).toThrow(
        "Malformed proxy create request",
      );
    });

    it("parseGetRequest throws when challenge is missing", () => {
      const malformed = JSON.stringify({ rpId: "example.com" });
      expect(() => WebauthnJsonUtils.parseGetRequest(malformed, context)).toThrow(
        "Malformed proxy get request",
      );
    });
  });
});
