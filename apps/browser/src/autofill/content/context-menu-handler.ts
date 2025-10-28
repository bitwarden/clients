// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
const inputTags = ["input", "textarea", "select"];
const labelTags = ["label", "span"];
const attributes = ["id", "name", "label-aria", "placeholder"];
const invalidElement = chrome.i18n.getMessage("copyCustomFieldNameInvalidElement");
const noUniqueIdentifier = chrome.i18n.getMessage("copyCustomFieldNameNotUnique");

let clickedEl: HTMLElement = null;

// Find the best attribute to be used as the Name for an element in a custom field.
function getClickedElementIdentifier() {
  if (clickedEl == null) {
    return invalidElement;
  }

  const clickedTag = clickedEl.nodeName.toLowerCase();
  let inputEl = null;

  // Try to identify the input element (which may not be the clicked element)
  if (labelTags.includes(clickedTag)) {
    let inputId = null;
    if (clickedTag === "label") {
      inputId = clickedEl.getAttribute("for");
    } else {
      inputId = clickedEl.closest("label")?.getAttribute("for");
    }

    inputEl = document.getElementById(inputId);
  } else {
    inputEl = clickedEl;
  }

  if (inputEl == null || !inputTags.includes(inputEl.nodeName.toLowerCase())) {
    return invalidElement;
  }

  for (const attr of attributes) {
    const attributeValue = inputEl.getAttribute(attr);
    const selector = "[" + attr + '="' + attributeValue + '"]';
    if (!isNullOrEmpty(attributeValue) && document.querySelectorAll(selector)?.length === 1) {
      return attributeValue;
    }
  }
  return noUniqueIdentifier;
}

function isNullOrEmpty(s: string) {
  return s == null || s === "";
}

// We only have access to the element that's been clicked when the context menu is first opened.
// Remember it for use later.
document.addEventListener("contextmenu", (event) => {
  clickedEl = event.target as HTMLElement;
});

// Runs when the 'Copy Custom Field Name' context menu item is actually clicked.
chrome.runtime.onMessage.addListener((event, _sender, sendResponse) => {
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
  }
});
