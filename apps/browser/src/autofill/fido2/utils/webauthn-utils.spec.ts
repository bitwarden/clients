import { WebauthnUtils } from "./webauthn-utils";

describe("WebauthnUtils", () => {
  describe("mapCredentialRequestOptions", () => {
    it("copies credential transports into a plain array", () => {
      const transports = new Proxy(["usb"] as AuthenticatorTransport[], {});
      const options: CredentialRequestOptions = {
        publicKey: {
          challenge: new Uint8Array([1, 2, 3]),
          allowCredentials: [
            {
              id: new Uint8Array([4, 5, 6]),
              type: "public-key",
              transports,
            },
          ],
        },
      };

      const result = WebauthnUtils.mapCredentialRequestOptions(options, true);
      const [allowedCredential] = result.allowedCredentials;

      expect(allowedCredential?.transports).toEqual(["usb"]);
      expect(allowedCredential?.transports).not.toBe(transports);
    });
  });
});
