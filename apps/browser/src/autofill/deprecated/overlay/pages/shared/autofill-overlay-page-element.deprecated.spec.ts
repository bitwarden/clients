import { mock } from "jest-mock-extended";

import { OverlayButtonWindowMessageHandlers } from "../../abstractions/autofill-overlay-button.deprecated";

import AutofillOverlayPageElementDeprecated from "./autofill-overlay-page-element.deprecated";

describe("AutofillOverlayPageElement", () => {
  globalThis.customElements.define(
    "autofill-overlay-page-element",
    AutofillOverlayPageElementDeprecated,
  );
  let autofillOverlayPageElement: AutofillOverlayPageElementDeprecated;
  const translations = {
    locale: "en",
    buttonPageTitle: "buttonPageTitle",
    listPageTitle: "listPageTitle",
  };

  beforeEach(() => {
    jest.spyOn(globalThis.parent, "postMessage");
    jest.spyOn(globalThis, "addEventListener");
    jest.spyOn(globalThis.document, "addEventListener");
    document.body.innerHTML = "<autofill-overlay-page-element></autofill-overlay-page-element>";
    autofillOverlayPageElement = document.querySelector("autofill-overlay-page-element");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("initOverlayPage", () => {
    beforeEach(() => {
      jest.spyOn(globalThis.document.documentElement, "setAttribute");
      jest.spyOn(globalThis.document, "createElement");
    });

    it("initializes the button overlay page", () => {
      const linkElement = autofillOverlayPageElement["initOverlayPage"](
        "button",
        "https://jest-testing-website.com",
        translations,
      );

      expect(globalThis.document.documentElement.setAttribute).toHaveBeenCalledWith(
        "lang",
        translations.locale,
      );
      expect(globalThis.document.head.title).toEqual(translations.buttonPageTitle);
      expect(globalThis.document.createElement).toHaveBeenCalledWith("link");
      expect(linkElement.getAttribute("rel")).toEqual("stylesheet");
      expect(linkElement.getAttribute("href")).toEqual("https://jest-testing-website.com");
    });
  });

  describe("postMessageToParent", () => {
    it("skips posting a message to the parent if the message origin in not set", () => {
      autofillOverlayPageElement["postMessageToParent"]({ command: "test" });

      expect(globalThis.parent.postMessage).not.toHaveBeenCalled();
    });

    it("posts a message to the parent", () => {
      autofillOverlayPageElement["messageOrigin"] = "https://jest-testing-website.com";
      autofillOverlayPageElement["postMessageToParent"]({ command: "test" });

      expect(globalThis.parent.postMessage).toHaveBeenCalledWith(
        { command: "test" },
        "https://jest-testing-website.com",
      );
    });
  });

  describe("getTranslation", () => {
    it("returns an empty value if the translation doesn't exist in the translations object", () => {
      autofillOverlayPageElement["translations"] = translations;

      expect(autofillOverlayPageElement["getTranslation"]("test")).toEqual("");
    });
  });

  describe("global event listeners", () => {
    it("sets up global event listeners", () => {
      const handleWindowMessageSpy = jest.spyOn(
        autofillOverlayPageElement as any,
        "handleWindowMessage",
      );
      const handleWindowBlurEventSpy = jest.spyOn(
        autofillOverlayPageElement as any,
        "handleWindowBlurEvent",
      );
      const handleDocumentKeyDownEventSpy = jest.spyOn(
        autofillOverlayPageElement as any,
        "handleDocumentKeyDownEvent",
      );
      autofillOverlayPageElement["setupGlobalListeners"](
        mock<OverlayButtonWindowMessageHandlers>(),
      );

      expect(globalThis.addEventListener).toHaveBeenCalledWith("message", handleWindowMessageSpy);
      expect(globalThis.addEventListener).toHaveBeenCalledWith("blur", handleWindowBlurEventSpy);
      expect(globalThis.document.addEventListener).toHaveBeenCalledWith(
        "keydown",
        handleDocumentKeyDownEventSpy,
      );
    });

    it("sets the message origin when handling the first passed window message", () => {
      const initAutofillOverlayButtonSpy = jest.fn();
      autofillOverlayPageElement["setupGlobalListeners"](
        mock<OverlayButtonWindowMessageHandlers>({
          initAutofillOverlayButton: initAutofillOverlayButtonSpy,
        }),
      );

      globalThis.dispatchEvent(
        new MessageEvent("message", {
          data: { command: "initAutofillOverlayButton" },
          origin: "https://jest-testing-website.com",
        }),
      );

      expect(autofillOverlayPageElement["messageOrigin"]).toEqual(
        "https://jest-testing-website.com",
      );
    });

    it("handles window messages that are part of the passed windowMessageHandlers object", () => {
      const initAutofillOverlayButtonSpy = jest.fn();
      autofillOverlayPageElement["setupGlobalListeners"](
        mock<OverlayButtonWindowMessageHandlers>({
          initAutofillOverlayButton: initAutofillOverlayButtonSpy,
        }),
      );
      const data = { command: "initAutofillOverlayButton" };

      globalThis.dispatchEvent(new MessageEvent("message", { data }));

      expect(initAutofillOverlayButtonSpy).toHaveBeenCalledWith({ message: data });
    });

    it("skips attempting to handle window messages that are not part of the passed windowMessageHandlers object", () => {
      const initAutofillOverlayButtonSpy = jest.fn();
      autofillOverlayPageElement["setupGlobalListeners"](
        mock<OverlayButtonWindowMessageHandlers>({
          initAutofillOverlayButton: initAutofillOverlayButtonSpy,
        }),
      );

      globalThis.dispatchEvent(new MessageEvent("message", { data: { command: "test" } }));

      expect(initAutofillOverlayButtonSpy).not.toHaveBeenCalled();
    });

    it("posts a message to the parent when the window is blurred", () => {
      autofillOverlayPageElement["messageOrigin"] = "https://jest-testing-website.com";
      autofillOverlayPageElement["setupGlobalListeners"](
        mock<OverlayButtonWindowMessageHandlers>(),
      );

      globalThis.dispatchEvent(new Event("blur"));

      expect(globalThis.parent.postMessage).toHaveBeenCalledWith(
        { command: "overlayPageBlurred" },
        "https://jest-testing-website.com",
      );
    });

    it("skips redirecting keyboard focus when a KeyDown event triggers and the key is not a `Tab` or `Escape` key", () => {
      autofillOverlayPageElement["setupGlobalListeners"](
        mock<OverlayButtonWindowMessageHandlers>(),
      );

      globalThis.document.dispatchEvent(new KeyboardEvent("keydown", { code: "test" }));

      expect(globalThis.parent.postMessage).not.toHaveBeenCalled();
    });

    it("redirects the overlay focus out to the previous element on KeyDown of the `Tab+Shift` keys", () => {
      autofillOverlayPageElement["messageOrigin"] = "https://jest-testing-website.com";
      autofillOverlayPageElement["setupGlobalListeners"](
        mock<OverlayButtonWindowMessageHandlers>(),
      );

      globalThis.document.dispatchEvent(
        new KeyboardEvent("keydown", { code: "Tab", shiftKey: true }),
      );

      expect(globalThis.parent.postMessage).toHaveBeenCalledWith(
        { command: "redirectOverlayFocusOut", direction: "previous" },
        "https://jest-testing-website.com",
      );
    });

    it("redirects the overlay focus out to the next element on KeyDown of the `Tab` key", () => {
      autofillOverlayPageElement["messageOrigin"] = "https://jest-testing-website.com";
      autofillOverlayPageElement["setupGlobalListeners"](
        mock<OverlayButtonWindowMessageHandlers>(),
      );

      globalThis.document.dispatchEvent(new KeyboardEvent("keydown", { code: "Tab" }));

      expect(globalThis.parent.postMessage).toHaveBeenCalledWith(
        { command: "redirectOverlayFocusOut", direction: "next" },
        "https://jest-testing-website.com",
      );
    });

    it("redirects the overlay focus out to the current element on KeyDown of the `Escape` key", () => {
      autofillOverlayPageElement["messageOrigin"] = "https://jest-testing-website.com";
      autofillOverlayPageElement["setupGlobalListeners"](
        mock<OverlayButtonWindowMessageHandlers>(),
      );

      globalThis.document.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape" }));

      expect(globalThis.parent.postMessage).toHaveBeenCalledWith(
        { command: "redirectOverlayFocusOut", direction: "current" },
        "https://jest-testing-website.com",
      );
    });
  });
});
