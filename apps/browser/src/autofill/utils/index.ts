import { AutofillPort } from "../enums/autofill-port.enums";
import { FillableFormFieldElement, FormFieldElement } from "../types";

/**
 * Generates a random string of characters that formatted as a custom element name.
 */
function generateRandomCustomElementName(): string {
  const generateRandomChars = (length: number): string => {
    const chars = "abcdefghijklmnopqrstuvwxyz";
    const randomChars = [];
    const randomBytes = new Uint8Array(length);
    globalThis.crypto.getRandomValues(randomBytes);

    for (let byteIndex = 0; byteIndex < randomBytes.length; byteIndex++) {
      const byte = randomBytes[byteIndex];
      randomChars.push(chars[byte % chars.length]);
    }

    return randomChars.join("");
  };

  const length = Math.floor(Math.random() * 5) + 8; // Between 8 and 12 characters
  const numHyphens = Math.min(Math.max(Math.floor(Math.random() * 4), 1), length - 1); // At least 1, maximum of 3 hyphens

  const hyphenIndices: number[] = [];
  while (hyphenIndices.length < numHyphens) {
    const index = Math.floor(Math.random() * (length - 1)) + 1;
    if (!hyphenIndices.includes(index)) {
      hyphenIndices.push(index);
    }
  }
  hyphenIndices.sort((a, b) => a - b);

  let randomString = "";
  let prevIndex = 0;

  for (let index = 0; index < hyphenIndices.length; index++) {
    const hyphenIndex = hyphenIndices[index];
    randomString = randomString + generateRandomChars(hyphenIndex - prevIndex) + "-";
    prevIndex = hyphenIndex;
  }

  randomString += generateRandomChars(length - prevIndex);

  return randomString;
}

/**
 * Builds a DOM element from an SVG string.
 *
 * @param svgString - The SVG string to build the DOM element from.
 * @param ariaHidden - Determines whether the SVG should be hidden from screen readers.
 */
function buildSvgDomElement(svgString: string, ariaHidden = true): HTMLElement {
  const domParser = new DOMParser();
  const svgDom = domParser.parseFromString(svgString, "image/svg+xml");
  const domElement = svgDom.documentElement;
  domElement.setAttribute("aria-hidden", `${ariaHidden}`);

  return domElement;
}

/**
 * Sends a message to the extension.
 *
 * @param command - The command to send.
 * @param options - The options to send with the command.
 */
async function sendExtensionMessage(
  command: string,
  options: Record<string, any> = {},
): Promise<any | void> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(Object.assign({ command }, options), (response) => {
      if (chrome.runtime.lastError) {
        return;
      }

      resolve(response);
    });
  });
}

/**
 * Sets CSS styles on an element.
 *
 * @param element - The element to set the styles on.
 * @param styles - The styles to set on the element.
 * @param priority - Determines whether the styles should be set as important.
 */
function setElementStyles(
  element: HTMLElement,
  styles: Partial<CSSStyleDeclaration>,
  priority?: boolean,
) {
  if (!element || !styles || !Object.keys(styles).length) {
    return;
  }

  for (const styleProperty in styles) {
    element.style.setProperty(
      styleProperty.replace(/([a-z])([A-Z])/g, "$1-$2"), // Convert camelCase to kebab-case
      styles[styleProperty],
      priority ? "important" : undefined,
    );
  }
}

/**
 * Get data from local storage based on the keys provided.
 *
 * @param keys - String or array of strings of keys to get from local storage
 * @deprecated Do not call this, use state-relevant services instead
 */
async function getFromLocalStorage(keys: string | string[]): Promise<Record<string, any>> {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (storage: Record<string, any>) => resolve(storage));
  });
}

/**
 * Sets up a long-lived connection with the extension background
 * and triggers an onDisconnect event if the extension context
 * is invalidated.
 *
 * @param callback - Callback function to run when the extension disconnects
 */
function setupExtensionDisconnectAction(callback: (port: chrome.runtime.Port) => void) {
  const port = chrome.runtime.connect({ name: AutofillPort.InjectedScript });
  const onDisconnectCallback = (disconnectedPort: chrome.runtime.Port) => {
    callback(disconnectedPort);
    port.onDisconnect.removeListener(onDisconnectCallback);
  };
  port.onDisconnect.addListener(onDisconnectCallback);
}

/**
 * Handles setup of the extension disconnect action for the autofill init class
 * in both instances where the overlay might or might not be initialized.
 *
 * @param windowContext - The global window context
 */
function setupAutofillInitDisconnectAction(windowContext: Window) {
  if (!windowContext.bitwardenAutofillInit) {
    return;
  }

  const onDisconnectCallback = () => {
    windowContext.bitwardenAutofillInit.destroy();
    delete windowContext.bitwardenAutofillInit;
  };
  setupExtensionDisconnectAction(onDisconnectCallback);
}

/**
 * Identifies whether an element is a fillable form field.
 * This is determined by whether the element is a form field and not a span.
 *
 * @param formFieldElement - The form field element to check.
 */
function elementIsFillableFormField(
  formFieldElement: FormFieldElement,
): formFieldElement is FillableFormFieldElement {
  return formFieldElement?.tagName.toLowerCase() !== "span";
}

/**
 * Identifies whether an element is an instance of a specific tag name.
 *
 * @param element - The element to check.
 * @param tagName -  The tag name to check against.
 */
function elementIsInstanceOf<T extends Element>(element: Element, tagName: string): element is T {
  return element?.tagName.toLowerCase() === tagName;
}

/**
 * Identifies whether an element is a span element.
 *
 * @param element - The element to check.
 */
function elementIsSpanElement(element: Element): element is HTMLSpanElement {
  return elementIsInstanceOf<HTMLSpanElement>(element, "span");
}

/**
 * Identifies whether an element is an input field.
 *
 * @param element - The element to check.
 */
function elementIsInputElement(element: Element): element is HTMLInputElement {
  return elementIsInstanceOf<HTMLInputElement>(element, "input");
}

/**
 * Identifies whether an element is a select field.
 *
 * @param element - The element to check.
 */
function elementIsSelectElement(element: Element): element is HTMLSelectElement {
  return elementIsInstanceOf<HTMLSelectElement>(element, "select");
}

/**
 * Identifies whether an element is a textarea field.
 *
 * @param element - The element to check.
 */
function elementIsTextAreaElement(element: Element): element is HTMLTextAreaElement {
  return elementIsInstanceOf<HTMLTextAreaElement>(element, "textarea");
}

/**
 * Identifies whether an element is a form element.
 *
 * @param element - The element to check.
 */
function elementIsFormElement(element: Element): element is HTMLFormElement {
  return elementIsInstanceOf<HTMLFormElement>(element, "form");
}

/**
 * Identifies whether an element is a label element.
 *
 * @param element - The element to check.
 */
function elementIsLabelElement(element: Element): element is HTMLLabelElement {
  return elementIsInstanceOf<HTMLLabelElement>(element, "label");
}

/**
 * Identifies whether an element is a description details `dd` element.
 *
 * @param element - The element to check.
 */
function elementIsDescriptionDetailsElement(element: Element): element is HTMLElement {
  return elementIsInstanceOf<HTMLElement>(element, "dd");
}

/**
 * Identifies whether an element is a description term `dt` element.
 *
 * @param element - The element to check.
 */
function elementIsDescriptionTermElement(element: Element): element is HTMLElement {
  return elementIsInstanceOf<HTMLElement>(element, "dt");
}

/**
 * Identifies whether a node is an HTML element.
 *
 * @param node - The node to check.
 */
function nodeIsElement(node: Node): node is Element {
  return node?.nodeType === Node.ELEMENT_NODE;
}

/**
 * Identifies whether a node is an input element.
 *
 * @param node - The node to check.
 */
function nodeIsInputElement(node: Node): node is HTMLInputElement {
  return nodeIsElement(node) && elementIsInputElement(node);
}

/**
 * Identifies whether a node is a form element.
 *
 * @param node - The node to check.
 */
function nodeIsFormElement(node: Node): node is HTMLFormElement {
  return nodeIsElement(node) && elementIsFormElement(node);
}

export {
  generateRandomCustomElementName,
  buildSvgDomElement,
  sendExtensionMessage,
  setElementStyles,
  getFromLocalStorage,
  setupExtensionDisconnectAction,
  setupAutofillInitDisconnectAction,
  elementIsFillableFormField,
  elementIsInstanceOf,
  elementIsSpanElement,
  elementIsInputElement,
  elementIsSelectElement,
  elementIsTextAreaElement,
  elementIsFormElement,
  elementIsLabelElement,
  elementIsDescriptionDetailsElement,
  elementIsDescriptionTermElement,
  nodeIsElement,
  nodeIsInputElement,
  nodeIsFormElement,
};
