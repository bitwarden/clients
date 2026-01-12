import { mock, MockProxy } from "jest-mock-extended";

import { CreateCredentialResult } from "@bitwarden/common/platform/abstractions/fido2/fido2-client.service.abstraction";

import { createPortSpyMock } from "../../../autofill/spec/autofill-mocks";
import { triggerPortOnDisconnectEvent } from "../../../autofill/spec/testing-utils";
import { Fido2PortName } from "../enums/fido2-port-name.enum";

import { InsecureCreateCredentialParams, MessageTypes } from "./messaging/message";
import { MessageWithMetadata, Messenger } from "./messaging/messenger";

jest.mock("../../../autofill/utils", () => ({
  sendExtensionMessage: jest.fn((command, options) => {
    return chrome.runtime.sendMessage(Object.assign({ command }, options));
  }),
}));

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

describe("Fido2 Content Script", () => {
  beforeAll(() => {
    (jest.spyOn(globalThis, "document", "get") as jest.Mock).mockImplementation(
      () => mockGlobalThisDocument,
    );
  });

  afterEach(() => {
    jest.resetModules();
  });

  afterAll(() => {
    jest.clearAllMocks();
  });

  let messenger: Messenger;
  const messengerForDOMCommunicationSpy = jest
    .spyOn(Messenger, "forDOMCommunication")
    .mockImplementation((context) => {
      const windowOrigin = context.location.origin;

      messenger = new Messenger({
        postMessage: (message, port) => context.postMessage(message, windowOrigin, [port]),
        addEventListener: (listener) => context.addEventListener("message", listener),
        removeEventListener: (listener) => context.removeEventListener("message", listener),
      });
      messenger.destroy = jest.fn();
      return messenger;
    });
  const portSpy: MockProxy<chrome.runtime.Port> = createPortSpyMock(Fido2PortName.InjectedScript);
  chrome.runtime.connect = jest.fn(() => portSpy);

  it("destroys the messenger when the port is disconnected", () => {
    // FIXME: Remove when updating file. Eslint update
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("./fido2-content-script");

    triggerPortOnDisconnectEvent(portSpy);

    expect(messenger.destroy).toHaveBeenCalled();
  });

  it("handles a FIDO2 credential creation request message from the window message listener, formats the message and sends the formatted message to the extension background", async () => {
    const message = mock<MessageWithMetadata>({
      type: MessageTypes.CredentialCreationRequest,
      data: mock<InsecureCreateCredentialParams>(),
    });
    const mockResult = { credentialId: "mock" } as CreateCredentialResult;
    (jest.spyOn(chrome.runtime, "sendMessage") as jest.Mock).mockResolvedValue(mockResult);

    // FIXME: Remove when updating file. Eslint update
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("./fido2-content-script");

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
      type: MessageTypes.CredentialCreationResponse,
      result: mockResult,
    });
  });

  it("handles a FIDO2 credential get request message from the window message listener, formats the message and sends the formatted message to the extension background", async () => {
    const message = mock<MessageWithMetadata>({
      type: MessageTypes.CredentialGetRequest,
      data: mock<InsecureCreateCredentialParams>(),
    });

    // FIXME: Remove when updating file. Eslint update
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("./fido2-content-script");

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
      type: MessageTypes.CredentialCreationRequest,
      data: mock<InsecureCreateCredentialParams>(),
    });
    const abortController = new AbortController();
    const abortSpy = jest.spyOn(abortController.signal, "removeEventListener");

    // FIXME: Remove when updating file. Eslint update
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("./fido2-content-script");

    await messenger.handler!(message, abortController);

    expect(abortSpy).toHaveBeenCalled();
  });

  it("sends an extension message to abort the FIDO2 request when the abort controller is signaled", async () => {
    const message = mock<MessageWithMetadata>({
      type: MessageTypes.CredentialCreationRequest,
      data: mock<InsecureCreateCredentialParams>(),
    });
    const abortController = new AbortController();
    const abortSpy = jest.spyOn(abortController.signal, "addEventListener");
    jest.spyOn(chrome.runtime, "sendMessage").mockImplementationOnce(async () => {
      abortController.abort();
    });

    // FIXME: Remove when updating file. Eslint update
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("./fido2-content-script");

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
      type: MessageTypes.CredentialCreationRequest,
      data: mock<InsecureCreateCredentialParams>(),
    });
    const abortController = new AbortController();
    (jest.spyOn(chrome.runtime, "sendMessage") as jest.Mock).mockResolvedValue({
      error: errorMessage,
    });

    // FIXME: Remove when updating file. Eslint update
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("./fido2-content-script");
    const result = messenger.handler!(message, abortController);

    await expect(result).rejects.toEqual(errorMessage);
  });

  it("skips initializing if the document content type is not 'text/html'", () => {
    jest.clearAllMocks();

    (jest.spyOn(globalThis, "document", "get") as jest.Mock).mockImplementation(() => ({
      ...mockGlobalThisDocument,
      contentType: "application/json",
    }));

    // FIXME: Remove when updating file. Eslint update
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("./fido2-content-script");

    expect(messengerForDOMCommunicationSpy).not.toHaveBeenCalled();
  });

  it("skips initializing if the document location protocol is not 'https'", () => {
    jest.clearAllMocks();

    (jest.spyOn(globalThis, "document", "get") as jest.Mock).mockImplementation(() => ({
      ...mockGlobalThisDocument,
      location: {
        ...mockGlobalThisDocument.location,
        href: "http://localhost",
        origin: "http://localhost",
        protocol: "http:",
      },
    }));

    // FIXME: Remove when updating file. Eslint update
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("./fido2-content-script");

    expect(messengerForDOMCommunicationSpy).not.toHaveBeenCalled();
  });
});
