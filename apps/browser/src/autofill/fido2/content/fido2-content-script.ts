import {
  AssertCredentialParams,
  CreateCredentialParams,
} from "@bitwarden/common/platform/abstractions/fido2/fido2-client.service.abstraction";

import { currentlyInSandboxedIframe, sendExtensionMessage } from "../../../autofill/utils";
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

  if (currentlyInSandboxedIframe()) {
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
    abortController?: AbortController,
  ) {
    const requestId = Date.now().toString();
    const abortHandler = () =>
      sendExtensionMessage("fido2AbortRequest", { abortedRequestId: requestId });
    abortController?.signal.addEventListener("abort", abortHandler);

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
      abortController?.signal.removeEventListener("abort", abortHandler);
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
    const featureName = permissionsPolicyFeatureForCommand(command);
    if (featureName != null && !isWebAuthnFeatureAllowed(featureName)) {
      return Promise.reject(buildPermissionsPolicyError(featureName));
    }

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
   * Maps the background-bound command name to the corresponding Permissions Policy
   * feature name. Returns `undefined` for commands that don't have a policy gate.
   */
  function permissionsPolicyFeatureForCommand(command: string): string | undefined {
    if (command === "fido2RegisterCredentialRequest") {
      return "publickey-credentials-create";
    }
    if (command === "fido2GetCredentialRequest") {
      return "publickey-credentials-get";
    }
    return undefined;
  }

  /**
   * Checks whether the document's Permissions Policy allows the requested WebAuthn feature.
   *
   * This check runs in the content script's isolated world, so its view of
   * `document.permissionsPolicy` / `document.featurePolicy` and the `self`/`top`
   * references cannot be tampered with by page-world script — the precondition
   * for the VULN-582 / VULN-398 attacker model.
   *
   * Prefers the standardized `document.permissionsPolicy` API; falls back to the older
   * `document.featurePolicy`. No shipping browser exposes `permissionsPolicy` as of writing,
   * but the WICG spec defines it as the standardized form, so we check it first for
   * forward-compatibility.
   *
   * When neither API is available (Safari, default-config Firefox where the IDL is gated
   * behind `dom.security.featurePolicy.webidl.enabled`), we fall back to a defense-in-depth
   * check: deny when we're in a cross-origin iframe, since the spec default allowlist for
   * `publickey-credentials-*` is `self`. This over-rejects iframes that legitimately received
   * `allow=publickey-credentials-*` from their parent, which we can't introspect without the
   * policy API.
   *
   * @param featureName Permissions Policy feature name, e.g. `publickey-credentials-get`.
   */
  function isWebAuthnFeatureAllowed(featureName: string): boolean {
    try {
      const policyHolder = globalContext.document as Document & {
        permissionsPolicy?: { allowsFeature(feature: string): boolean };
        featurePolicy?: { allowsFeature(feature: string): boolean };
      };
      const policy = policyHolder.permissionsPolicy ?? policyHolder.featurePolicy;
      if (policy != null && typeof policy.allowsFeature === "function") {
        return policy.allowsFeature(featureName);
      }
    } catch {
      // Fall through to the defense-in-depth check.
    }

    return !isCrossOriginIframe();
  }

  /**
   * Best-effort detection of whether this document is loaded in a cross-origin iframe.
   * Used as a defense-in-depth fallback when the Permissions Policy JS API is unavailable.
   */
  function isCrossOriginIframe(): boolean {
    try {
      if (globalContext.self === globalContext.top) {
        return false;
      }
      return globalContext.top?.location.origin !== globalContext.self.location.origin;
    } catch {
      // SecurityError reading top.location → top is a different origin.
      return true;
    }
  }

  /**
   * Builds a DOMException that mirrors the error the browser raises when a Permissions
   * Policy denies a WebAuthn ceremony.
   */
  function buildPermissionsPolicyError(featureName: string): DOMException {
    return new DOMException(
      `The '${featureName}' feature is not enabled in this document. Permissions Policy may be used to delegate Web Authentication capabilities to cross-origin child frames.`,
      "NotAllowedError",
    );
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
