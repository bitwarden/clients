import {
  createAssertCredentialResultMock,
  createCreateCredentialResultMock,
  createCredentialCreationOptionsMock,
  createCredentialRequestOptionsMock,
  setupMockedWebAuthnSupport,
} from "../../../autofill/spec/fido2-testing-utils";
import { WebauthnUtils } from "../webauthn-utils";

import { MessageType } from "./messaging/message";
import { Messenger } from "./messaging/messenger";

let messenger: Messenger;
jest.mock("./messaging/messenger", () => {
  return {
    Messenger: class extends jest.requireActual("./messaging/messenger").Messenger {
      static forDOMCommunication: any = jest.fn((window) => {
        const windowOrigin = window.location.origin;

        messenger = new Messenger({
          postMessage: (message, port) => window.postMessage(message, windowOrigin, [port]),
          addEventListener: (listener) => window.addEventListener("message", listener),
          removeEventListener: (listener) => window.removeEventListener("message", listener),
        });
        messenger.destroy = jest.fn();
        return messenger;
      });
    },
  };
});
jest.mock("../webauthn-utils");

describe("Fido2 page script with native WebAuthn support", () => {
  const mockCredentialCreationOptions = createCredentialCreationOptionsMock();
  const mockCreateCredentialsResult = createCreateCredentialResultMock();
  const mockCredentialRequestOptions = createCredentialRequestOptionsMock();
  const mockCredentialAssertResult = createAssertCredentialResultMock();
  setupMockedWebAuthnSupport();

  require("./page-script");

  afterAll(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe("creating WebAuthn credentials", () => {
    beforeEach(() => {
      messenger.request = jest.fn().mockResolvedValue({
        type: MessageType.CredentialCreationResponse,
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

    it("creates and returns a WebAuthn credential", async () => {
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
        type: MessageType.CredentialGetResponse,
        result: mockCredentialAssertResult,
      });
    });

    it("falls back to the default browser credentials API if an error occurs", async () => {
      window.top.document.hasFocus = jest.fn().mockReturnValue(true);
      messenger.request = jest.fn().mockRejectedValue({ fallbackRequested: true });

      try {
        await navigator.credentials.get(mockCredentialRequestOptions);
        expect("This will fail the test").toBe(true);
      } catch {
        expect(WebauthnUtils.mapCredentialAssertResult).not.toHaveBeenCalled();
      }
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
  });

  describe("destroy", () => {
    it("should ", async () => {
      jest.spyOn(globalThis.top, "removeEventListener");
      const SENDER = "bitwarden-webauthn";
      void messenger.handler({ type: MessageType.DisconnectRequest, SENDER, senderId: "1" });

      expect(globalThis.top.removeEventListener).toHaveBeenCalledWith("focus", undefined);
      expect(messenger.destroy).toHaveBeenCalled();
    });
  });
});
