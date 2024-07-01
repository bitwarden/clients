import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";

import { postWindowMessage } from "../../../../spec/testing-utils";
import { InitAutofillOverlayButtonMessage } from "../../abstractions/autofill-overlay-button.deprecated";

import AutofillOverlayButton from "./autofill-overlay-button.deprecated";

const overlayPagesTranslations = {
  locale: "en",
  buttonPageTitle: "buttonPageTitle",
  listPageTitle: "listPageTitle",
  opensInANewWindow: "opensInANewWindow",
  toggleBitwardenVaultOverlay: "toggleBitwardenVaultOverlay",
  unlockYourAccount: "unlockYourAccount",
  unlockAccount: "unlockAccount",
  fillCredentialsFor: "fillCredentialsFor",
  partialUsername: "partialUsername",
  view: "view",
  noItemsToShow: "noItemsToShow",
  newItem: "newItem",
  addNewVaultItem: "addNewVaultItem",
};
function createInitAutofillOverlayButtonMessageMock(
  customFields = {},
): InitAutofillOverlayButtonMessage {
  return {
    command: "initAutofillOverlayButton",
    translations: overlayPagesTranslations,
    styleSheetUrl: "https://jest-testing-website.com",
    authStatus: AuthenticationStatus.Unlocked,
    ...customFields,
  };
}

describe("AutofillOverlayButton", () => {
  globalThis.customElements.define("autofill-overlay-button", AutofillOverlayButton);

  let autofillOverlayButton: AutofillOverlayButton;

  beforeEach(() => {
    document.body.innerHTML = `<autofill-overlay-button></autofill-overlay-button>`;
    autofillOverlayButton = document.querySelector("autofill-overlay-button");
    autofillOverlayButton["messageOrigin"] = "https://localhost/";
    jest.spyOn(globalThis.document, "createElement");
    jest.spyOn(globalThis.parent, "postMessage");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("initAutofillOverlayButton", () => {
    it("creates the button element with the locked icon when the user's auth status is not Unlocked", () => {
      postWindowMessage(
        createInitAutofillOverlayButtonMessageMock({ authStatus: AuthenticationStatus.Locked }),
      );

      expect(autofillOverlayButton["buttonElement"]).toMatchSnapshot();
      expect(autofillOverlayButton["buttonElement"].querySelector("svg")).toBe(
        autofillOverlayButton["logoLockedIconElement"],
      );
    });

    it("creates the button element with the normal icon when the user's auth status is Unlocked ", () => {
      postWindowMessage(createInitAutofillOverlayButtonMessageMock());

      expect(autofillOverlayButton["buttonElement"]).toMatchSnapshot();
      expect(autofillOverlayButton["buttonElement"].querySelector("svg")).toBe(
        autofillOverlayButton["logoIconElement"],
      );
    });

    it("posts a message to the background indicating that the icon was clicked", () => {
      postWindowMessage(createInitAutofillOverlayButtonMessageMock());
      autofillOverlayButton["buttonElement"].click();

      expect(globalThis.parent.postMessage).toHaveBeenCalledWith(
        { command: "overlayButtonClicked" },
        "https://localhost/",
      );
    });
  });

  describe("global event listeners", () => {
    beforeEach(() => {
      postWindowMessage(createInitAutofillOverlayButtonMessageMock());
    });

    it("does not post a message to close the autofill overlay if the element is focused during the focus check", () => {
      jest.spyOn(globalThis.document, "hasFocus").mockReturnValue(true);

      postWindowMessage({ command: "checkAutofillOverlayButtonFocused" });

      expect(globalThis.parent.postMessage).not.toHaveBeenCalledWith({
        command: "closeAutofillOverlay",
      });
    });

    it("posts a message to close the autofill overlay if the element is not focused during the focus check", () => {
      jest.spyOn(globalThis.document, "hasFocus").mockReturnValue(false);

      postWindowMessage({ command: "checkAutofillOverlayButtonFocused" });

      expect(globalThis.parent.postMessage).toHaveBeenCalledWith(
        { command: "closeAutofillOverlay" },
        "https://localhost/",
      );
    });

    it("updates the user's auth status", () => {
      autofillOverlayButton["authStatus"] = AuthenticationStatus.Locked;

      postWindowMessage({
        command: "updateAutofillOverlayButtonAuthStatus",
        authStatus: AuthenticationStatus.Unlocked,
      });

      expect(autofillOverlayButton["authStatus"]).toBe(AuthenticationStatus.Unlocked);
    });

    it("updates the page color scheme meta tag", () => {
      const colorSchemeMetaTag = globalThis.document.createElement("meta");
      colorSchemeMetaTag.setAttribute("name", "color-scheme");
      colorSchemeMetaTag.setAttribute("content", "light");
      globalThis.document.head.append(colorSchemeMetaTag);

      postWindowMessage({
        command: "updateOverlayPageColorScheme",
        colorScheme: "dark",
      });

      expect(colorSchemeMetaTag.getAttribute("content")).toBe("dark");
    });
  });
});
