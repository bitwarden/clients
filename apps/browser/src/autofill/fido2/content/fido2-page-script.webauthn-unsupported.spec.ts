import {
  createAssertCredentialResultMock,
  createCreateCredentialResultMock,
  createCredentialCreationOptionsMock,
  createCredentialRequestOptionsMock,
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
    href: "https://localhost",
    origin: "https://localhost",
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

describe("Fido2 page script without native WebAuthn support", () => {
  (jest.spyOn(globalThis, "document", "get") as jest.Mock).mockImplementation(
    () => mockGlobalThisDocument,
  );

  const mockCredentialCreationOptions = createCredentialCreationOptionsMock();
  const mockCreateCredentialsResult = createCreateCredentialResultMock();
  const mockCredentialRequestOptions = createCredentialRequestOptionsMock();
  const mockCredentialAssertResult = createAssertCredentialResultMock();
  // FIXME: Remove when updating file. Eslint update
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("./fido2-page-script");

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

    it("creates and returns a WebAuthn credential", async () => {
      await navigator.credentials.create(mockCredentialCreationOptions);

      expect(WebauthnUtils.mapCredentialCreationOptions).toHaveBeenCalledWith(
        mockCredentialCreationOptions,
        false,
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

    it("gets and returns the WebAuthn credentials", async () => {
      await navigator.credentials.get(mockCredentialRequestOptions);

      expect(WebauthnUtils.mapCredentialRequestOptions).toHaveBeenCalledWith(
        mockCredentialRequestOptions,
        false,
      );
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
});
