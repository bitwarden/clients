import {
  AssertCredentialParams,
  CreateCredentialParams,
} from "@bitwarden/common/vault/abstractions/fido2/fido2-client.service.abstraction";

import { Message, MessageType } from "./messaging/message";
import { Messenger } from "./messaging/messenger";

function isFido2FeatureEnabled(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        command: "checkFido2FeatureEnabled",
        hostname: window.location.hostname,
        origin: window.location.origin,
      },
      (response: { result?: boolean }) => resolve(response.result),
    );
  });
}

function isSameOriginWithAncestors() {
  try {
    return window.self === window.top;
  } catch {
    return false;
  }
}
const messenger = Messenger.forDOMCommunication(window);

function injectPageScript() {
  // Locate an existing page-script on the page
  const existingPageScript = document.getElementById("bw-fido2-page-script");

  // Inject the page-script if it doesn't exist
  if (!existingPageScript) {
    const s = document.createElement("script");
    s.src = chrome.runtime.getURL("content/fido2/page-script.js");
    s.id = "bw-fido2-page-script";
    (document.head || document.documentElement).appendChild(s);

    return;
  }

  // If the page-script already exists, send a reconnect message to the page-script
  // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  messenger.sendReconnectCommand();
}

function initializeFido2ContentScript() {
  injectPageScript();

  messenger.handler = async (message, abortController) => {
    const requestId = Date.now().toString();
    const abortHandler = () =>
      chrome.runtime.sendMessage({
        command: "fido2AbortRequest",
        abortedRequestId: requestId,
      });
    abortController.signal.addEventListener("abort", abortHandler);

    if (message.type === MessageType.CredentialCreationRequest) {
      return new Promise<Message | undefined>((resolve, reject) => {
        const data: CreateCredentialParams = {
          ...message.data,
          origin: window.location.origin,
          sameOriginWithAncestors: isSameOriginWithAncestors(),
        };

        chrome.runtime.sendMessage(
          {
            command: "fido2RegisterCredentialRequest",
            data,
            requestId: requestId,
          },
          (response) => {
            if (response && response.error !== undefined) {
              return reject(response.error);
            }

            resolve({
              type: MessageType.CredentialCreationResponse,
              result: response.result,
            });
          },
        );
      });
    }

    if (message.type === MessageType.CredentialGetRequest) {
      return new Promise<Message | undefined>((resolve, reject) => {
        const data: AssertCredentialParams = {
          ...message.data,
          origin: window.location.origin,
          sameOriginWithAncestors: isSameOriginWithAncestors(),
        };

        chrome.runtime.sendMessage(
          {
            command: "fido2GetCredentialRequest",
            data,
            requestId: requestId,
          },
          (response) => {
            if (response && response.error !== undefined) {
              return reject(response.error);
            }

            resolve({
              type: MessageType.CredentialGetResponse,
              result: response.result,
            });
          },
        );
      }).finally(() =>
        abortController.signal.removeEventListener("abort", abortHandler),
      ) as Promise<Message>;
    }

    return undefined;
  };
}

async function run() {
  if (!(await isFido2FeatureEnabled())) {
    return;
  }

  initializeFido2ContentScript();

  const port = chrome.runtime.connect({ name: "fido2ContentScriptReady" });
  port.onDisconnect.addListener(() => {
    // Cleanup the messenger and remove the event listener
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    messenger.destroy();
  });
}

// Only run the script if the document is an HTML document
if (document.contentType === "text/html") {
  void run();
}
