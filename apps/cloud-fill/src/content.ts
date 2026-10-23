import { CollectAutofillContentService } from "@bitwarden/browser/autofill/services/collect-autofill-content.service";
import DomElementVisibilityService from "@bitwarden/browser/autofill/services/dom-element-visibility.service";
import { DomQueryService } from "@bitwarden/browser/autofill/services/dom-query.service";
import InsertAutofillContentService from "@bitwarden/browser/autofill/services/insert-autofill-content.service";

import {
  CollectCommand,
  CollectResponse,
  FillCommand,
  FillResponse,
  type CollectMessage,
  type FillMessage,
} from "./messages";

const installedKey = "__bitwardenCloudFill";

function isTopFrameAt(expectedUrl: string): boolean {
  return window.top === window && window.location.href === expectedUrl;
}

(function (context: Record<string, unknown>) {
  if (context[installedKey]) {
    return;
  }
  context[installedKey] = true;

  const domVisibility = new DomElementVisibilityService();
  const collect = new CollectAutofillContentService(domVisibility, new DomQueryService());
  const insert = new InsertAutofillContentService(domVisibility, collect);

  chrome.runtime.onMessage.addListener(
    (
      message: CollectMessage | FillMessage,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: CollectResponse | FillResponse) => void,
    ) => {
      if (sender.id !== chrome.runtime.id || sender.tab != null) {
        return false;
      }

      if (message?.command === CollectCommand) {
        if (!isTopFrameAt(message.expectedUrl)) {
          sendResponse({ ok: false });
          return false;
        }
        void collect
          .getPageDetails()
          .then((pageDetails) => sendResponse({ ok: true, pageDetails }));
        return true;
      }

      if (message?.command === FillCommand) {
        if (!isTopFrameAt(message.expectedUrl) || !message.fillScript) {
          sendResponse({ ok: false });
          return false;
        }
        void insert
          .fillForm(message.fillScript, false)
          .then(() => sendResponse({ ok: true }))
          .catch(() => sendResponse({ ok: false }));
        return true;
      }

      return false;
    },
  );
})(globalThis as unknown as Record<string, unknown>);
