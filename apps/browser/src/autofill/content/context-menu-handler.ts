const inputTags = ["input", "textarea", "select"];
const labelTags = ["label", "span"];
const attributes = ["id", "name", "label-aria", "placeholder"];
const invalidElement = chrome.i18n.getMessage("copyCustomFieldNameInvalidElement");
const noUniqueIdentifier = chrome.i18n.getMessage("copyCustomFieldNameNotUnique");

let clickedEl: HTMLElement | null = null;
let clickedElComposedPath: EventTarget[] | null = null;

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

    inputEl = inputId ? document.getElementById(inputId) : null;
  } else {
    inputEl = clickedEl;
  }

  if (inputEl == null || !inputTags.includes(inputEl.nodeName.toLowerCase())) {
    return invalidElement;
  }

  for (const attr of attributes) {
    const attributeValue = inputEl.getAttribute(attr);
    const selector = "[" + attr + '="' + attributeValue + '"]';
    if (
      attributeValue &&
      !isNullOrEmpty(attributeValue) &&
      document.querySelectorAll(selector)?.length === 1
    ) {
      return attributeValue;
    }
  }
  return noUniqueIdentifier;
}

function getClickedElementPath() {
  if (!clickedElComposedPath?.length) {
    return invalidElement;
  }

  const querySelector = clickedElComposedPath.reduce((builtQuery, target, index) => {
    // Skip the Window and Document objects at the end of the path
    if (!(target instanceof Element)) {
      return builtQuery;
    }

    const targetName = target.nodeName.toLowerCase();
    let selector = targetName;

    // Add id if present
    if (target instanceof HTMLElement && target.id) {
      selector += `#${target.id}`;
    }

    // Check if next item is a shadow root
    const nextTarget = clickedElComposedPath?.[index + 1];
    const isShadowRoot = nextTarget instanceof ShadowRoot;

    // Add separator based on whether we're crossing a shadow boundary
    if (builtQuery) {
      if (isShadowRoot) {
        builtQuery = selector + " >>> " + builtQuery;
      } else {
        builtQuery = selector + " > " + builtQuery;
      }
    } else {
      builtQuery = selector;
    }

    return builtQuery;
  }, "");

  // @TODO If `clickedElComposedPath` ends with a closed shadowRoot, send a message to background to recursively pierce the closed root and find the first visible input or else the first nested closed shadowRoot. Continue until an input is found or neither an input nor closed shadow root is found at the deepest-traversed node tree level. Append the additional query rules for traversed closed shadow roots to the query string returned here.
  return querySelector;
}

function isNullOrEmpty(s: string) {
  return s == null || s === "";
}

// We only have access to the element that's been clicked when the context menu is first opened.
// Remember it for use later.
document.addEventListener("contextmenu", (event) => {
  clickedEl = event.target as HTMLElement;
  clickedElComposedPath = event.composedPath();
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
      identifier,
    });
  }

  if (event.command === "getClickedElementPath") {
    const path = getClickedElementPath();
    if (sendResponse) {
      sendResponse(path);
    }

    void chrome.runtime.sendMessage({
      command: "getClickedElementPathResponse",
      sender: "contextMenuHandler",
      path,
    });
  }
});
