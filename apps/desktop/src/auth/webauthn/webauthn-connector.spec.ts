import type { webauthn } from "@bitwarden/desktop-napi";

import {
  buildConnectorRequest,
  connectorPageUrl,
  isValidWebVaultUrl,
  parseConnectorResponse,
} from "./webauthn-connector";

describe("webauthn-connector", () => {
  const request: webauthn.AssertionRequest = {
    origin: "https://vault.example.com",
    rpId: "example.com",
    challenge: new Uint8Array([1, 2, 3]),
    allowCredentials: [{ id: new Uint8Array([4, 5, 6]), transports: ["usb"] }],
    userVerification: "required",
    timeout: 60000,
    prf: { first: new Uint8Array([7]), second: new Uint8Array([8]) },
    appId: "https://vault.example.com/app-id.json",
  };

  describe("isValidWebVaultUrl", () => {
    it.each([
      ["https://vault.example.com", "https://vault.example.com"],
      ["https://vault.example.com/vault/", "https://vault.example.com"],
      ["http://localhost:8080", "http://localhost:8080"],
    ])("accepts %s for %s", (webVaultUrl, origin) => {
      expect(isValidWebVaultUrl(webVaultUrl, origin)).toBe(true);
    });

    it.each([
      ["https://evil.example.com", "https://vault.example.com"],
      ["http://vault.example.com", "http://vault.example.com"],
      ["not a url", "https://vault.example.com"],
    ])("rejects %s for %s", (webVaultUrl, origin) => {
      expect(isValidWebVaultUrl(webVaultUrl, origin)).toBe(false);
    });
  });

  describe("connectorPageUrl", () => {
    it.each(["https://vault.example.com/vault", "https://vault.example.com/vault/"])(
      "loads the desktop connector relative to %s",
      (webVaultUrl) => {
        expect(connectorPageUrl(webVaultUrl)).toBe(
          "https://vault.example.com/vault/webauthn-desktop-connector.html",
        );
      },
    );
  });

  describe("buildConnectorRequest", () => {
    it("encodes the options as WebAuthn JSON", () => {
      const options = JSON.parse(new TextDecoder().decode(buildConnectorRequest(request)));

      expect(options).toEqual({
        challenge: "AQID",
        rpId: "example.com",
        allowCredentials: [{ type: "public-key", id: "BAUG", transports: ["usb"] }],
        userVerification: "required",
        timeout: 60000,
        extensions: {
          appid: "https://vault.example.com/app-id.json",
          prf: { eval: { first: "Bw", second: "CA" } },
        },
      });
    });
  });

  describe("parseConnectorResponse", () => {
    function encode(response: unknown) {
      return new TextEncoder().encode(JSON.stringify(response));
    }

    it("converts the credential", () => {
      const credential = {
        rawId: "AQ",
        authenticatorAttachment: "cross-platform",
        extensions: { appid: true, prf: { results: { first: "Bg", second: "Bw" } } },
        response: {
          authenticatorData: "Ag",
          clientDataJson: "Aw",
          signature: "BA",
          userHandle: "BQ",
        },
      };

      expect(parseConnectorResponse(encode({ credential }), request)).toEqual({
        response: {
          credentialId: new Uint8Array([1]),
          authenticatorData: new Uint8Array([2]),
          clientDataJson: new Uint8Array([3]),
          signature: new Uint8Array([4]),
          userHandle: new Uint8Array([5]),
          authenticatorAttachment: "cross-platform",
          prf: { first: new Uint8Array([6]), second: new Uint8Array([7]) },
          appIdUsed: true,
        },
      });
    });

    it("omits the appid output when no app ID was requested", () => {
      const credential = {
        rawId: "AQ",
        response: { authenticatorData: "Ag", clientDataJson: "Aw", signature: "BA" },
      };

      const result = parseConnectorResponse(encode({ credential }), {
        ...request,
        appId: undefined,
      });

      expect(result.response?.appIdUsed).toBeUndefined();
      expect(result.response?.userHandle).toBeUndefined();
      expect(result.response?.prf).toBeUndefined();
    });

    it("returns the error with its DOMException name", () => {
      expect(
        parseConnectorResponse(
          encode({ error: { name: "SecurityError", message: "Denied" } }),
          request,
        ),
      ).toEqual({ error: { name: "SecurityError", message: "Denied" } });
    });

    it("defaults errors without a name to NotAllowedError", () => {
      expect(parseConnectorResponse(encode({ error: { message: "Denied" } }), request)).toEqual({
        error: { name: "NotAllowedError", message: "Denied" },
      });
    });

    it("does not include the response in the error for malformed JSON", () => {
      expect(() =>
        parseConnectorResponse(new TextEncoder().encode('{"secret": "PRF'), request),
      ).toThrow(new Error("Invalid WebAuthn connector response."));
    });
  });
});
