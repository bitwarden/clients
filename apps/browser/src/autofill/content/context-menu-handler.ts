import { EventSecurity } from "../utils/event-security";
import { WebmapperCommand } from "../webmapper/messaging";

import { buildContainerCandidates, buildSelectorCapture } from "./webmapper-picker";

const inputTags = ["input", "textarea", "select"];
const labelTags = ["label", "span"];
const attributeKeys = ["id", "name", "label-aria", "placeholder"];
const invalidElement = chrome.i18n.getMessage("copyCustomFieldNameInvalidElement");
const noUniqueIdentifier = chrome.i18n.getMessage("copyCustomFieldNameNotUnique");

let clickedElement: HTMLElement | null = null;

// webmapper needs the real innermost target for shadow-aware selectors, which
// composedPath() exposes — event.target is retargeted to the shadow host.
let webmapperTarget: Element | null = null;

// Find the best attribute to be used as the Name for an element in a custom field.
function getClickedElementIdentifier() {
  if (clickedElement == null) {
    return invalidElement;
  }

  const clickedTag = clickedElement.nodeName.toLowerCase();
  let inputElement = null;

  // Try to identify the input element (which may not be the clicked element)
  if (labelTags.includes(clickedTag)) {
    let inputId;
    if (clickedTag === "label") {
      inputId = clickedElement.getAttribute("for");
    } else {
      inputId = clickedElement.closest("label")?.getAttribute("for");
    }

    if (inputId) {
      inputElement = document.getElementById(inputId);
    }
  } else {
    inputElement = clickedElement;
  }

  if (inputElement == null || !inputTags.includes(inputElement.nodeName.toLowerCase())) {
    return invalidElement;
  }

  for (const attributeKey of attributeKeys) {
    const attributeValue = inputElement.getAttribute(attributeKey);
    const selector = "[" + attributeKey + '="' + attributeValue + '"]';
    if (!isNullOrEmpty(attributeValue) && document.querySelectorAll(selector)?.length === 1) {
      return attributeValue;
    }
  }
  return noUniqueIdentifier;
}

function isNullOrEmpty(s: string | null) {
  return s == null || s === "";
}

// We only have access to the element that's been clicked when the context menu is first opened.
// Remember it for use later.
document.addEventListener("contextmenu", (event) => {
  /**
   * Reject synthetic events (not originating from the user agent)
   */
  if (!EventSecurity.isEventTrusted(event)) {
    return;
  }
  clickedElement = event.target as HTMLElement;
  webmapperTarget = (event.composedPath()[0] as Element) ?? (event.target as Element);
});

// Runs when a context menu item this script backs is clicked: 'Copy Custom
// Field Name', or webmapper's selector-capture items.
chrome.runtime.onMessage.addListener((event, sender, sendResponse) => {
  if (event.command === "getClickedElement") {
    const identifier = getClickedElementIdentifier();
    if (sendResponse) {
      sendResponse(identifier);
    }

    void chrome.runtime.sendMessage({
      command: "getClickedElementResponse",
      sender: "contextMenuHandler",
      identifier: identifier,
    });
    return;
  }

  // Only answer webmapper requests from our own background, never page script.
  if (sender.id !== chrome.runtime.id) {
    return;
  }

  if (event.command === WebmapperCommand.GetSelector) {
    sendResponse(buildSelectorCapture(webmapperTarget));
    return true;
  }

  if (event.command === WebmapperCommand.GetContainerCandidates) {
    sendResponse(buildContainerCandidates(webmapperTarget, event.fieldSelectors ?? []));
    return true;
  }
});
