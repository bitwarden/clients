import {
  createAssertCredentialResultMock,
  createCreateCredentialResultMock,
  createCredentialCreationOptionsMock,
  createCredentialRequestOptionsMock,
  setupMockedWebAuthnSupport,
} from "../../../autofill/spec/fido2-testing-utils";
import { WebauthnUtils } from "../utils/webauthn-utils";

import { MessageTypes } from "./messaging/message";
import { Messenger } from "./messaging/messenger";

const originalGlobalThis = globalThis;
const mockGlobalThisDocument = {
  ...originalGlobalThis.document,
  contentType: "text/html",
  location: {
    ...originalGlobalThis.document.location,
    href: "https://bitwarden.com",
    origin: "https://bitwarden.com",
    hostname: "bitwarden.com",
    protocol: "https:",
  },
};

let messenger: Messenger;
jest.mock("./messaging/messenger", () => {
  return {
    Messenger: class extends jest.requireActual("./messaging/messenger").Messenger {
      static forDOMCommunication: any = jest.fn((context) => {
        const windowOrigin = context.location.origin;

        messenger = new Messenger({
          postMessage: (message, port) => context.postMessage(message, windowOrigin, [port]),
          addEventListener: (listener) => context.addEventListener("message", listener),
          removeEventListener: (listener) => context.removeEventListener("message", listener),
        });
        messenger.destroy = jest.fn();
        return messenger;
      });
    },
  };
});
jest.mock("../utils/webauthn-utils");

describe("Fido2 page script with native WebAuthn support", () => {
  (jest.spyOn(globalThis, "document", "get") as jest.Mock).mockImplementation(
    () => mockGlobalThisDocument,
  );

  const mockCredentialCreationOptions = createCredentialCreationOptionsMock();
  const mockCreateCredentialsResult = createCreateCredentialResultMock();
  const mockCredentialRequestOptions = createCredentialRequestOptionsMock();
  const mockCredentialAssertResult = createAssertCredentialResultMock();
  setupMockedWebAuthnSupport();

  beforeAll(() => {
    // FIXME: Remove when updating file. Eslint update
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("./fido2-page-script");
  });

  afterEach(() => {
    jest.resetModules();
  });

  afterAll(() => {
    jest.clearAllMocks();
  });

  describe("creating WebAuthn credentials", () => {
    beforeEach(() => {
      messenger.request = jest.fn().mockResolvedValue({
        type: MessageTypes.CredentialCreationResponse,
        result: mockCreateCredentialsResult,
      });
    });

    it("falls back to the default browser credentials API if an error occurs", async () => {
      window.top.document.hasFocus = jest.fn().mockReturnValue(true);
      messenger.request = jest.fn().mockRejectedValue({ fallbackRequested: true });

      try {
        await navigator.credentials.create(mockCredentialCreationOptions);
        expect("This will fail the test").toBe(true);
      } catch {
        expect(WebauthnUtils.mapCredentialRegistrationResult).not.toHaveBeenCalled();
      }
    });

    it("creates and returns a WebAuthn credential when the navigator API is called to create credentials", async () => {
      await navigator.credentials.create(mockCredentialCreationOptions);

      expect(WebauthnUtils.mapCredentialCreationOptions).toHaveBeenCalledWith(
        mockCredentialCreationOptions,
        true,
      );
      expect(WebauthnUtils.mapCredentialRegistrationResult).toHaveBeenCalledWith(
        mockCreateCredentialsResult,
      );
    });
  });

  describe("get WebAuthn credentials", () => {
    beforeEach(() => {
      messenger.request = jest.fn().mockResolvedValue({
        type: MessageTypes.CredentialGetResponse,
        result: mockCredentialAssertResult,
      });
    });

    it("falls back to the default browser credentials API when an error occurs", async () => {
      window.top.document.hasFocus = jest.fn().mockReturnValue(true);
      messenger.request = jest.fn().mockRejectedValue({ fallbackRequested: true });

      const returnValue = await navigator.credentials.get(mockCredentialRequestOptions);

      expect(returnValue).toBeDefined();
      expect(WebauthnUtils.mapCredentialAssertResult).not.toHaveBeenCalled();
    });

    it("gets and returns the WebAuthn credentials", async () => {
      await navigator.credentials.get(mockCredentialRequestOptions);

      expect(WebauthnUtils.mapCredentialRequestOptions).toHaveBeenCalledWith(
        mockCredentialRequestOptions,
        true,
      );
      expect(WebauthnUtils.mapCredentialAssertResult).toHaveBeenCalledWith(
        mockCredentialAssertResult,
      );
    });

    it("initiates a conditional mediated webauth request", async () => {
      mockCredentialRequestOptions.mediation = "conditional";
      mockCredentialRequestOptions.signal = new AbortController().signal;

      await navigator.credentials.get(mockCredentialRequestOptions);

      expect(WebauthnUtils.mapCredentialAssertResult).toHaveBeenCalledWith(
        mockCredentialAssertResult,
      );
    });
  });

  describe("destroy", () => {
    it("should destroy the message listener when receiving a disconnect request", async () => {
      jest.spyOn(globalThis.top, "removeEventListener");
      const SENDER = "bitwarden-webauthn";
      void messenger.handler({ type: MessageTypes.DisconnectRequest, SENDER, senderId: "1" });

      expect(globalThis.top.removeEventListener).toHaveBeenCalledWith("focus", undefined);
      expect(messenger.destroy).toHaveBeenCalled();
    });
  });

  describe("content script execution", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.resetModules();
    });

    it("skips initializing if the document content type is not 'text/html'", () => {
      jest.spyOn(Messenger, "forDOMCommunication");

      (jest.spyOn(globalThis, "document", "get") as jest.Mock).mockImplementation(() => ({
        ...mockGlobalThisDocument,
        contentType: "json/application",
      }));

      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("./fido2-content-script");

      expect(Messenger.forDOMCommunication).not.toHaveBeenCalled();
    });

    it("skips initializing if the document location protocol is not 'https'", () => {
      jest.spyOn(Messenger, "forDOMCommunication");

      (jest.spyOn(globalThis, "document", "get") as jest.Mock).mockImplementation(() => ({
        ...mockGlobalThisDocument,
        location: {
          ...mockGlobalThisDocument.location,
          href: "http://bitwarden.com",
          origin: "http://bitwarden.com",
          protocol: "http:",
        },
      }));

      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("./fido2-content-script");

      expect(Messenger.forDOMCommunication).not.toHaveBeenCalled();
    });
  });
});
