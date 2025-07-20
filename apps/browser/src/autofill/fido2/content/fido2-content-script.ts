// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  AssertCredentialParams,
  CreateCredentialParams,
} from "@bitwarden/common/platform/abstractions/fido2/fido2-client.service.abstraction";

import { sendExtensionMessage } from "../../../autofill/utils";
import { Fido2PortName } from "../enums/fido2-port-name.enum";

import {
  InsecureAssertCredentialParams,
  InsecureCreateCredentialParams,
  Message,
  MessageTypes,
} from "./messaging/message";
import { MessageWithMetadata, Messenger } from "./messaging/messenger";

(function (globalContext) {
  const shouldExecuteContentScript =
    globalContext.document.contentType === "text/html" &&
    (globalContext.document.location.protocol === "https:" ||
      (globalContext.document.location.protocol === "http:" &&
        globalContext.document.location.hostname === "localhost"));

  if (!shouldExecuteContentScript) {
    return;
  }

  // Initialization logic, set up the messenger and connect a port to the background script.
  const messenger = Messenger.forDOMCommunication(globalContext.window);
  messenger.handler = handleFido2Message;
  const port = chrome.runtime.connect({ name: Fido2PortName.InjectedScript });
  port.onDisconnect.addListener(handlePortOnDisconnect);

  /**
   * Handles FIDO2 credential requests and returns the result.
   *
   * @param message - The message to handle.
   * @param abortController - The abort controller used to handle exit conditions from the FIDO2 request.
   */
  async function handleFido2Message(
    message: MessageWithMetadata,
    abortController: AbortController,
  ) {
    const requestId = Date.now().toString();
    const abortHandler = () =>
      sendExtensionMessage("fido2AbortRequest", { abortedRequestId: requestId });
    abortController.signal.addEventListener("abort", abortHandler);

    try {
      if (message.type === MessageTypes.CredentialCreationRequest) {
        return handleCredentialCreationRequestMessage(
          requestId,
          message.data as InsecureCreateCredentialParams,
        );
      }

      if (message.type === MessageTypes.CredentialGetRequest) {
        return handleCredentialGetRequestMessage(
          requestId,
          message.data as InsecureAssertCredentialParams,
        );
      }

      if (message.type === MessageTypes.AbortRequest) {
        return sendExtensionMessage("fido2AbortRequest", { abortedRequestId: requestId });
      }
    } finally {
      abortController.signal.removeEventListener("abort", abortHandler);
    }
  }

  /**
   * Handles the credential creation request message and returns the result.
   *
   * @param requestId - The request ID of the message.
   * @param data - Data associated with the credential request.
   */
  async function handleCredentialCreationRequestMessage(
    requestId: string,
    data: InsecureCreateCredentialParams,
  ): Promise<Message | undefined> {
    return respondToCredentialRequest(
      "fido2RegisterCredentialRequest",
      MessageTypes.CredentialCreationResponse,
      requestId,
      data,
    );
  }

  /**
   * Handles the credential get request message and returns the result.
   *
   * @param requestId - The request ID of the message.
   * @param data - Data associated with the credential request.
   */
  async function handleCredentialGetRequestMessage(
    requestId: string,
    data: InsecureAssertCredentialParams,
  ): Promise<Message | undefined> {
    return respondToCredentialRequest(
      "fido2GetCredentialRequest",
      MessageTypes.CredentialGetResponse,
      requestId,
      data,
    );
  }

  /**
   * Sends a message to the extension to handle the
   * credential request and returns the result.
   *
   * @param command - The command to send to the extension.
   * @param type - The type of message, either CredentialCreationResponse or CredentialGetResponse.
   * @param requestId - The request ID of the message.
   * @param messageData - Data associated with the credential request.
   */
  async function respondToCredentialRequest(
    command: string,
    type:
      | typeof MessageTypes.CredentialCreationResponse
      | typeof MessageTypes.CredentialGetResponse,
    requestId: string,
    messageData: InsecureCreateCredentialParams | InsecureAssertCredentialParams,
  ): Promise<Message | undefined> {
    const data: CreateCredentialParams | AssertCredentialParams = {
      ...messageData,
      origin: globalContext.location.origin,
      sameOriginWithAncestors: globalContext.self === globalContext.top,
    };

    const result = await sendExtensionMessage(command, { data, requestId });

    if (result && result.error !== undefined) {
      return Promise.reject(result.error);
    }

    return Promise.resolve({ type, result });
  }

  /**
   * Handles the disconnect event of the port. Calls
   * to the messenger to destroy and tear down the
   * implemented page-script.js logic.
   */
  function handlePortOnDisconnect() {
    void messenger.destroy();
  }
})(globalThis);
