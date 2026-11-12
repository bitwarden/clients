/**
 * Tests for the desktop app's WebAuthn connector (apps/web/src/connectors/webauthn-desktop.ts).
 *
 * The SDK's `WebConnectorResponder`, which reads the request and encrypts the response, is mocked;
 * the encryption is tested in sdk-internal's `bitwarden-web-connector`.
 */

jest.mock("./common", () => ({
  ...jest.requireActual("./common"),
  navigateToUrl: jest.fn(),
}));

jest.mock("./translation.service", () => ({
  TranslationService: jest.fn().mockImplementation(() => ({
    init: jest.fn().mockResolvedValue(undefined),
    t: (key: string) => key,
  })),
}));

jest.mock("@bitwarden/assets/svg", () => ({
  BackgroundLeftIllustration: { svg: "" },
  BackgroundRightIllustration: { svg: "" },
  BitwardenLogo: { svg: "" },
  SecurityKeyIcon: { svg: "" },
}));

jest.mock("@bitwarden/sdk-internal", () => ({
  init: jest.fn(),
  Connector: { WebAuthnAssertion: 0 },
  WebConnectorResponder: { read_request: jest.fn() },
}));

jest.mock("@bitwarden/sdk-internal/bitwarden_wasm_internal_bg.wasm", () => ({}), {
  virtual: true,
});

import * as sdk from "@bitwarden/sdk-internal";

import { navigateToUrl } from "./common";
import { init, isFramed } from "./webauthn-desktop";

describe("desktop WebAuthn connector", () => {
  const callbackUrl = "bitwarden://webauthn-callback#state=abc&response=def";
  const options = {
    challenge: "dGVzdC1jaGFsbGVuZ2U",
    rpId: "example.com",
    userVerification: "required",
    extensions: { prf: { eval: { first: "AQID", second: "BAUG" } } },
  };
  let encryptResponse: jest.Mock;
  let credentialsGet: jest.Mock;

  beforeEach(() => {
    document.body.innerHTML = `
      <h1 id="webauthn-header"></h1>
      <button id="webauthn-button"></button>
    `;
    window.location.hash = "state=abc&callback=scheme&request=ghi";
    encryptResponse = jest.fn().mockReturnValue(callbackUrl);
    (sdk.WebConnectorResponder.read_request as jest.Mock).mockReturnValue({
      request: () => new TextEncoder().encode(JSON.stringify(options)),
      encrypt_response: encryptResponse,
    });
    credentialsGet = jest.fn().mockResolvedValue(mockPasskeyCredential());
    Object.defineProperty(navigator, "credentials", {
      value: { get: credentialsGet },
      configurable: true,
    });
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36",
      configurable: true,
    });
    jest.spyOn(document, "hasFocus").mockReturnValue(true);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  function mockPasskeyCredential(): PublicKeyCredential {
    return {
      id: "AQID",
      rawId: new Uint8Array([1, 2, 3]).buffer,
      type: "public-key",
      authenticatorAttachment: "platform",
      getClientExtensionResults: () => ({
        prf: { results: { first: new Uint8Array([7, 8, 9]).buffer } },
      }),
      response: {
        authenticatorData: new Uint8Array([4]).buffer,
        clientDataJSON: new Uint8Array([5]).buffer,
        signature: new Uint8Array([6]).buffer,
        userHandle: new Uint8Array([10]).buffer,
      },
    } as unknown as PublicKeyCredential;
  }

  /** Lets the WebAuthn request and the response settle. */
  async function settle() {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  function encryptedResponse() {
    return JSON.parse(Buffer.from(encryptResponse.mock.calls[0][0]).toString("utf8"));
  }

  function header() {
    return document.getElementById("webauthn-header")!.innerText;
  }

  function button() {
    return document.getElementById("webauthn-button")!;
  }

  it("reads the request from the fragment for the WebAuthn assertion connector", async () => {
    await init();

    expect(sdk.WebConnectorResponder.read_request).toHaveBeenCalledWith(
      sdk.Connector.WebAuthnAssertion,
      "#state=abc&callback=scheme&request=ghi",
    );
  });

  it("requests an assertion with the decoded options, including PRF inputs", async () => {
    await init();

    const { publicKey } = credentialsGet.mock.calls[0][0];
    expect(publicKey.rpId).toBe("example.com");
    expect(publicKey.allowCredentials).toBeUndefined();
    expect(Array.from(publicKey.extensions.prf.eval.first)).toEqual([1, 2, 3]);
    expect(Array.from(publicKey.extensions.prf.eval.second)).toEqual([4, 5, 6]);
  });

  it("shows its own text, not text from the request", async () => {
    await init();

    expect(header()).toBe("useYourPasskeyOrSecurityKeyToContinue");
  });

  it("returns the credential with the user handle, attachment and PRF results", async () => {
    await init();
    await settle();

    expect(encryptedResponse()).toEqual({
      credential: expect.objectContaining({
        rawId: "AQID",
        authenticatorAttachment: "platform",
        extensions: { prf: { results: { first: "BwgJ" } } },
        response: {
          authenticatorData: "BA",
          clientDataJson: "BQ",
          signature: "Bg",
          userHandle: "Cg",
        },
      }),
    });
    expect(navigateToUrl).toHaveBeenCalledWith(callbackUrl);
  });

  it("offers to return to the app in case the navigation is blocked", async () => {
    await init();
    await settle();

    expect(button().innerText).toBe("returnToBitwarden");
    button().click();
    expect(navigateToUrl).toHaveBeenCalledTimes(2);
    expect(navigateToUrl).toHaveBeenLastCalledWith(callbackUrl);
  });

  it("returns the error with its DOMException name", async () => {
    const error = new Error("The operation was cancelled.");
    error.name = "NotAllowedError";
    credentialsGet.mockRejectedValue(error);

    await init();
    await settle();

    expect(encryptedResponse()).toEqual({
      error: { name: "NotAllowedError", message: "The operation was cancelled." },
    });
    expect(navigateToUrl).toHaveBeenCalledWith(callbackUrl);
  });

  it("waits for the user in Safari, which blocks requests the user didn't start", async () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 Version/18.0 Safari/605.1.15",
      configurable: true,
    });

    await init();
    expect(credentialsGet).not.toHaveBeenCalled();

    button().click();
    expect(credentialsGet).toHaveBeenCalledTimes(1);
  });

  it("waits for the page to be focused, e.g. when opened in a background tab", async () => {
    jest.spyOn(document, "hasFocus").mockReturnValue(false);

    await init();
    expect(credentialsGet).not.toHaveBeenCalled();

    window.dispatchEvent(new Event("focus"));
    expect(credentialsGet).toHaveBeenCalledTimes(1);
  });

  it("lets the user start the request again, without returning the abandoned one", async () => {
    // The first request never shows a prompt, until it is aborted.
    credentialsGet.mockImplementationOnce(
      ({ signal }: CredentialRequestOptions) =>
        new Promise((_resolve, reject) =>
          signal!.addEventListener("abort", () => {
            const abort = new Error("The operation was aborted.");
            abort.name = "AbortError";
            reject(abort);
          }),
        ),
    );

    await init();
    expect(button().innerText).toBe("continue");
    button().click();
    await settle();

    expect(credentialsGet).toHaveBeenCalledTimes(2);
    expect(credentialsGet.mock.calls[0][0].signal.aborted).toBe(true);
    expect(encryptResponse).toHaveBeenCalledTimes(1);
    expect(encryptedResponse()).toHaveProperty("credential");
  });

  it("shows an error and makes no request when the request is invalid", async () => {
    (sdk.WebConnectorResponder.read_request as jest.Mock).mockImplementation(() => {
      throw new Error("Missing or malformed parameter: request");
    });

    await init();
    await settle();

    expect(credentialsGet).not.toHaveBeenCalled();
    expect(navigateToUrl).not.toHaveBeenCalled();
    expect(header()).toBe("passkeyAuthenticationFailed");
    expect(button().hidden).toBe(true);
  });

  it("shows an error and returns nothing when the response can't be encrypted", async () => {
    encryptResponse.mockImplementation(() => {
      throw new Error("Handshake failed");
    });

    await init();
    await settle();

    expect(navigateToUrl).not.toHaveBeenCalled();
    expect(header()).toBe("passkeyAuthenticationFailed");
  });

  describe("isFramed", () => {
    it("is false in the top-level window", () => {
      const win = {} as Window;
      expect(isFramed({ self: win, top: win })).toBe(false);
    });

    it("is true in a frame", () => {
      expect(isFramed({ self: {} as Window, top: {} as Window })).toBe(true);
    });

    it("is true in a frame whose top-level window is cross-origin", () => {
      expect(isFramed({ self: {} as Window, top: null })).toBe(true);
    });
  });
});
