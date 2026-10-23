import { CollectAutofillContentService } from "@bitwarden/browser/autofill/services/collect-autofill-content.service";
import DomElementVisibilityService from "@bitwarden/browser/autofill/services/dom-element-visibility.service";
import { DomQueryService } from "@bitwarden/browser/autofill/services/dom-query.service";
import InsertAutofillContentService from "@bitwarden/browser/autofill/services/insert-autofill-content.service";

import {
  CollectCommand,
  CollectResponse,
  FillCommand,
  FillResponse,
  InspectCommand,
  InspectResponse,
  type CollectMessage,
  type FillMessage,
  type InspectMessage,
} from "./messages";

const installedKey = "__bitwardenCloudFill";

function isTopFrameAt(expectedUrl: string): boolean {
  return window.top === window && window.location.href === expectedUrl;
}

// Read through the prototypes so a child element named "action" or "form" cannot shadow the
// properties of the form that contains it.
const inputFormOf = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "form")?.get;
const attributeOf = Element.prototype.getAttribute;
const queryAllInElement = Element.prototype.querySelectorAll;
const queryAllInDocument = Document.prototype.querySelectorAll;
const SUBMIT_CONTROLS = "button, input[type=submit], input[type=image]";

function resolveTarget(value: string | null): string {
  try {
    return new URL(value ?? "", document.baseURI).href;
  } catch {
    return "invalid:";
  }
}

function submitTargetsAround(element: Element, targets: Set<string>): boolean {
  const form = element instanceof HTMLInputElement ? inputFormOf?.call(element) : null;
  if (!(form instanceof HTMLFormElement)) {
    return false;
  }

  targets.add(resolveTarget(attributeOf.call(form, "action")));
  const controls = [
    ...Array.from(queryAllInElement.call(form, SUBMIT_CONTROLS) as NodeListOf<Element>),
    ...Array.from(
      queryAllInDocument.call(document, "button[form], input[form]") as NodeListOf<Element>,
    ),
  ];
  const formId = attributeOf.call(form, "id");
  for (const control of controls) {
    const owner = attributeOf.call(control, "form");
    const belongs = owner == null ? form.contains(control) : owner === formId;
    const formAction = attributeOf.call(control, "formaction");
    if (belongs && formAction != null) {
      targets.add(resolveTarget(formAction));
    }
  }
  return true;
}

(function (context: Record<string, unknown>) {
  if (context[installedKey]) {
    return;
  }
  context[installedKey] = true;

  const documentNonce = crypto.randomUUID();

  const domVisibility = new DomElementVisibilityService();
  const collect = new CollectAutofillContentService(domVisibility, new DomQueryService());
  const insert = new InsertAutofillContentService(domVisibility, collect);

  chrome.runtime.onMessage.addListener(
    (
      message: CollectMessage | InspectMessage | FillMessage,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: CollectResponse | InspectResponse | FillResponse) => void,
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
          .then((pageDetails) => sendResponse({ ok: true, pageDetails, documentNonce }));
        return true;
      }

      if (message?.command === InspectCommand) {
        if (!isTopFrameAt(message.expectedUrl) || !Array.isArray(message.opids)) {
          sendResponse({ ok: false });
          return false;
        }
        const targets = new Set<string>();
        let formless = false;
        for (const opid of message.opids) {
          const element = collect.getAutofillFieldElementByOpid(opid);
          if (element == null || !submitTargetsAround(element, targets)) {
            formless = true;
          }
        }
        sendResponse({ ok: true, formless, submitTargets: [...targets] });
        return false;
      }

      if (message?.command === FillCommand) {
        if (
          !isTopFrameAt(message.expectedUrl) ||
          message.documentNonce !== documentNonce ||
          !message.fillScript
        ) {
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
