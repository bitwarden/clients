import { serialize } from "v8";

import { WebauthnUtils } from "./webauthn-utils";

// jsdom does not expose structuredClone. Node's v8.serialize uses the same
// structured-clone algorithm, so it throws DataCloneError on the same inputs.
const assertStructuredCloneable = (value: unknown) => serialize(value);

const challenge = new Uint8Array([1, 2, 3, 4]).buffer;
const credentialId = new Uint8Array([9, 9, 9]).buffer;
const userId = new Uint8Array([5, 5, 5]).buffer;

// Reactive frameworks wrap caller inputs in a Proxy, which window.postMessage cannot clone.
describe("WebauthnUtils", () => {
  describe("mapCredentialRequestOptions", () => {
    it("produces a structured-cloneable result when transports is a Proxy", () => {
      const transportsProxy = new Proxy(["usb", "nfc"], {}) as AuthenticatorTransport[];

      const options: CredentialRequestOptions = {
        publicKey: {
          challenge,
          allowCredentials: [
            {
              id: credentialId,
              type: "public-key",
              transports: transportsProxy,
            },
          ],
        },
      };

      const mapped = WebauthnUtils.mapCredentialRequestOptions(options, false);

      expect(() => assertStructuredCloneable(mapped)).not.toThrow();
    });
  });

  describe("mapCredentialCreationOptions", () => {
    it("produces a structured-cloneable result when excludeCredentials transports is a Proxy", () => {
      const transportsProxy = new Proxy(["usb"], {}) as AuthenticatorTransport[];

      const options: CredentialCreationOptions = {
        publicKey: {
          challenge,
          rp: { id: "example.com", name: "Example" },
          user: { id: userId, name: "jdoe", displayName: "J. Doe" },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }],
          excludeCredentials: [
            {
              id: credentialId,
              type: "public-key",
              transports: transportsProxy,
            },
          ],
        },
      };

      const mapped = WebauthnUtils.mapCredentialCreationOptions(options, false);

      expect(() => assertStructuredCloneable(mapped)).not.toThrow();
    });
  });
});
