import type { webauthn } from "@bitwarden/desktop-napi";

import { installNativeWebAuthn } from "./native-webauthn";

// jsdom does not implement WebAuthn, so provide the classes that the credential is created from.
class FakePublicKeyCredential {}
class FakeAuthenticatorAssertionResponse {}
(globalThis as any).PublicKeyCredential = FakePublicKeyCredential;
(globalThis as any).AuthenticatorAssertionResponse = FakeAuthenticatorAssertionResponse;

describe("installNativeWebAuthn", () => {
  let originalGet: jest.Mock;
  let getAssertion: jest.Mock<Promise<webauthn.GetAssertionResult>, [webauthn.AssertionRequest]>;
  let credentials: CredentialsContainer;

  const assertion: webauthn.AssertionResponse = {
    credentialId: new Uint8Array([1, 2, 3]),
    clientDataJson: new Uint8Array([4]),
    authenticatorData: new Uint8Array([5]),
    signature: new Uint8Array([6]),
    userHandle: new Uint8Array([7]),
    authenticatorAttachment: "platform",
    prf: { first: new Uint8Array([8]) },
  };

  function publicKey(
    overrides: Partial<PublicKeyCredentialRequestOptions> = {},
  ): PublicKeyCredentialRequestOptions {
    return { challenge: new Uint8Array([9, 9]), rpId: "example.com", ...overrides };
  }

  beforeEach(() => {
    originalGet = jest.fn().mockResolvedValue("original");
    getAssertion = jest.fn().mockResolvedValue({ response: assertion });
    credentials = { get: originalGet } as unknown as CredentialsContainer;
    const win = { navigator: { credentials } } as unknown as Window;
    installNativeWebAuthn(win, getAssertion);
  });

  it("passes through requests that are not for public key credentials", async () => {
    const result = await credentials.get({ password: true } as CredentialRequestOptions);

    expect(result).toBe("original");
    expect(getAssertion).not.toHaveBeenCalled();
  });

  it("converts the request options", async () => {
    const challenge = new Uint8Array([0, 1, 2, 3]);
    await credentials.get({
      publicKey: publicKey({
        // A view into part of a larger buffer.
        challenge: new Uint8Array(challenge.buffer, 1, 2),
        allowCredentials: [
          { id: new Uint8Array([1]).buffer, type: "public-key", transports: ["internal"] },
        ],
        userVerification: "required",
        timeout: 60000,
        extensions: { prf: { eval: { first: new Uint8Array([3]) } } } as any,
      }),
    });

    expect(getAssertion).toHaveBeenCalledWith({
      rpId: "example.com",
      challenge: new Uint8Array([1, 2]),
      allowCredentials: [{ id: new Uint8Array([1]), transports: ["internal"] }],
      userVerification: "required",
      timeout: 60000,
      prf: { first: new Uint8Array([3]), second: undefined },
    });
  });

  it("returns a credential that passes PublicKeyCredential checks", async () => {
    const credential = (await credentials.get({
      publicKey: publicKey(),
    })) as PublicKeyCredential;

    expect(credential).toBeInstanceOf(FakePublicKeyCredential);
    expect(credential.response).toBeInstanceOf(FakeAuthenticatorAssertionResponse);
    expect(credential.id).toBe("AQID");
    expect(new Uint8Array(credential.rawId)).toEqual(new Uint8Array([1, 2, 3]));
    expect(credential.type).toBe("public-key");
    expect(credential.authenticatorAttachment).toBe("platform");
    const response = credential.response as AuthenticatorAssertionResponse;
    expect(new Uint8Array(response.clientDataJSON)).toEqual(new Uint8Array([4]));
    expect(new Uint8Array(response.authenticatorData)).toEqual(new Uint8Array([5]));
    expect(new Uint8Array(response.signature)).toEqual(new Uint8Array([6]));
    expect(new Uint8Array(response.userHandle!)).toEqual(new Uint8Array([7]));
  });

  it("returns PRF results only when PRF was requested", async () => {
    const withPrf = (await credentials.get({
      publicKey: publicKey({
        extensions: { prf: { eval: { first: new Uint8Array([1]) } } } as any,
      }),
    })) as PublicKeyCredential;
    const withoutPrf = (await credentials.get({ publicKey: publicKey() })) as PublicKeyCredential;

    const prf = (withPrf.getClientExtensionResults() as any).prf;
    expect(new Uint8Array(prf.results.first)).toEqual(new Uint8Array([8]));
    expect(withoutPrf.getClientExtensionResults()).toEqual({});
  });

  it("returns an empty PRF result when PRF was requested but no results were returned", async () => {
    getAssertion.mockResolvedValue({ response: { ...assertion, prf: undefined } });

    const credential = (await credentials.get({
      publicKey: publicKey({
        extensions: { prf: { eval: { first: new Uint8Array([1]) } } } as any,
      }),
    })) as PublicKeyCredential;

    expect(credential.getClientExtensionResults()).toEqual({ prf: {} });
  });

  it("serializes to JSON as WebAuthn specifies", async () => {
    const credential = (await credentials.get({
      publicKey: publicKey({
        extensions: { prf: { eval: { first: new Uint8Array([1]) } } } as any,
      }),
    })) as PublicKeyCredential;

    expect(JSON.parse(JSON.stringify(credential))).toEqual({
      id: "AQID",
      rawId: "AQID",
      type: "public-key",
      authenticatorAttachment: "platform",
      response: {
        clientDataJSON: "BA",
        authenticatorData: "BQ",
        signature: "Bg",
        userHandle: "Bw",
      },
      clientExtensionResults: { prf: { results: { first: "CA" } } },
    });
  });

  it("throws the platform error as a DOMException", async () => {
    getAssertion.mockResolvedValue({ error: { name: "NotAllowedError", message: "Cancelled" } });

    const result = credentials.get({ publicKey: publicKey() });

    await expect(result).rejects.toThrow(DOMException);
    await expect(result).rejects.toMatchObject({ name: "NotAllowedError", message: "Cancelled" });
  });
});
