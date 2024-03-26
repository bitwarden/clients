import { mock } from "jest-mock-extended";

import { CreateCredentialResult } from "@bitwarden/common/vault/abstractions/fido2/fido2-client.service.abstraction";

import { createPortSpyMock } from "../../../autofill/spec/autofill-mocks";
import { triggerPortOnDisconnectEvent } from "../../../autofill/spec/testing-utils";
import { Fido2PortName } from "../enums/fido2-port-name.enum";

import { InsecureCreateCredentialParams, MessageType } from "./messaging/message";
import { MessageWithMetadata, Messenger } from "./messaging/messenger";

jest.mock("../../../autofill/utils", () => ({
  sendExtensionMessage: jest.fn((command, options) => {
    return chrome.runtime.sendMessage(Object.assign({ command }, options));
  }),
}));

describe("Fido2 Content Script", () => {
  let messenger: Messenger;
  const messengerForDOMCommunicationSpy = jest
    .spyOn(Messenger, "forDOMCommunication")
    .mockImplementation((window) => {
      const windowOrigin = window.location.origin;

      messenger = new Messenger({
        postMessage: (message, port) => window.postMessage(message, windowOrigin, [port]),
        addEventListener: (listener) => window.addEventListener("message", listener),
        removeEventListener: (listener) => window.removeEventListener("message", listener),
      });
      messenger.destroy = jest.fn();
      return messenger;
    });
  const portSpy: chrome.runtime.Port = createPortSpyMock(Fido2PortName.InjectedScript);
  chrome.runtime.connect = jest.fn(() => portSpy);

  afterEach(() => {
    Object.defineProperty(document, "contentType", {
      value: "text/html",
      writable: true,
    });

    jest.clearAllMocks();
    jest.resetModules();
  });

  it("destroys the messenger when the port is disconnected", () => {
    require("./content-script");

    triggerPortOnDisconnectEvent(portSpy);

    expect(messenger.destroy).toHaveBeenCalled();
  });

  it("handles a FIDO2 credential creation request message", async () => {
    const message = mock<MessageWithMetadata>({
      type: MessageType.CredentialCreationRequest,
      data: mock<InsecureCreateCredentialParams>(),
    });
    const mockResult = { credentialId: "mock" } as CreateCredentialResult;
    jest.spyOn(chrome.runtime, "sendMessage").mockResolvedValue(mockResult);

    require("./content-script");

    const response = await messenger.handler!(message, new AbortController());

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      command: "fido2RegisterCredentialRequest",
      data: expect.objectContaining({
        origin: globalThis.location.origin,
        sameOriginWithAncestors: true,
      }),
      requestId: expect.any(String),
    });
    expect(response).toEqual({
      type: MessageType.CredentialCreationResponse,
      result: mockResult,
    });
  });

  it("handles a FIDO2 credential get request message", async () => {
    const message = mock<MessageWithMetadata>({
      type: MessageType.CredentialGetRequest,
      data: mock<InsecureCreateCredentialParams>(),
    });

    require("./content-script");

    await messenger.handler!(message, new AbortController());

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      command: "fido2GetCredentialRequest",
      data: expect.objectContaining({
        origin: globalThis.location.origin,
        sameOriginWithAncestors: true,
      }),
      requestId: expect.any(String),
    });
  });

  it("removes the abort handler when the FIDO2 request is complete", async () => {
    const message = mock<MessageWithMetadata>({
      type: MessageType.CredentialCreationRequest,
      data: mock<InsecureCreateCredentialParams>(),
    });
    const abortController = new AbortController();
    const abortSpy = jest.spyOn(abortController.signal, "removeEventListener");

    require("./content-script");

    await messenger.handler!(message, abortController);

    expect(abortSpy).toHaveBeenCalled();
  });

  it("sends an extension message to abort the FIDO2 request when the abort controller is signaled", async () => {
    const message = mock<MessageWithMetadata>({
      type: MessageType.CredentialCreationRequest,
      data: mock<InsecureCreateCredentialParams>(),
    });
    const abortController = new AbortController();
    const abortSpy = jest.spyOn(abortController.signal, "addEventListener");
    jest
      .spyOn(chrome.runtime, "sendMessage")
      .mockImplementationOnce(async (extensionId: string, message: unknown, options: any) => {
        abortController.abort();
      });

    require("./content-script");

    await messenger.handler!(message, abortController);

    expect(abortSpy).toHaveBeenCalled();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      command: "fido2AbortRequest",
      abortedRequestId: expect.any(String),
    });
  });

  it("rejects credential requests and returns an error result", async () => {
    const errorMessage = "Test error";
    const message = mock<MessageWithMetadata>({
      type: MessageType.CredentialCreationRequest,
      data: mock<InsecureCreateCredentialParams>(),
    });
    const abortController = new AbortController();
    jest.spyOn(chrome.runtime, "sendMessage").mockResolvedValue({ error: errorMessage });

    require("./content-script");

    try {
      await messenger.handler!(message, abortController);
      expect(false).toBe("This test will fail if the promise resolves");
    } catch (error) {
      expect(error).toEqual(errorMessage);
    }
  });

  it("skips initializing the content script if the document content type is not 'text/html'", () => {
    Object.defineProperty(document, "contentType", {
      value: "application/json",
      writable: true,
    });

    require("./content-script");

    expect(messengerForDOMCommunicationSpy).not.toHaveBeenCalled();
  });
});
