import { AutofillPort } from "../enums/autofill-port.enums";
import { triggerPortOnDisconnectEvent } from "../spec/testing-utils";

import { logoIcon, logoLockedIcon } from "./svg-icons";

import {
  buildSvgDomElement,
  generateRandomCustomElementName,
  sendExtensionMessage,
  setElementStyles,
  getFromLocalStorage,
  setupExtensionDisconnectAction,
  setupAutofillInitDisconnectAction,
} from "./index";

describe("buildSvgDomElement", () => {
  it("returns an SVG DOM element", () => {
    const builtSVG = buildSvgDomElement(logoIcon);
    const builtSVGAriaVisible = buildSvgDomElement(logoLockedIcon, false);

    expect(builtSVG.tagName).toEqual("svg");
    expect(builtSVG.getAttribute("aria-hidden")).toEqual("true");
    expect(builtSVGAriaVisible.tagName).toEqual("svg");
    expect(builtSVGAriaVisible.getAttribute("aria-hidden")).toEqual("false");
  });
});

describe("generateRandomCustomElementName", () => {
  it("returns a randomized value", async () => {
    let generatedValue = "";

    expect(generatedValue).toHaveLength(0);

    generatedValue = generateRandomCustomElementName();

    expect(generatedValue.length).toBeGreaterThan(0);
  });
});

describe("sendExtensionMessage", () => {
  it("sends a message to the extention", () => {
    const extensionMessageResponse = sendExtensionMessage("updateAutofillOverlayHidden", {
      display: "none",
    });
    jest.spyOn(chrome.runtime, "sendMessage");

    expect(chrome.runtime.sendMessage).toHaveBeenCalled();
    expect(extensionMessageResponse).toEqual(Promise.resolve({}));
  });
});

describe("setElementStyles", () => {
  const passedRules = { backgroundColor: "hotpink", color: "cyan" };
  const expectedCSSRuleString = "background-color: hotpink; color: cyan;";
  const expectedImportantCSSRuleString =
    "background-color: hotpink !important; color: cyan !important;";

  it("sets the passed styles to the passed HTMLElement", async () => {
    const domParser = new DOMParser();
    const testDivDOM = domParser.parseFromString(
      "<div>This is an unexciting div.</div>",
      "text/html",
    );
    const testDiv = testDivDOM.querySelector("div");

    expect(testDiv.getAttribute("style")).toEqual(null);

    setElementStyles(testDiv, passedRules);

    expect(testDiv.getAttribute("style")).toEqual(expectedCSSRuleString);
  });

  it("sets the passed styles with !important flag to the passed HTMLElement", () => {
    const domParser = new DOMParser();
    const testDivDOM = domParser.parseFromString(
      "<div>This is an unexciting div.</div>",
      "text/html",
    );
    const testDiv = testDivDOM.querySelector("div");

    expect(testDiv.style.cssText).toEqual("");

    setElementStyles(testDiv, passedRules, true);

    expect(testDiv.style.cssText).toEqual(expectedImportantCSSRuleString);
  });

  it("makes no changes when no element is passed", () => {
    const domParser = new DOMParser();
    const testDivDOM = domParser.parseFromString(
      "<div>This is an unexciting div.</div>",
      "text/html",
    );
    const testDiv = testDivDOM.querySelector("div");

    expect(testDiv.style.cssText).toEqual("");

    setElementStyles(testDiv, passedRules);

    expect(testDiv.style.cssText).toEqual(expectedCSSRuleString);

    setElementStyles(undefined, passedRules, true);

    expect(testDiv.style.cssText).toEqual(expectedCSSRuleString);
  });

  it("makes no changes when no CSS rules are passed", () => {
    const domParser = new DOMParser();
    const testDivDOM = domParser.parseFromString(
      "<div>This is an unexciting div.</div>",
      "text/html",
    );
    const testDiv = testDivDOM.querySelector("div");

    expect(testDiv.style.cssText).toEqual("");

    setElementStyles(testDiv, passedRules);

    expect(testDiv.style.cssText).toEqual(expectedCSSRuleString);

    setElementStyles(testDiv, {}, true);

    expect(testDiv.style.cssText).toEqual(expectedCSSRuleString);
  });
});

describe("getFromLocalStorage", () => {
  it("returns a promise with the storage object pulled from the extension storage api", async () => {
    const localStorage: Record<string, any> = {
      testValue: "test",
      another: "another",
    };
    jest.spyOn(chrome.storage.local, "get").mockImplementation((keys, callback) => {
      const localStorageObject: Record<string, string> = {};

      if (typeof keys === "string") {
        localStorageObject[keys] = localStorage[keys];
      } else if (Array.isArray(keys)) {
        for (const key of keys) {
          localStorageObject[key] = localStorage[key];
        }
      }

      callback(localStorageObject);
    });

    const returnValue = await getFromLocalStorage("testValue");

    expect(chrome.storage.local.get).toHaveBeenCalled();
    expect(returnValue).toEqual({ testValue: "test" });
  });
});

describe("setupExtensionDisconnectAction", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("connects a port to the extension background and sets up an onDisconnect listener", () => {
    const onDisconnectCallback = jest.fn();
    let port: chrome.runtime.Port;
    jest.spyOn(chrome.runtime, "connect").mockImplementation(() => {
      port = {
        onDisconnect: {
          addListener: onDisconnectCallback,
          removeListener: jest.fn(),
        },
      } as unknown as chrome.runtime.Port;

      return port;
    });

    setupExtensionDisconnectAction(onDisconnectCallback);

    expect(chrome.runtime.connect).toHaveBeenCalledWith({
      name: AutofillPort.InjectedScript,
    });
    expect(port.onDisconnect.addListener).toHaveBeenCalledWith(expect.any(Function));
  });
});

describe("setupAutofillInitDisconnectAction", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("skips setting up the extension disconnect action if the bitwardenAutofillInit object is not populated", () => {
    const onDisconnectCallback = jest.fn();
    window.bitwardenAutofillInit = undefined;
    const portConnectSpy = jest.spyOn(chrome.runtime, "connect").mockImplementation(() => {
      return {
        onDisconnect: {
          addListener: onDisconnectCallback,
          removeListener: jest.fn(),
        },
      } as unknown as chrome.runtime.Port;
    });

    setupAutofillInitDisconnectAction(window);

    expect(portConnectSpy).not.toHaveBeenCalled();
  });

  it("destroys the autofill init instance when the port is disconnected", () => {
    let port: chrome.runtime.Port;
    const autofillInitDestroy: CallableFunction = jest.fn();
    window.bitwardenAutofillInit = {
      destroy: autofillInitDestroy,
    } as any;
    jest.spyOn(chrome.runtime, "connect").mockImplementation(() => {
      port = {
        onDisconnect: {
          addListener: jest.fn(),
          removeListener: jest.fn(),
        },
      } as unknown as chrome.runtime.Port;

      return port;
    });

    setupAutofillInitDisconnectAction(window);
    triggerPortOnDisconnectEvent(port as chrome.runtime.Port);

    expect(chrome.runtime.connect).toHaveBeenCalled();
    expect(port.onDisconnect.addListener).toHaveBeenCalled();
    expect(autofillInitDestroy).toHaveBeenCalled();
    expect(window.bitwardenAutofillInit).toBeUndefined();
  });
});
