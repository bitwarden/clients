import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";

import { createInitAutofillInlineMenuButtonMessageMock } from "../../../../spec/autofill-mocks";
import { flushPromises, postWindowMessage } from "../../../../spec/testing-utils";

import { AutofillInlineMenuButton } from "./autofill-inline-menu-button";

describe("AutofillInlineMenuButton", () => {
  globalThis.customElements.define("autofill-inline-menu-button", AutofillInlineMenuButton);

  let autofillInlineMenuButton: AutofillInlineMenuButton;
  const portKey: string = "inlineMenuButtonPortKey";

  beforeEach(() => {
    document.body.innerHTML = `<autofill-inline-menu-button></autofill-inline-menu-button>`;
    autofillInlineMenuButton = document.querySelector("autofill-inline-menu-button");
    autofillInlineMenuButton["messageOrigin"] = "https://localhost/";
    jest.spyOn(globalThis.document, "createElement");
    jest.spyOn(globalThis.parent, "postMessage");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("initAutofillInlineMenuButton", () => {
    it("creates the button element with the locked icon when the user's auth status is not Unlocked", async () => {
      postWindowMessage(
        createInitAutofillInlineMenuButtonMessageMock({
          authStatus: AuthenticationStatus.Locked,
          portKey,
        }),
      );
      await flushPromises();

      expect(autofillInlineMenuButton["buttonElement"]).toMatchSnapshot();
      expect(autofillInlineMenuButton["buttonElement"].querySelector("svg")).toBe(
        autofillInlineMenuButton["logoLockedIconElement"],
      );
    });

    it("creates the button element with the normal icon when the user's auth status is Unlocked ", async () => {
      postWindowMessage(createInitAutofillInlineMenuButtonMessageMock({ portKey }));
      await flushPromises();

      expect(autofillInlineMenuButton["buttonElement"]).toMatchSnapshot();
      expect(autofillInlineMenuButton["buttonElement"].querySelector("svg")).toBe(
        autofillInlineMenuButton["logoIconElement"],
      );
    });

    it("posts a message to the background indicating that the icon was clicked", async () => {
      postWindowMessage(createInitAutofillInlineMenuButtonMessageMock({ portKey }));
      await flushPromises();

      autofillInlineMenuButton["buttonElement"].click();

      expect(globalThis.parent.postMessage).toHaveBeenCalledWith(
        { command: "autofillInlineMenuButtonClicked", portKey },
        "*",
      );
    });
  });

  describe("global event listeners", () => {
    beforeEach(() => {
      postWindowMessage(createInitAutofillInlineMenuButtonMessageMock({ portKey }));
    });

    it("does not post a message to close the autofill inline menu if the element is focused during the focus check", async () => {
      jest.spyOn(globalThis.document, "hasFocus").mockReturnValue(true);

      postWindowMessage({ command: "checkAutofillInlineMenuButtonFocused" });
      await flushPromises();

      expect(globalThis.parent.postMessage).not.toHaveBeenCalledWith({
        command: "triggerDelayedAutofillInlineMenuClosure",
      });
    });

    it("does not post a message to close the autofill inline menu if the button element is hovered", async () => {
      jest.spyOn(globalThis.document, "hasFocus").mockReturnValue(false);
      jest
        .spyOn(autofillInlineMenuButton["buttonElement"], "querySelector")
        .mockReturnValue(autofillInlineMenuButton["buttonElement"]);

      postWindowMessage({ command: "checkAutofillInlineMenuButtonFocused" });
      await flushPromises();

      expect(globalThis.parent.postMessage).not.toHaveBeenCalledWith({
        command: "triggerDelayedAutofillInlineMenuClosure",
      });
    });

    it("triggers a recheck of the button focus state on mouseout", async () => {
      jest.spyOn(globalThis.document, "removeEventListener");
      jest.spyOn(globalThis.document, "hasFocus").mockReturnValue(false);
      jest
        .spyOn(autofillInlineMenuButton["buttonElement"], "querySelector")
        .mockReturnValue(autofillInlineMenuButton["buttonElement"]);
      postWindowMessage({ command: "checkAutofillInlineMenuButtonFocused" });
      await flushPromises();

      globalThis.document.dispatchEvent(new MouseEvent("mouseout"));

      expect(globalThis.document.removeEventListener).toHaveBeenCalledWith(
        "mouseout",
        autofillInlineMenuButton["handleMouseOutEvent"],
      );
    });

    it("posts a message to close the autofill inline menu if the element is not focused during the focus check", async () => {
      jest.spyOn(globalThis.document, "hasFocus").mockReturnValue(false);
      jest.spyOn(autofillInlineMenuButton["buttonElement"], "querySelector").mockReturnValue(null);

      postWindowMessage({ command: "checkAutofillInlineMenuButtonFocused" });
      await flushPromises();

      expect(globalThis.parent.postMessage).toHaveBeenCalledWith(
        { command: "triggerDelayedAutofillInlineMenuClosure", portKey },
        "*",
      );
    });

    it("updates the user's auth status", async () => {
      autofillInlineMenuButton["authStatus"] = AuthenticationStatus.Locked;

      postWindowMessage({
        command: "updateAutofillInlineMenuButtonAuthStatus",
        authStatus: AuthenticationStatus.Unlocked,
      });
      await flushPromises();

      expect(autofillInlineMenuButton["authStatus"]).toBe(AuthenticationStatus.Unlocked);
    });

    it("updates the page color scheme meta tag", async () => {
      const colorSchemeMetaTag = globalThis.document.createElement("meta");
      colorSchemeMetaTag.setAttribute("name", "color-scheme");
      colorSchemeMetaTag.setAttribute("content", "light");
      globalThis.document.head.append(colorSchemeMetaTag);

      postWindowMessage({
        command: "updateAutofillInlineMenuColorScheme",
        colorScheme: "dark",
      });
      await flushPromises();

      expect(colorSchemeMetaTag.getAttribute("content")).toBe("dark");
    });
  });
});
