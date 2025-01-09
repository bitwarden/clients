import { mock } from "jest-mock-extended";

import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { ThemeType } from "@bitwarden/common/platform/enums";

import { createAutofillOverlayCipherDataMock } from "../../../../spec/autofill-mocks";
import { postWindowMessage } from "../../../../spec/testing-utils";
import { InitAutofillOverlayListMessage } from "../../abstractions/autofill-overlay-list.deprecated";

import AutofillOverlayList from "./autofill-overlay-list.deprecated";

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
function createInitAutofillOverlayListMessageMock(
  customFields = {},
): InitAutofillOverlayListMessage {
  return {
    command: "initAutofillOverlayList",
    translations: overlayPagesTranslations,
    styleSheetUrl: "https://jest-testing-website.com",
    theme: ThemeType.Light,
    authStatus: AuthenticationStatus.Unlocked,
    ciphers: [
      createAutofillOverlayCipherDataMock(1, {
        icon: {
          imageEnabled: true,
          image: "https://jest-testing-website.com/image.png",
          fallbackImage: "",
          icon: "bw-icon",
        },
      }),
      createAutofillOverlayCipherDataMock(2, {
        icon: {
          imageEnabled: true,
          image: "",
          fallbackImage: "https://jest-testing-website.com/fallback.png",
          icon: "bw-icon",
        },
      }),
      createAutofillOverlayCipherDataMock(3, {
        name: "",
        login: { username: "" },
        icon: { imageEnabled: true, image: "", fallbackImage: "", icon: "bw-icon" },
      }),
      createAutofillOverlayCipherDataMock(4, {
        icon: { imageEnabled: false, image: "", fallbackImage: "", icon: "" },
      }),
      createAutofillOverlayCipherDataMock(5),
      createAutofillOverlayCipherDataMock(6),
      createAutofillOverlayCipherDataMock(7),
      createAutofillOverlayCipherDataMock(8),
    ],
    ...customFields,
  };
}

describe("AutofillOverlayList", () => {
  globalThis.customElements.define("autofill-overlay-list", AutofillOverlayList);
  global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));

  let autofillOverlayList: AutofillOverlayList;

  beforeEach(() => {
    document.body.innerHTML = `<autofill-overlay-list></autofill-overlay-list>`;
    autofillOverlayList = document.querySelector("autofill-overlay-list");
    autofillOverlayList["messageOrigin"] = "https://localhost/";
    jest.spyOn(globalThis.document, "createElement");
    jest.spyOn(globalThis.parent, "postMessage");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("initAutofillOverlayList", () => {
    describe("the locked overlay for an unauthenticated user", () => {
      beforeEach(() => {
        postWindowMessage(
          createInitAutofillOverlayListMessageMock({
            authStatus: AuthenticationStatus.Locked,
            cipherList: [],
          }),
        );
      });

      it("creates the views for the locked overlay", () => {
        expect(autofillOverlayList["overlayListContainer"]).toMatchSnapshot();
      });

      it("allows the user to unlock the vault", () => {
        const unlockButton =
          autofillOverlayList["overlayListContainer"].querySelector("#unlock-button");

        unlockButton.dispatchEvent(new Event("click"));

        expect(globalThis.parent.postMessage).toHaveBeenCalledWith(
          { command: "unlockVault" },
          "https://localhost/",
        );
      });
    });

    describe("the overlay with an empty list of ciphers", () => {
      beforeEach(() => {
        postWindowMessage(
          createInitAutofillOverlayListMessageMock({
            authStatus: AuthenticationStatus.Unlocked,
            ciphers: [],
          }),
        );
      });

      it("creates the views for the no results overlay", () => {
        expect(autofillOverlayList["overlayListContainer"]).toMatchSnapshot();
      });

      it("allows the user to add a vault item", () => {
        const addVaultItemButton =
          autofillOverlayList["overlayListContainer"].querySelector("#new-item-button");

        addVaultItemButton.dispatchEvent(new Event("click"));

        expect(globalThis.parent.postMessage).toHaveBeenCalledWith(
          { command: "addNewVaultItem" },
          "https://localhost/",
        );
      });
    });

    describe("the list of ciphers for an authenticated user", () => {
      beforeEach(() => {
        postWindowMessage(createInitAutofillOverlayListMessageMock());
      });

      it("creates the view for a list of ciphers", () => {
        expect(autofillOverlayList["overlayListContainer"]).toMatchSnapshot();
      });

      it("loads ciphers on scroll one page at a time", () => {
        jest.useFakeTimers();
        const originalListOfElements =
          autofillOverlayList["overlayListContainer"].querySelectorAll(".cipher-container");

        autofillOverlayList["handleCiphersListScrollEvent"]();
        jest.runAllTimers();

        const updatedListOfElements =
          autofillOverlayList["overlayListContainer"].querySelectorAll(".cipher-container");

        expect(originalListOfElements.length).toBe(6);
        expect(updatedListOfElements.length).toBe(8);
      });

      it("debounces the ciphers scroll handler", () => {
        jest.useFakeTimers();
        autofillOverlayList["cipherListScrollDebounceTimeout"] = setTimeout(jest.fn, 0);
        const handleDebouncedScrollEventSpy = jest.spyOn(
          autofillOverlayList as any,
          "handleDebouncedScrollEvent",
        );

        autofillOverlayList["handleCiphersListScrollEvent"]();
        jest.advanceTimersByTime(100);
        autofillOverlayList["handleCiphersListScrollEvent"]();
        jest.advanceTimersByTime(100);
        autofillOverlayList["handleCiphersListScrollEvent"]();
        jest.advanceTimersByTime(400);

        expect(handleDebouncedScrollEventSpy).toHaveBeenCalledTimes(1);
      });

      describe("fill cipher button event listeners", () => {
        beforeEach(() => {
          postWindowMessage(createInitAutofillOverlayListMessageMock());
        });

        it("allows the user to fill a cipher on click", () => {
          const fillCipherButton =
            autofillOverlayList["overlayListContainer"].querySelector(".fill-cipher-button");

          fillCipherButton.dispatchEvent(new Event("click"));

          expect(globalThis.parent.postMessage).toHaveBeenCalledWith(
            { command: "fillSelectedListItem", overlayCipherId: "1" },
            "https://localhost/",
          );
        });

        it("allows the user to move keyboard focus to the next cipher element on ArrowDown", () => {
          const fillCipherElements =
            autofillOverlayList["overlayListContainer"].querySelectorAll(".fill-cipher-button");
          const firstFillCipherElement = fillCipherElements[0];
          const secondFillCipherElement = fillCipherElements[1];
          jest.spyOn(secondFillCipherElement as HTMLElement, "focus");

          firstFillCipherElement.dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowDown" }));

          expect((secondFillCipherElement as HTMLElement).focus).toBeCalled();
        });

        it("directs focus to the first item in the cipher list if no cipher is present after the current one when pressing ArrowDown", () => {
          const fillCipherElements =
            autofillOverlayList["overlayListContainer"].querySelectorAll(".fill-cipher-button");
          const lastFillCipherElement = fillCipherElements[fillCipherElements.length - 1];
          const firstFillCipherElement = fillCipherElements[0];
          jest.spyOn(firstFillCipherElement as HTMLElement, "focus");

          lastFillCipherElement.dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowDown" }));

          expect((firstFillCipherElement as HTMLElement).focus).toBeCalled();
        });

        it("allows the user to move keyboard focus to the previous cipher element on ArrowUp", () => {
          const fillCipherElements =
            autofillOverlayList["overlayListContainer"].querySelectorAll(".fill-cipher-button");
          const firstFillCipherElement = fillCipherElements[0];
          const secondFillCipherElement = fillCipherElements[1];
          jest.spyOn(firstFillCipherElement as HTMLElement, "focus");

          secondFillCipherElement.dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowUp" }));

          expect((firstFillCipherElement as HTMLElement).focus).toBeCalled();
        });

        it("directs focus to the last item in the cipher list if no cipher is present before the current one when pressing ArrowUp", () => {
          const fillCipherElements =
            autofillOverlayList["overlayListContainer"].querySelectorAll(".fill-cipher-button");
          const firstFillCipherElement = fillCipherElements[0];
          const lastFillCipherElement = fillCipherElements[fillCipherElements.length - 1];
          jest.spyOn(lastFillCipherElement as HTMLElement, "focus");

          firstFillCipherElement.dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowUp" }));

          expect((lastFillCipherElement as HTMLElement).focus).toBeCalled();
        });

        it("allows the user to move keyboard focus to the view cipher button on ArrowRight", () => {
          const cipherContainerElement =
            autofillOverlayList["overlayListContainer"].querySelector(".cipher-container");
          const fillCipherElement = cipherContainerElement.querySelector(".fill-cipher-button");
          const viewCipherButton = cipherContainerElement.querySelector(".view-cipher-button");
          jest.spyOn(viewCipherButton as HTMLElement, "focus");

          fillCipherElement.dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowRight" }));

          expect((viewCipherButton as HTMLElement).focus).toBeCalled();
        });

        it("ignores keyup events that do not include ArrowUp, ArrowDown, or ArrowRight", () => {
          const fillCipherElement =
            autofillOverlayList["overlayListContainer"].querySelector(".fill-cipher-button");
          jest.spyOn(fillCipherElement as HTMLElement, "focus");

          fillCipherElement.dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowLeft" }));

          expect((fillCipherElement as HTMLElement).focus).not.toBeCalled();
        });
      });

      describe("view cipher button event listeners", () => {
        beforeEach(() => {
          postWindowMessage(createInitAutofillOverlayListMessageMock());
        });

        it("allows the user to view a cipher on click", () => {
          const viewCipherButton =
            autofillOverlayList["overlayListContainer"].querySelector(".view-cipher-button");

          viewCipherButton.dispatchEvent(new Event("click"));

          expect(globalThis.parent.postMessage).toHaveBeenCalledWith(
            { command: "viewSelectedCipher", overlayCipherId: "1" },
            "https://localhost/",
          );
        });

        it("allows the user to move keyboard focus to the current cipher element on ArrowLeft", () => {
          const cipherContainerElement =
            autofillOverlayList["overlayListContainer"].querySelector(".cipher-container");
          const fillCipherButton = cipherContainerElement.querySelector(".fill-cipher-button");
          const viewCipherButton = cipherContainerElement.querySelector(".view-cipher-button");
          jest.spyOn(fillCipherButton as HTMLElement, "focus");

          viewCipherButton.dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowLeft" }));

          expect((fillCipherButton as HTMLElement).focus).toBeCalled();
        });

        it("allows the user to move keyboard to the next cipher element on ArrowDown", () => {
          const cipherContainerElements =
            autofillOverlayList["overlayListContainer"].querySelectorAll(".cipher-container");
          const viewCipherButton = cipherContainerElements[0].querySelector(".view-cipher-button");
          const secondFillCipherButton =
            cipherContainerElements[1].querySelector(".fill-cipher-button");
          jest.spyOn(secondFillCipherButton as HTMLElement, "focus");

          viewCipherButton.dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowDown" }));

          expect((secondFillCipherButton as HTMLElement).focus).toBeCalled();
        });

        it("allows the user to move keyboard focus to the previous cipher element on ArrowUp", () => {
          const cipherContainerElements =
            autofillOverlayList["overlayListContainer"].querySelectorAll(".cipher-container");
          const viewCipherButton = cipherContainerElements[1].querySelector(".view-cipher-button");
          const firstFillCipherButton =
            cipherContainerElements[0].querySelector(".fill-cipher-button");
          jest.spyOn(firstFillCipherButton as HTMLElement, "focus");

          viewCipherButton.dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowUp" }));

          expect((firstFillCipherButton as HTMLElement).focus).toBeCalled();
        });

        it("ignores keyup events that do not include ArrowUp, ArrowDown, or ArrowRight", () => {
          const viewCipherButton =
            autofillOverlayList["overlayListContainer"].querySelector(".view-cipher-button");
          jest.spyOn(viewCipherButton as HTMLElement, "focus");

          viewCipherButton.dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowRight" }));

          expect((viewCipherButton as HTMLElement).focus).not.toBeCalled();
        });
      });
    });
  });

  describe("global event listener handlers", () => {
    it("does not post a `checkAutofillOverlayButtonFocused` message to the parent if the overlay is currently focused", () => {
      jest.spyOn(globalThis.document, "hasFocus").mockReturnValue(true);

      postWindowMessage({ command: "checkAutofillOverlayListFocused" });

      expect(globalThis.parent.postMessage).not.toHaveBeenCalled();
    });

    it("posts a `checkAutofillOverlayButtonFocused` message to the parent if the overlay is not currently focused", () => {
      jest.spyOn(globalThis.document, "hasFocus").mockReturnValue(false);

      postWindowMessage({ command: "checkAutofillOverlayListFocused" });

      expect(globalThis.parent.postMessage).toHaveBeenCalledWith(
        { command: "checkAutofillOverlayButtonFocused" },
        "https://localhost/",
      );
    });

    it("updates the list of ciphers", () => {
      postWindowMessage(createInitAutofillOverlayListMessageMock());
      const updateCiphersSpy = jest.spyOn(autofillOverlayList as any, "updateListItems");

      postWindowMessage({ command: "updateOverlayListCiphers" });

      expect(updateCiphersSpy).toHaveBeenCalled();
    });

    describe("directing user focus into the overlay list", () => {
      it("sets ARIA attributes that define the list as a `dialog` to screen reader users", () => {
        postWindowMessage(
          createInitAutofillOverlayListMessageMock({
            authStatus: AuthenticationStatus.Locked,
            cipherList: [],
          }),
        );
        const overlayContainerSetAttributeSpy = jest.spyOn(
          autofillOverlayList["overlayListContainer"],
          "setAttribute",
        );

        postWindowMessage({ command: "focusOverlayList" });

        expect(overlayContainerSetAttributeSpy).toHaveBeenCalledWith("role", "dialog");
        expect(overlayContainerSetAttributeSpy).toHaveBeenCalledWith("aria-modal", "true");
      });

      it("focuses the unlock button element if the user is not authenticated", () => {
        postWindowMessage(
          createInitAutofillOverlayListMessageMock({
            authStatus: AuthenticationStatus.Locked,
            cipherList: [],
          }),
        );
        const unlockButton =
          autofillOverlayList["overlayListContainer"].querySelector("#unlock-button");
        jest.spyOn(unlockButton as HTMLElement, "focus");

        postWindowMessage({ command: "focusOverlayList" });

        expect((unlockButton as HTMLElement).focus).toBeCalled();
      });

      it("focuses the new item button element if the cipher list is empty", () => {
        postWindowMessage(createInitAutofillOverlayListMessageMock({ ciphers: [] }));
        const newItemButton =
          autofillOverlayList["overlayListContainer"].querySelector("#new-item-button");
        jest.spyOn(newItemButton as HTMLElement, "focus");

        postWindowMessage({ command: "focusOverlayList" });

        expect((newItemButton as HTMLElement).focus).toBeCalled();
      });

      it("focuses the first cipher button element if the cipher list is populated", () => {
        postWindowMessage(createInitAutofillOverlayListMessageMock());
        const firstCipherItem =
          autofillOverlayList["overlayListContainer"].querySelector(".fill-cipher-button");
        jest.spyOn(firstCipherItem as HTMLElement, "focus");

        postWindowMessage({ command: "focusOverlayList" });

        expect((firstCipherItem as HTMLElement).focus).toBeCalled();
      });
    });
  });

  describe("handleResizeObserver", () => {
    beforeEach(() => {
      postWindowMessage(createInitAutofillOverlayListMessageMock());
    });

    it("ignores resize entries whose target is not the overlay list", () => {
      const entries = [
        {
          target: mock<HTMLElement>(),
          contentRect: { height: 300 },
        },
      ];

      autofillOverlayList["handleResizeObserver"](entries as unknown as ResizeObserverEntry[]);

      expect(globalThis.parent.postMessage).not.toHaveBeenCalled();
    });

    it("posts a message to update the overlay list height if the list container is resized", () => {
      const entries = [
        {
          target: autofillOverlayList["overlayListContainer"],
          contentRect: { height: 300 },
        },
      ];

      autofillOverlayList["handleResizeObserver"](entries as unknown as ResizeObserverEntry[]);

      expect(globalThis.parent.postMessage).toHaveBeenCalledWith(
        { command: "updateAutofillOverlayListHeight", styles: { height: "300px" } },
        "https://localhost/",
      );
    });
  });
});
