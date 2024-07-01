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

import AutofillOverlayIframeService from "./autofill-overlay-iframe.service.deprecated";

describe("AutofillOverlayIframeService", () => {
  const iframePath = "overlay/legacy-list.html";
  let autofillOverlayIframeService: AutofillOverlayIframeService;
  let portSpy: chrome.runtime.Port;
  let shadowAppendSpy: jest.SpyInstance;
  let handlePortDisconnectSpy: jest.SpyInstance;
  let handlePortMessageSpy: jest.SpyInstance;
  let handleWindowMessageSpy: jest.SpyInstance;

  beforeEach(() => {
    const shadow = document.createElement("div").attachShadow({ mode: "open" });
    autofillOverlayIframeService = new AutofillOverlayIframeService(
      iframePath,
      AutofillOverlayPort.Button,
      shadow,
    );
    shadowAppendSpy = jest.spyOn(shadow, "appendChild");
    handlePortDisconnectSpy = jest.spyOn(
      autofillOverlayIframeService as any,
      "handlePortDisconnect",
    );
    handlePortMessageSpy = jest.spyOn(autofillOverlayIframeService as any, "handlePortMessage");
    handleWindowMessageSpy = jest.spyOn(autofillOverlayIframeService as any, "handleWindowMessage");
    chrome.runtime.connect = jest.fn((connectInfo: chrome.runtime.ConnectInfo) =>
      createPortSpyMock(connectInfo.name),
    ) as unknown as typeof chrome.runtime.connect;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("initOverlayIframe", () => {
    it("sets up the iframe's attributes", () => {
      autofillOverlayIframeService.initOverlayIframe({ height: "0px" }, "title");

      expect(autofillOverlayIframeService["iframe"]).toMatchSnapshot();
    });

    it("appends the iframe to the shadowDom", () => {
      jest.spyOn(autofillOverlayIframeService["shadow"], "appendChild");

      autofillOverlayIframeService.initOverlayIframe({}, "title");

      expect(autofillOverlayIframeService["shadow"].appendChild).toBeCalledWith(
        autofillOverlayIframeService["iframe"],
      );
    });

    it("creates an aria alert element if the ariaAlert param is passed", () => {
      const ariaAlert = "aria alert";
      jest.spyOn(autofillOverlayIframeService as any, "createAriaAlertElement");

      autofillOverlayIframeService.initOverlayIframe({}, "title", ariaAlert);

      expect(autofillOverlayIframeService["createAriaAlertElement"]).toBeCalledWith(ariaAlert);
      expect(autofillOverlayIframeService["ariaAlertElement"]).toMatchSnapshot();
    });

    describe("on load of the iframe source", () => {
      beforeEach(() => {
        autofillOverlayIframeService.initOverlayIframe({ height: "0px" }, "title", "ariaAlert");
      });

      it("sets up and connects the port message listener to the extension background", () => {
        jest.spyOn(globalThis, "addEventListener");

        autofillOverlayIframeService["iframe"].dispatchEvent(new Event(EVENTS.LOAD));
        portSpy = autofillOverlayIframeService["port"];

        expect(chrome.runtime.connect).toBeCalledWith({ name: AutofillOverlayPort.Button });
        expect(portSpy.onDisconnect.addListener).toBeCalledWith(handlePortDisconnectSpy);
        expect(portSpy.onMessage.addListener).toBeCalledWith(handlePortMessageSpy);
        expect(globalThis.addEventListener).toBeCalledWith(EVENTS.MESSAGE, handleWindowMessageSpy);
      });

      it("skips announcing the aria alert if the aria alert element is not populated", () => {
        jest.spyOn(globalThis, "setTimeout");
        autofillOverlayIframeService["ariaAlertElement"] = undefined;

        autofillOverlayIframeService["iframe"].dispatchEvent(new Event(EVENTS.LOAD));

        expect(globalThis.setTimeout).not.toBeCalled();
      });

      it("announces the aria alert if the aria alert element is populated", () => {
        jest.useFakeTimers();
        jest.spyOn(globalThis, "setTimeout");
        autofillOverlayIframeService["ariaAlertElement"] = document.createElement("div");
        autofillOverlayIframeService["ariaAlertTimeout"] = setTimeout(jest.fn(), 2000);

        autofillOverlayIframeService["iframe"].dispatchEvent(new Event(EVENTS.LOAD));

        expect(globalThis.setTimeout).toBeCalled();
        jest.advanceTimersByTime(2000);

        expect(shadowAppendSpy).toBeCalledWith(autofillOverlayIframeService["ariaAlertElement"]);
      });
    });
  });

  describe("event listeners", () => {
    beforeEach(() => {
      autofillOverlayIframeService.initOverlayIframe({ height: "0px" }, "title", "ariaAlert");
      autofillOverlayIframeService["iframe"].dispatchEvent(new Event(EVENTS.LOAD));
      Object.defineProperty(autofillOverlayIframeService["iframe"], "contentWindow", {
        value: {
          postMessage: jest.fn(),
        },
        writable: true,
      });
      jest.spyOn(autofillOverlayIframeService["iframe"].contentWindow, "postMessage");
      portSpy = autofillOverlayIframeService["port"];
    });

    describe("handlePortDisconnect", () => {
      it("ignores ports that do not have the correct port name", () => {
        portSpy.name = "wrong-port-name";
        triggerPortOnDisconnectEvent(portSpy);

        expect(autofillOverlayIframeService["port"]).not.toBeNull();
      });

      it("resets the iframe element's opacity, height, and display styles", () => {
        triggerPortOnDisconnectEvent(portSpy);

        expect(autofillOverlayIframeService["iframe"].style.opacity).toBe("0");
        expect(autofillOverlayIframeService["iframe"].style.height).toBe("0px");
        expect(autofillOverlayIframeService["iframe"].style.display).toBe("block");
      });

      it("removes the global message listener", () => {
        jest.spyOn(globalThis, "removeEventListener");

        triggerPortOnDisconnectEvent(portSpy);

        expect(globalThis.removeEventListener).toBeCalledWith(
          EVENTS.MESSAGE,
          handleWindowMessageSpy,
        );
      });

      it("removes the port's onMessage listener", () => {
        triggerPortOnDisconnectEvent(portSpy);

        expect(portSpy.onMessage.removeListener).toBeCalledWith(handlePortMessageSpy);
      });

      it("removes the port's onDisconnect listener", () => {
        triggerPortOnDisconnectEvent(portSpy);

        expect(portSpy.onDisconnect.removeListener).toBeCalledWith(handlePortDisconnectSpy);
      });

      it("disconnects the port", () => {
        triggerPortOnDisconnectEvent(portSpy);

        expect(portSpy.disconnect).toBeCalled();
        expect(autofillOverlayIframeService["port"]).toBeNull();
      });
    });

    describe("handlePortMessage", () => {
      it("ignores port messages that do not correlate to the correct port name", () => {
        portSpy.name = "wrong-port-name";
        sendPortMessage(portSpy, {});

        expect(autofillOverlayIframeService["iframe"].contentWindow.postMessage).not.toBeCalled();
      });

      it("passes on the message to the iframe if the message is not registered with the message handlers", () => {
        const message = { command: "unregisteredMessage" };

        sendPortMessage(portSpy, message);

        expect(autofillOverlayIframeService["iframe"].contentWindow.postMessage).toBeCalledWith(
          message,
          "*",
        );
      });

      it("handles port messages that are registered with the message handlers and does not pass the message on to the iframe", () => {
        jest.spyOn(autofillOverlayIframeService as any, "updateIframePosition");

        sendPortMessage(portSpy, { command: "updateIframePosition" });

        expect(autofillOverlayIframeService["iframe"].contentWindow.postMessage).not.toBeCalled();
      });

      describe("initializing the overlay list", () => {
        let updateElementStylesSpy: jest.SpyInstance;

        beforeEach(() => {
          updateElementStylesSpy = jest.spyOn(
            autofillOverlayIframeService as any,
            "updateElementStyles",
          );
        });

        it("passes the message on to the iframe element", () => {
          const message = {
            command: "initAutofillOverlayList",
            theme: ThemeType.Light,
          };

          sendPortMessage(portSpy, message);

          expect(updateElementStylesSpy).not.toBeCalled();
          expect(autofillOverlayIframeService["iframe"].contentWindow.postMessage).toBeCalledWith(
            message,
            "*",
          );
        });

        it("sets a light theme based on the user's system preferences", () => {
          window.matchMedia = jest.fn(() => mock<MediaQueryList>({ matches: false }));
          const message = {
            command: "initAutofillOverlayList",
            theme: ThemeType.System,
          };

          sendPortMessage(portSpy, message);

          expect(window.matchMedia).toHaveBeenCalledWith("(prefers-color-scheme: dark)");
          expect(autofillOverlayIframeService["iframe"].contentWindow.postMessage).toBeCalledWith(
            {
              command: "initAutofillOverlayList",
              theme: ThemeType.Light,
            },
            "*",
          );
        });

        it("sets a dark theme based on the user's system preferences", () => {
          window.matchMedia = jest.fn(() => mock<MediaQueryList>({ matches: true }));
          const message = {
            command: "initAutofillOverlayList",
            theme: ThemeType.System,
          };

          sendPortMessage(portSpy, message);

          expect(window.matchMedia).toHaveBeenCalledWith("(prefers-color-scheme: dark)");
          expect(autofillOverlayIframeService["iframe"].contentWindow.postMessage).toBeCalledWith(
            {
              command: "initAutofillOverlayList",
              theme: ThemeType.Dark,
            },
            "*",
          );
        });

        it("updates the border to match the `dark` theme", () => {
          const message = {
            command: "initAutofillOverlayList",
            theme: ThemeType.Dark,
          };

          sendPortMessage(portSpy, message);

          expect(updateElementStylesSpy).toBeCalledWith(autofillOverlayIframeService["iframe"], {
            borderColor: "#4c525f",
          });
        });

        it("updates the border to match the `nord` theme", () => {
          const message = {
            command: "initAutofillOverlayList",
            theme: ThemeType.Nord,
          };

          sendPortMessage(portSpy, message);

          expect(updateElementStylesSpy).toBeCalledWith(autofillOverlayIframeService["iframe"], {
            borderColor: "#2E3440",
          });
        });

        it("updates the border to match the `solarizedDark` theme", () => {
          const message = {
            command: "initAutofillOverlayList",
            theme: ThemeType.SolarizedDark,
          };

          sendPortMessage(portSpy, message);

          expect(updateElementStylesSpy).toBeCalledWith(autofillOverlayIframeService["iframe"], {
            borderColor: "#073642",
          });
        });
      });

      describe("updating the iframe's position", () => {
        beforeEach(() => {
          jest.spyOn(globalThis.document, "hasFocus").mockReturnValue(true);
        });

        it("ignores updating the iframe position if the document does not have focus", () => {
          jest.spyOn(autofillOverlayIframeService as any, "updateElementStyles");
          jest.spyOn(globalThis.document, "hasFocus").mockReturnValue(false);

          sendPortMessage(portSpy, {
            command: "updateIframePosition",
            styles: { top: 100, left: 100 },
          });

          expect(autofillOverlayIframeService["updateElementStyles"]).not.toBeCalled();
        });

        it("updates the iframe position if the document has focus", () => {
          const styles = { top: "100px", left: "100px" };

          sendPortMessage(portSpy, {
            command: "updateIframePosition",
            styles,
          });

          expect(autofillOverlayIframeService["iframe"].style.top).toBe(styles.top);
          expect(autofillOverlayIframeService["iframe"].style.left).toBe(styles.left);
        });

        it("fades the iframe element in after positioning the element", () => {
          jest.useFakeTimers();
          const styles = { top: "100px", left: "100px" };

          sendPortMessage(portSpy, {
            command: "updateIframePosition",
            styles,
          });

          expect(autofillOverlayIframeService["iframe"].style.opacity).toBe("0");
          jest.advanceTimersByTime(10);
          expect(autofillOverlayIframeService["iframe"].style.opacity).toBe("1");
        });

        it("announces the opening of the iframe using an aria alert", () => {
          jest.useFakeTimers();
          const styles = { top: "100px", left: "100px" };

          sendPortMessage(portSpy, {
            command: "updateIframePosition",
            styles,
          });

          jest.advanceTimersByTime(2000);
          expect(shadowAppendSpy).toBeCalledWith(autofillOverlayIframeService["ariaAlertElement"]);
        });
      });

      it("updates the visibility of the iframe", () => {
        sendPortMessage(portSpy, {
          command: "updateOverlayHidden",
          styles: { display: "none" },
        });

        expect(autofillOverlayIframeService["iframe"].style.display).toBe("none");
      });
    });

    describe("handleWindowMessage", () => {
      it("ignores window messages when the port is not set", () => {
        autofillOverlayIframeService["port"] = null;

        globalThis.dispatchEvent(new MessageEvent("message", { data: {} }));

        expect(autofillOverlayIframeService["port"]).toBeNull();
      });

      it("ignores window messages whose source is not the iframe's content window", () => {
        globalThis.dispatchEvent(
          new MessageEvent("message", {
            data: {},
            source: window,
          }),
        );

        expect(portSpy.postMessage).not.toBeCalled();
      });

      it("ignores window messages whose origin is not from the extension origin", () => {
        globalThis.dispatchEvent(
          new MessageEvent("message", {
            data: {},
            source: autofillOverlayIframeService["iframe"].contentWindow,
            origin: "https://www.google.com",
          }),
        );

        expect(portSpy.postMessage).not.toBeCalled();
      });

      it("passes the window message from an iframe element to the background port", () => {
        globalThis.dispatchEvent(
          new MessageEvent("message", {
            data: { command: "not-a-handled-command" },
            source: autofillOverlayIframeService["iframe"].contentWindow,
            origin: "chrome-extension://id",
          }),
        );

        expect(portSpy.postMessage).toBeCalledWith({ command: "not-a-handled-command" });
      });

      it("updates the overlay list height", () => {
        globalThis.dispatchEvent(
          new MessageEvent("message", {
            data: { command: "updateAutofillOverlayListHeight", styles: { height: "300px" } },
            source: autofillOverlayIframeService["iframe"].contentWindow,
            origin: "chrome-extension://id",
          }),
        );

        expect(autofillOverlayIframeService["iframe"].style.height).toBe("300px");
      });

      describe("getPageColorScheme window message", () => {
        afterEach(() => {
          globalThis.document.head.innerHTML = "";
        });

        it("gets and updates the overlay page color scheme", () => {
          const colorSchemeMetaTag = globalThis.document.createElement("meta");
          colorSchemeMetaTag.setAttribute("name", "color-scheme");
          colorSchemeMetaTag.setAttribute("content", "dark");
          globalThis.document.head.append(colorSchemeMetaTag);
          globalThis.dispatchEvent(
            new MessageEvent("message", {
              data: { command: "getPageColorScheme" },
              source: autofillOverlayIframeService["iframe"].contentWindow,
              origin: "chrome-extension://id",
            }),
          );

          expect(autofillOverlayIframeService["iframe"].contentWindow.postMessage).toBeCalledWith(
            { command: "updateOverlayPageColorScheme", colorScheme: "dark" },
            "*",
          );
        });

        it("sends a normal color scheme if the color scheme meta tag is not present", () => {
          globalThis.dispatchEvent(
            new MessageEvent("message", {
              data: { command: "getPageColorScheme" },
              source: autofillOverlayIframeService["iframe"].contentWindow,
              origin: "chrome-extension://id",
            }),
          );

          expect(autofillOverlayIframeService["iframe"].contentWindow.postMessage).toBeCalledWith(
            { command: "updateOverlayPageColorScheme", colorScheme: "normal" },
            "*",
          );
        });
      });
    });
  });

  describe("mutation observer", () => {
    beforeEach(() => {
      autofillOverlayIframeService.initOverlayIframe({ height: "0px" }, "title", "ariaAlert");
      autofillOverlayIframeService["iframe"].dispatchEvent(new Event(EVENTS.LOAD));
      portSpy = autofillOverlayIframeService["port"];
    });

    it("skips handling found mutations if excessive mutations are triggering", async () => {
      jest.useFakeTimers();
      jest
        .spyOn(
          autofillOverlayIframeService as any,
          "isTriggeringExcessiveMutationObserverIterations",
        )
        .mockReturnValue(true);
      jest.spyOn(autofillOverlayIframeService as any, "updateElementStyles");

      autofillOverlayIframeService["iframe"].style.visibility = "hidden";
      await flushPromises();

      expect(autofillOverlayIframeService["updateElementStyles"]).not.toBeCalled();
    });

    it("reverts any styles changes made directly to the iframe", async () => {
      jest.useFakeTimers();

      autofillOverlayIframeService["iframe"].style.visibility = "hidden";
      await flushPromises();

      expect(autofillOverlayIframeService["iframe"].style.visibility).toBe("visible");
    });

    it("force closes the autofill overlay if more than 9 foreign mutations are triggered", async () => {
      jest.useFakeTimers();
      autofillOverlayIframeService["foreignMutationsCount"] = 10;

      autofillOverlayIframeService["iframe"].src = "http://malicious-site.com";
      await flushPromises();

      expect(portSpy.postMessage).toBeCalledWith({ command: "forceCloseAutofillOverlay" });
    });

    it("force closes the autofill overlay if excessive mutations are being triggered", async () => {
      jest.useFakeTimers();
      autofillOverlayIframeService["mutationObserverIterations"] = 20;

      autofillOverlayIframeService["iframe"].src = "http://malicious-site.com";
      await flushPromises();

      expect(portSpy.postMessage).toBeCalledWith({ command: "forceCloseAutofillOverlay" });
    });

    it("resets the excessive mutations and foreign mutation counters", async () => {
      jest.useFakeTimers();
      autofillOverlayIframeService["foreignMutationsCount"] = 9;
      autofillOverlayIframeService["mutationObserverIterations"] = 19;

      autofillOverlayIframeService["iframe"].src = "http://malicious-site.com";
      jest.advanceTimersByTime(2001);
      await flushPromises();

      expect(autofillOverlayIframeService["foreignMutationsCount"]).toBe(0);
      expect(autofillOverlayIframeService["mutationObserverIterations"]).toBe(0);
    });

    it("resets any mutated default attributes for the iframe", async () => {
      jest.useFakeTimers();

      autofillOverlayIframeService["iframe"].title = "some-other-title";
      await flushPromises();

      expect(autofillOverlayIframeService["iframe"].title).toBe("title");
    });
  });
});
