// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { FieldRect } from "../background/abstractions/overlay.background";
import { AutofillPort } from "../enums/autofill-port.enum";
import { FillableFormFieldElement, FormElementWithAttribute, FormFieldElement } from "../types";

/**
 * Generates a random string of characters.
 *
 * @param length - The length of the random string to generate.
 */
export function generateRandomChars(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  const randomChars = [];
  const randomBytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(randomBytes);

  for (let byteIndex = 0; byteIndex < randomBytes.length; byteIndex++) {
    const byte = randomBytes[byteIndex];
    randomChars.push(chars[byte % chars.length]);
  }

  return randomChars.join("");
}

/**
 * Polyfills the requestIdleCallback API with a setTimeout fallback.
 *
 * @param callback - The callback function to run when the browser is idle.
 * @param options - The options to pass to the requestIdleCallback function.
 */
export function requestIdleCallbackPolyfill(
  callback: () => void,
  options?: Record<string, any>,
): number | NodeJS.Timeout {
  if ("requestIdleCallback" in globalThis) {
    return globalThis.requestIdleCallback(() => callback(), options);
  }

  return globalThis.setTimeout(() => callback(), 1);
}

/**
 * Polyfills the cancelIdleCallback API with a clearTimeout fallback.
 *
 * @param id - The ID of the idle callback to cancel.
 */
export function cancelIdleCallbackPolyfill(id: NodeJS.Timeout | number) {
  if ("cancelIdleCallback" in globalThis) {
    return globalThis.cancelIdleCallback(id as number);
  }

  return globalThis.clearTimeout(id);
}

/**
 * Generates a random string of characters that formatted as a custom element name.
 */
export function generateRandomCustomElementName(): string {
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
export function buildSvgDomElement(svgString: string, ariaHidden = true): HTMLElement {
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
export async function sendExtensionMessage(
  command: string,
  options: Record<string, any> = {},
): Promise<any> {
  if (
    typeof browser !== "undefined" &&
    typeof browser.runtime !== "undefined" &&
    typeof browser.runtime.sendMessage !== "undefined"
  ) {
    return browser.runtime.sendMessage({ command, ...options });
  }

  return new Promise((resolve) =>
    chrome.runtime.sendMessage(Object.assign({ command }, options), (response) => {
      if (chrome.runtime.lastError) {
        resolve(null);
      }

      resolve(response);
    }),
  );
}

/**
 * Sets CSS styles on an element.
 *
 * @param element - The element to set the styles on.
 * @param styles - The styles to set on the element.
 * @param priority - Determines whether the styles should be set as important.
 */
export function setElementStyles(
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
 * Sets up a long-lived connection with the extension background
 * and triggers an onDisconnect event if the extension context
 * is invalidated.
 *
 * @param callback - Callback export function to run when the extension disconnects
 */
export function setupExtensionDisconnectAction(callback: (port: chrome.runtime.Port) => void) {
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
export function setupAutofillInitDisconnectAction(windowContext: Window) {
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
export function elementIsFillableFormField(
  formFieldElement: FormFieldElement,
): formFieldElement is FillableFormFieldElement {
  return !elementIsSpanElement(formFieldElement);
}

/**
 * Identifies whether an element is an instance of a specific tag name.
 *
 * @param element - The element to check.
 * @param tagName -  The tag name to check against.
 */
export function elementIsInstanceOf<T extends Element>(
  element: Element,
  tagName: string,
): element is T {
  return nodeIsElement(element) && element.tagName.toLowerCase() === tagName;
}

/**
 * Identifies whether an element is a span element.
 *
 * @param element - The element to check.
 */
export function elementIsSpanElement(element: Element): element is HTMLSpanElement {
  return elementIsInstanceOf<HTMLSpanElement>(element, "span");
}

/**
 * Identifies whether an element is an input field.
 *
 * @param element - The element to check.
 */
export function elementIsInputElement(element: Element): element is HTMLInputElement {
  return elementIsInstanceOf<HTMLInputElement>(element, "input");
}

/**
 * Identifies whether an element is a select field.
 *
 * @param element - The element to check.
 */
export function elementIsSelectElement(element: Element): element is HTMLSelectElement {
  return elementIsInstanceOf<HTMLSelectElement>(element, "select");
}

/**
 * Identifies whether an element is a textarea field.
 *
 * @param element - The element to check.
 */
export function elementIsTextAreaElement(element: Element): element is HTMLTextAreaElement {
  return elementIsInstanceOf<HTMLTextAreaElement>(element, "textarea");
}

/**
 * Identifies whether an element is a form element.
 *
 * @param element - The element to check.
 */
export function elementIsFormElement(element: Element): element is HTMLFormElement {
  return elementIsInstanceOf<HTMLFormElement>(element, "form");
}

/**
 * Identifies whether an element is a label element.
 *
 * @param element - The element to check.
 */
export function elementIsLabelElement(element: Element): element is HTMLLabelElement {
  return elementIsInstanceOf<HTMLLabelElement>(element, "label");
}

/**
 * Identifies whether an element is a description details `dd` element.
 *
 * @param element - The element to check.
 */
export function elementIsDescriptionDetailsElement(element: Element): element is HTMLElement {
  return elementIsInstanceOf<HTMLElement>(element, "dd");
}

/**
 * Identifies whether an element is a description term `dt` element.
 *
 * @param element - The element to check.
 */
export function elementIsDescriptionTermElement(element: Element): element is HTMLElement {
  return elementIsInstanceOf<HTMLElement>(element, "dt");
}

/**
 * Identifies whether a node is an HTML element.
 *
 * @param node - The node to check.
 */
export function nodeIsElement(node: Node): node is Element {
  if (!node) {
    return false;
  }

  return node?.nodeType === Node.ELEMENT_NODE;
}

/**
 * Identifies whether a node is an input element.
 *
 * @param node - The node to check.
 */
export function nodeIsInputElement(node: Node): node is HTMLInputElement {
  return nodeIsElement(node) && elementIsInputElement(node);
}

/**
 * Identifies whether a node is a form element.
 *
 * @param node - The node to check.
 */
export function nodeIsFormElement(node: Node): node is HTMLFormElement {
  return nodeIsElement(node) && elementIsFormElement(node);
}

export function nodeIsTypeSubmitElement(node: Node): node is HTMLElement {
  return nodeIsElement(node) && getPropertyOrAttribute(node as HTMLElement, "type") === "submit";
}

export function nodeIsButtonElement(node: Node): node is HTMLButtonElement {
  return (
    nodeIsElement(node) &&
    (elementIsInstanceOf<HTMLButtonElement>(node, "button") ||
      getPropertyOrAttribute(node as HTMLElement, "type") === "button")
  );
}

export function nodeIsAnchorElement(node: Node): node is HTMLAnchorElement {
  return nodeIsElement(node) && elementIsInstanceOf<HTMLAnchorElement>(node, "a");
}

/**
 * Returns a boolean representing the attribute value of an element.
 *
 * @param element
 * @param attributeName
 * @param checkString
 */
export function getAttributeBoolean(
  element: HTMLElement,
  attributeName: string,
  checkString = false,
): boolean {
  if (checkString) {
    return getPropertyOrAttribute(element, attributeName) === "true";
  }

  return Boolean(getPropertyOrAttribute(element, attributeName));
}

/**
 * Get the value of a property or attribute from a FormFieldElement.
 *
 * @param element
 * @param attributeName
 */
export function getPropertyOrAttribute(element: HTMLElement, attributeName: string): string | null {
  if (attributeName in element) {
    return (element as FormElementWithAttribute)[attributeName];
  }

  return element.getAttribute(attributeName);
}

/**
 * Throttles a callback function to run at most once every `limit` milliseconds.
 *
 * @param callback - The callback function to throttle.
 * @param limit - The time in milliseconds to throttle the callback.
 */
export function throttle(callback: (_args: any) => any, limit: number) {
  let waitingDelay = false;
  return function (...args: unknown[]) {
    if (!waitingDelay) {
      callback.apply(this, args);
      waitingDelay = true;
      globalThis.setTimeout(() => (waitingDelay = false), limit);
    }
  };
}

/**
 * Debounces a callback function to run after a delay of `delay` milliseconds.
 *
 * @param callback - The callback function to debounce.
 * @param delay - The time in milliseconds to debounce the callback.
 * @param immediate - Determines whether the callback should run immediately.
 */
export function debounce(callback: (_args: any) => any, delay: number, immediate?: boolean) {
  let timeout: NodeJS.Timeout;
  return function (...args: unknown[]) {
    const callImmediately = !!immediate && !timeout;

    if (timeout) {
      globalThis.clearTimeout(timeout);
    }
    timeout = globalThis.setTimeout(() => {
      timeout = null;
      if (!callImmediately) {
        callback.apply(this, args);
      }
    }, delay);

    if (callImmediately) {
      callback.apply(this, args);
    }
  };
}

/**
 * Gathers and normalizes keywords from a potential submit button element. Used
 * to verify if the element submits a login or change password form.
 *
 * @param element - The element to gather keywords from.
 */
export function getSubmitButtonKeywordsSet(element: HTMLElement): Set<string> {
  const keywords = [
    element.textContent,
    element.getAttribute("type"),
    element.getAttribute("value"),
    element.getAttribute("aria-label"),
    element.getAttribute("aria-labelledby"),
    element.getAttribute("aria-describedby"),
    element.getAttribute("title"),
    element.getAttribute("id"),
    element.getAttribute("name"),
    element.getAttribute("class"),
  ];

  const keywordsSet = new Set<string>();
  for (let i = 0; i < keywords.length; i++) {
    if (typeof keywords[i] === "string") {
      // Iterate over all keywords metadata and split them by non-letter characters.
      // This ensures we check against individual words and not the entire string.
      keywords[i]
        .toLowerCase()
        .replace(/[-\s]/g, "")
        .split(/[^\p{L}]+/gu)
        .forEach((keyword) => {
          if (keyword) {
            keywordsSet.add(keyword);
          }
        });
    }
  }

  return keywordsSet;
}

/**
 * Generates the origin and subdomain match patterns for the URL.
 *
 * @param url - The URL of the tab
 */
export function generateDomainMatchPatterns(url: string): string[] {
  try {
    const extensionUrlPattern =
      /^(chrome|chrome-extension|moz-extension|safari-web-extension):\/\/\/?/;
    if (extensionUrlPattern.test(url)) {
      return [];
    }

    // Add protocol to URL if it is missing to allow for parsing the hostname correctly
    const urlPattern = /^(https?|file):\/\/\/?/;
    if (!urlPattern.test(url)) {
      url = `https://${url}`;
    }

    let protocolGlob = "*://";
    if (url.startsWith("file:///")) {
      protocolGlob = "*:///"; // File URLs require three slashes to be a valid match pattern
    }

    const parsedUrl = new URL(url);
    const originMatchPattern = `${protocolGlob}${parsedUrl.hostname}/*`;

    const splitHost = parsedUrl.hostname.split(".");
    const domain = splitHost.slice(-2).join(".");
    const subDomainMatchPattern = `${protocolGlob}*.${domain}/*`;

    return [originMatchPattern, subDomainMatchPattern];
  } catch {
    return [];
  }
}

/**
 * Determines if the status code of the web response is invalid. An invalid status code is
 * any status code that is not in the 200-299 range.
 *
 * @param statusCode - The status code of the web response
 */
export function isInvalidResponseStatusCode(statusCode: number) {
  return statusCode < 200 || statusCode >= 300;
}

/**
 * Determines if the current context is within a sandboxed iframe.
 */
export function currentlyInSandboxedIframe(): boolean {
  const sandbox = globalThis.frameElement?.getAttribute?.("sandbox");

  // No frameElement or sandbox attribute means not sandboxed
  if (sandbox === null || sandbox === undefined) {
    return false;
  }

  // An empty string means fully sandboxed
  if (sandbox === "") {
    return true;
  }

  const tokens = new Set(sandbox.toLowerCase().split(" "));
  return !["allow-scripts", "allow-same-origin"].every((token) => tokens.has(token));
}

/**
 * This object allows us to map a special character to a key name. The key name is used
 * in gathering the i18n translation of the written version of the special character.
 */
export const specialCharacterToKeyMap: Record<string, string> = {
  " ": "spaceCharacterDescriptor",
  "~": "tildeCharacterDescriptor",
  "`": "backtickCharacterDescriptor",
  "!": "exclamationCharacterDescriptor",
  "@": "atSignCharacterDescriptor",
  "#": "hashSignCharacterDescriptor",
  $: "dollarSignCharacterDescriptor",
  "%": "percentSignCharacterDescriptor",
  "^": "caretCharacterDescriptor",
  "&": "ampersandCharacterDescriptor",
  "*": "asteriskCharacterDescriptor",
  "(": "parenLeftCharacterDescriptor",
  ")": "parenRightCharacterDescriptor",
  "-": "hyphenCharacterDescriptor",
  _: "underscoreCharacterDescriptor",
  "+": "plusCharacterDescriptor",
  "=": "equalsCharacterDescriptor",
  "{": "braceLeftCharacterDescriptor",
  "}": "braceRightCharacterDescriptor",
  "[": "bracketLeftCharacterDescriptor",
  "]": "bracketRightCharacterDescriptor",
  "|": "pipeCharacterDescriptor",
  "\\": "backSlashCharacterDescriptor",
  ":": "colonCharacterDescriptor",
  ";": "semicolonCharacterDescriptor",
  '"': "doubleQuoteCharacterDescriptor",
  "'": "singleQuoteCharacterDescriptor",
  "<": "lessThanCharacterDescriptor",
  ">": "greaterThanCharacterDescriptor",
  ",": "commaCharacterDescriptor",
  ".": "periodCharacterDescriptor",
  "?": "questionCharacterDescriptor",
  "/": "forwardSlashCharacterDescriptor",
};

/**
 * Determines if the current rect values are not all 0.
 */
export function rectHasSize(rect: FieldRect): boolean {
  if (rect.right > 0 && rect.left > 0 && rect.top > 0 && rect.bottom > 0) {
    return true;
  }

  return false;
}

/**
 * Checks if all the values corresponding to the specified keys in an object are null.
 * If no keys are specified, checks all keys in the object.
 *
 * @param obj - The object to check.
 * @param keys - An optional array of keys to check in the object. Defaults to all keys.
 * @returns Returns true if all values for the specified keys (or all keys if none are provided) are null; otherwise, false.
 */
export function areKeyValuesNull<T extends Record<string, any>>(
  obj: T,
  keys?: Array<keyof T>,
): boolean {
  const keysToCheck = keys && keys.length > 0 ? keys : (Object.keys(obj) as Array<keyof T>);

  return keysToCheck.every((key) => obj[key] == null);
}
