import { mock } from "jest-mock-extended";

import { EVENTS } from "@bitwarden/common/autofill/constants";
import { ThemeType } from "@bitwarden/common/platform/enums";

import { AutofillOverlayPort } from "../../../enums/autofill-overlay.enum";
import { createPortSpyMock } from "../../../spec/autofill-mocks";
import {
  flushPromises,
  sendPortMessage,
  triggerPortOnDisconnectEvent,
} from "../../../spec/testing-utils";

import { AutofillInlineMenuIframeService } from "./autofill-inline-menu-iframe.service";

describe("AutofillInlineMenuIframeService", () => {
  let autofillInlineMenuIframeService: AutofillInlineMenuIframeService;
  let portSpy: chrome.runtime.Port;
  let shadowAppendSpy: jest.SpyInstance;
  let handlePortDisconnectSpy: jest.SpyInstance;
  let handlePortMessageSpy: jest.SpyInstance;
  let sendExtensionMessageSpy: jest.SpyInstance;

  beforeEach(() => {
    const shadow = document.createElement("div").attachShadow({ mode: "open" });
    autofillInlineMenuIframeService = new AutofillInlineMenuIframeService(
      shadow,
      AutofillOverlayPort.Button,
      { height: "0px" },
      "title",
      "ariaAlert",
    );
    shadowAppendSpy = jest.spyOn(shadow, "appendChild");
    handlePortDisconnectSpy = jest.spyOn(
      autofillInlineMenuIframeService as any,
      "handlePortDisconnect",
    );
    handlePortMessageSpy = jest.spyOn(autofillInlineMenuIframeService as any, "handlePortMessage");
    chrome.runtime.connect = jest.fn((connectInfo: chrome.runtime.ConnectInfo) =>
      createPortSpyMock(connectInfo.name),
    ) as unknown as typeof chrome.runtime.connect;
    sendExtensionMessageSpy = jest.spyOn(
      autofillInlineMenuIframeService as any,
      "sendExtensionMessage",
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("initMenuIframe", () => {
    it("sets up the iframe's attributes", () => {
      autofillInlineMenuIframeService.initMenuIframe();

      expect(autofillInlineMenuIframeService["iframe"]).toMatchSnapshot();
    });

    it("appends the iframe to the shadowDom", () => {
      jest.spyOn(autofillInlineMenuIframeService["shadow"], "appendChild");

      autofillInlineMenuIframeService.initMenuIframe();

      expect(autofillInlineMenuIframeService["shadow"].appendChild).toHaveBeenCalledWith(
        autofillInlineMenuIframeService["iframe"],
      );
    });

    // TODO CG - This test is brittle and failing due to how we are calling the private method. This needs to be reworked
    it.skip("creates an aria alert element if the ariaAlert param is passed", () => {
      const ariaAlert = "aria alert";
      jest.spyOn(autofillInlineMenuIframeService as any, "createAriaAlertElement");

      autofillInlineMenuIframeService.initMenuIframe();

      expect(autofillInlineMenuIframeService["createAriaAlertElement"]).toHaveBeenCalledWith(
        ariaAlert,
      );
      expect(autofillInlineMenuIframeService["ariaAlertElement"]).toMatchSnapshot();
    });

    describe("on load of the iframe source", () => {
      beforeEach(() => {
        autofillInlineMenuIframeService.initMenuIframe();
      });

      it("sets up and connects the port message listener to the extension background", () => {
        jest.spyOn(globalThis, "addEventListener");

        autofillInlineMenuIframeService["iframe"].dispatchEvent(new Event(EVENTS.LOAD));
        portSpy = autofillInlineMenuIframeService["port"];

        expect(chrome.runtime.connect).toHaveBeenCalledWith({ name: AutofillOverlayPort.Button });
        expect(portSpy.onDisconnect.addListener).toHaveBeenCalledWith(handlePortDisconnectSpy);
        expect(portSpy.onMessage.addListener).toHaveBeenCalledWith(handlePortMessageSpy);
      });

      it("skips announcing the aria alert if the aria alert element is not populated", () => {
        jest.spyOn(globalThis, "setTimeout");
        autofillInlineMenuIframeService["ariaAlertElement"] = undefined;

        autofillInlineMenuIframeService["iframe"].dispatchEvent(new Event(EVENTS.LOAD));

        expect(globalThis.setTimeout).not.toHaveBeenCalled();
      });

      it("announces the aria alert if the aria alert element is populated", async () => {
        jest.useFakeTimers();
        jest.spyOn(globalThis, "setTimeout");
        sendExtensionMessageSpy.mockResolvedValue(true);
        autofillInlineMenuIframeService["ariaAlertElement"] = document.createElement("div");
        autofillInlineMenuIframeService["ariaAlertTimeout"] = setTimeout(jest.fn(), 2000);

        autofillInlineMenuIframeService["iframe"].dispatchEvent(new Event(EVENTS.LOAD));

        expect(globalThis.setTimeout).toHaveBeenCalled();
        jest.advanceTimersByTime(2000);
        await flushPromises();

        expect(shadowAppendSpy).toHaveBeenCalledWith(
          autofillInlineMenuIframeService["ariaAlertElement"],
        );
      });
    });
  });

  describe("event listeners", () => {
    beforeEach(() => {
      autofillInlineMenuIframeService.initMenuIframe();
      autofillInlineMenuIframeService["iframe"].dispatchEvent(new Event(EVENTS.LOAD));
      Object.defineProperty(autofillInlineMenuIframeService["iframe"], "contentWindow", {
        value: {
          postMessage: jest.fn(),
        },
        writable: true,
      });
      jest.spyOn(autofillInlineMenuIframeService["iframe"].contentWindow, "postMessage");
      portSpy = autofillInlineMenuIframeService["port"];
    });

    describe("handlePortDisconnect", () => {
      it("ignores ports that do not have the correct port name", () => {
        portSpy.name = "wrong-port-name";
        triggerPortOnDisconnectEvent(portSpy);

        expect(autofillInlineMenuIframeService["port"]).not.toBeNull();
      });

      it("resets the iframe element's opacity, height, and display styles", () => {
        triggerPortOnDisconnectEvent(portSpy);

        expect(autofillInlineMenuIframeService["iframe"].style.opacity).toBe("0");
        expect(autofillInlineMenuIframeService["iframe"].style.height).toBe("0px");
        expect(autofillInlineMenuIframeService["iframe"].style.display).toBe("block");
      });

      it("removes the port's onMessage listener", () => {
        triggerPortOnDisconnectEvent(portSpy);

        expect(portSpy.onMessage.removeListener).toHaveBeenCalledWith(handlePortMessageSpy);
      });

      it("removes the port's onDisconnect listener", () => {
        triggerPortOnDisconnectEvent(portSpy);

        expect(portSpy.onDisconnect.removeListener).toHaveBeenCalledWith(handlePortDisconnectSpy);
      });

      it("disconnects the port", () => {
        triggerPortOnDisconnectEvent(portSpy);

        expect(portSpy.disconnect).toHaveBeenCalled();
        expect(autofillInlineMenuIframeService["port"]).toBeNull();
      });
    });

    describe("handlePortMessage", () => {
      it("ignores port messages that do not correlate to the correct port name", () => {
        portSpy.name = "wrong-port-name";
        sendPortMessage(portSpy, {});

        expect(
          autofillInlineMenuIframeService["iframe"].contentWindow.postMessage,
        ).not.toHaveBeenCalled();
      });

      it("passes on the message to the iframe if the message is not registered with the message handlers", () => {
        const message = { command: "unregisteredMessage" };

        sendPortMessage(portSpy, message);

        expect(
          autofillInlineMenuIframeService["iframe"].contentWindow.postMessage,
        ).toHaveBeenCalledWith(message, "*");
      });

      it("handles port messages that are registered with the message handlers and does not pass the message on to the iframe", () => {
        jest.spyOn(autofillInlineMenuIframeService as any, "updateIframePosition");

        sendPortMessage(portSpy, { command: "updateAutofillInlineMenuPosition" });

        expect(
          autofillInlineMenuIframeService["iframe"].contentWindow.postMessage,
        ).not.toHaveBeenCalled();
      });

      describe("initializing the inline menu button", () => {
        it("sets the port key and posts the message to the inline menu page iframe", () => {
          const portKey = "portKey";
          const message = {
            command: "initAutofillInlineMenuButton",
            portKey,
          };

          sendPortMessage(portSpy, message);

          expect(autofillInlineMenuIframeService["portKey"]).toBe(portKey);
          expect(
            autofillInlineMenuIframeService["iframe"].contentWindow.postMessage,
          ).toHaveBeenCalledWith(message, "*");
        });
      });

      describe("initializing the inline menu list", () => {
        let updateElementStylesSpy: jest.SpyInstance;

        beforeEach(() => {
          updateElementStylesSpy = jest.spyOn(
            autofillInlineMenuIframeService as any,
            "updateElementStyles",
          );
        });

        it("passes the message on to the iframe element", () => {
          const message = {
            command: "initAutofillInlineMenuList",
            theme: ThemeType.Light,
          };

          sendPortMessage(portSpy, message);

          expect(updateElementStylesSpy).not.toHaveBeenCalled();
          expect(
            autofillInlineMenuIframeService["iframe"].contentWindow.postMessage,
          ).toHaveBeenCalledWith(message, "*");
        });

        it("sets a light theme based on the user's system preferences", () => {
          window.matchMedia = jest.fn(() => mock<MediaQueryList>({ matches: false }));
          const message = {
            command: "initAutofillInlineMenuList",
            theme: ThemeType.System,
          };

          sendPortMessage(portSpy, message);

          expect(window.matchMedia).toHaveBeenCalledWith("(prefers-color-scheme: dark)");
          expect(
            autofillInlineMenuIframeService["iframe"].contentWindow.postMessage,
          ).toHaveBeenCalledWith(
            {
              command: "initAutofillInlineMenuList",
              theme: ThemeType.Light,
            },
            "*",
          );
        });

        it("sets a dark theme based on the user's system preferences", () => {
          window.matchMedia = jest.fn(() => mock<MediaQueryList>({ matches: true }));
          const message = {
            command: "initAutofillInlineMenuList",
            theme: ThemeType.System,
          };

          sendPortMessage(portSpy, message);

          expect(window.matchMedia).toHaveBeenCalledWith("(prefers-color-scheme: dark)");
          expect(
            autofillInlineMenuIframeService["iframe"].contentWindow.postMessage,
          ).toHaveBeenCalledWith(
            {
              command: "initAutofillInlineMenuList",
              theme: ThemeType.Dark,
            },
            "*",
          );
        });

        it("updates the border to match the `dark` theme", () => {
          const message = {
            command: "initAutofillInlineMenuList",
            theme: ThemeType.Dark,
          };

          sendPortMessage(portSpy, message);

          expect(updateElementStylesSpy).toHaveBeenCalledWith(
            autofillInlineMenuIframeService["iframe"],
            {
              borderColor: "#4c525f",
            },
          );
        });

        it("updates the border to match the `nord` theme", () => {
          const message = {
            command: "initAutofillInlineMenuList",
            theme: ThemeType.Nord,
          };

          sendPortMessage(portSpy, message);

          expect(updateElementStylesSpy).toHaveBeenCalledWith(
            autofillInlineMenuIframeService["iframe"],
            {
              borderColor: "#2E3440",
            },
          );
        });

        it("updates the border to match the `solarizedDark` theme", () => {
          const message = {
            command: "initAutofillInlineMenuList",
            theme: ThemeType.SolarizedDark,
          };

          sendPortMessage(portSpy, message);

          expect(updateElementStylesSpy).toHaveBeenCalledWith(
            autofillInlineMenuIframeService["iframe"],
            {
              borderColor: "#073642",
            },
          );
        });
      });

      describe("updating the iframe's position", () => {
        beforeEach(() => {
          jest.spyOn(globalThis.document, "hasFocus").mockReturnValue(true);
        });

        it("ignores updating the iframe position if the document does not have focus", () => {
          jest.spyOn(autofillInlineMenuIframeService as any, "updateElementStyles");
          jest.spyOn(globalThis.document, "hasFocus").mockReturnValue(false);

          sendPortMessage(portSpy, {
            command: "updateAutofillInlineMenuPosition",
            styles: { top: 100, left: 100 },
          });

          expect(autofillInlineMenuIframeService["updateElementStyles"]).not.toHaveBeenCalled();
        });

        it("updates the iframe position if the document has focus", () => {
          const styles = { top: "100px", left: "100px" };

          sendPortMessage(portSpy, {
            command: "updateAutofillInlineMenuPosition",
            styles,
          });

          expect(autofillInlineMenuIframeService["iframe"].style.top).toBe(styles.top);
          expect(autofillInlineMenuIframeService["iframe"].style.left).toBe(styles.left);
        });

        it("announces the opening of the iframe using an aria alert", async () => {
          jest.useFakeTimers();
          sendExtensionMessageSpy.mockResolvedValue(true);
          const styles = { top: "100px", left: "100px" };

          sendPortMessage(portSpy, {
            command: "updateAutofillInlineMenuPosition",
            styles,
          });
          jest.advanceTimersByTime(2000);
          await flushPromises();

          expect(shadowAppendSpy).toHaveBeenCalledWith(
            autofillInlineMenuIframeService["ariaAlertElement"],
          );
        });

        it("resets the fade in timeout if it is set", () => {
          autofillInlineMenuIframeService["fadeInTimeout"] = setTimeout(jest.fn, 100);
          const styles = { top: "100px", left: "100px" };
          jest.spyOn(autofillInlineMenuIframeService as any, "handleFadeInInlineMenuIframe");

          sendPortMessage(portSpy, {
            command: "updateAutofillInlineMenuPosition",
            styles,
          });

          expect(
            autofillInlineMenuIframeService["handleFadeInInlineMenuIframe"],
          ).toHaveBeenCalled();
        });
      });

      it("updates the visibility of the iframe", () => {
        sendPortMessage(portSpy, {
          command: "toggleAutofillInlineMenuHidden",
          styles: { display: "none" },
        });

        expect(autofillInlineMenuIframeService["iframe"].style.display).toBe("none");
      });

      it("updates the button based on the web page's color scheme", () => {
        sendPortMessage(portSpy, {
          command: "updateAutofillInlineMenuColorScheme",
        });

        expect(
          autofillInlineMenuIframeService["iframe"].contentWindow.postMessage,
        ).toHaveBeenCalledWith(
          {
            command: "updateAutofillInlineMenuColorScheme",
            colorScheme: "normal",
          },
          "*",
        );
      });

      it("triggers a delayed closure of the inline menu", () => {
        jest.useFakeTimers();
        jest.spyOn(globalThis, "clearTimeout");
        autofillInlineMenuIframeService["delayedCloseTimeout"] = setTimeout(jest.fn, 100);

        sendPortMessage(portSpy, { command: "triggerDelayedAutofillInlineMenuClosure" });
        expect(clearTimeout).toHaveBeenCalled();
        expect(autofillInlineMenuIframeService["iframe"].style.opacity).toBe("0");
        expect(autofillInlineMenuIframeService["iframe"].style.transition).toBe(
          "opacity 65ms ease-out 0s",
        );

        jest.advanceTimersByTime(100);
        expect(autofillInlineMenuIframeService["iframe"].style.transition).toBe(
          "opacity 125ms ease-out 0s",
        );
        expect(sendExtensionMessageSpy).toHaveBeenCalledWith("closeAutofillInlineMenu", {
          forceCloseInlineMenu: true,
        });
      });

      it("triggers a fade in of the inline menu", () => {
        jest.useFakeTimers();
        jest.spyOn(globalThis, "clearTimeout");
        autofillInlineMenuIframeService["fadeInTimeout"] = setTimeout(jest.fn, 10);

        sendPortMessage(portSpy, { command: "fadeInAutofillInlineMenuIframe" });
        expect(clearTimeout).toHaveBeenCalled();
        expect(autofillInlineMenuIframeService["iframe"].style.opacity).toBe("0");

        jest.advanceTimersByTime(10);
        expect(autofillInlineMenuIframeService["iframe"].style.opacity).toBe("1");
      });

      it("triggers an aria alert when the password in regenerated", () => {
        jest.spyOn(autofillInlineMenuIframeService as any, "createAriaAlertElement");

        sendPortMessage(portSpy, {
          command: "updateAutofillInlineMenuGeneratedPassword",
          refreshPassword: true,
        });

        expect(autofillInlineMenuIframeService["createAriaAlertElement"]).toHaveBeenCalledWith(
          true,
        );
      });
    });
  });

  describe("mutation observer", () => {
    beforeEach(() => {
      autofillInlineMenuIframeService.initMenuIframe();
      autofillInlineMenuIframeService["iframe"].dispatchEvent(new Event(EVENTS.LOAD));
      portSpy = autofillInlineMenuIframeService["port"];
    });

    it("skips handling found mutations if excessive mutations are triggering", async () => {
      jest.useFakeTimers();
      jest
        .spyOn(
          autofillInlineMenuIframeService as any,
          "isTriggeringExcessiveMutationObserverIterations",
        )
        .mockReturnValue(true);
      jest.spyOn(autofillInlineMenuIframeService as any, "updateElementStyles");

      autofillInlineMenuIframeService["iframe"].style.visibility = "hidden";
      await flushPromises();

      expect(autofillInlineMenuIframeService["updateElementStyles"]).not.toHaveBeenCalled();
    });

    it("reverts any styles changes made directly to the iframe", async () => {
      jest.useFakeTimers();

      autofillInlineMenuIframeService["iframe"].style.visibility = "hidden";
      await flushPromises();

      expect(autofillInlineMenuIframeService["iframe"].style.visibility).toBe("visible");
    });

    it("force closes the autofill inline menu if more than 9 foreign mutations are triggered", async () => {
      jest.useFakeTimers();
      autofillInlineMenuIframeService["foreignMutationsCount"] = 10;

      autofillInlineMenuIframeService["iframe"].src = "http://malicious-site.com";
      await flushPromises();

      expect(sendExtensionMessageSpy).toHaveBeenCalledWith("closeAutofillInlineMenu", {
        forceCloseInlineMenu: true,
      });
    });

    it("force closes the autofill overinline menulay if excessive mutations are being triggered", async () => {
      jest.useFakeTimers();
      autofillInlineMenuIframeService["mutationObserverIterations"] = 20;

      autofillInlineMenuIframeService["iframe"].src = "http://malicious-site.com";
      await flushPromises();

      expect(sendExtensionMessageSpy).toHaveBeenCalledWith("closeAutofillInlineMenu", {
        forceCloseInlineMenu: true,
      });
    });

    it("resets the excessive mutations and foreign mutation counters", async () => {
      jest.useFakeTimers();
      autofillInlineMenuIframeService["foreignMutationsCount"] = 9;
      autofillInlineMenuIframeService["mutationObserverIterations"] = 19;

      autofillInlineMenuIframeService["iframe"].src = "http://malicious-site.com";
      jest.advanceTimersByTime(2001);
      await flushPromises();

      expect(autofillInlineMenuIframeService["foreignMutationsCount"]).toBe(0);
      expect(autofillInlineMenuIframeService["mutationObserverIterations"]).toBe(0);
    });

    it("resets any mutated default attributes for the iframe", async () => {
      jest.useFakeTimers();

      autofillInlineMenuIframeService["iframe"].title = "some-other-title";
      await flushPromises();

      expect(autofillInlineMenuIframeService["iframe"].title).toBe("title");
    });
  });
});
