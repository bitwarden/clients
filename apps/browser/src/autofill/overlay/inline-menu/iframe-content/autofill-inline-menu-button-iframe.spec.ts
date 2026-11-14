import { AutofillOverlayPort } from "../../../enums/autofill-overlay.enum";
import { createPortSpyMock } from "../../../spec/autofill-mocks";
import { sendPortMessage } from "../../../spec/testing-utils";

import { AutofillInlineMenuButtonIframe } from "./autofill-inline-menu-button-iframe";

describe("AutofillInlineMenuButtonIframe", () => {
  window.customElements.define(
    "autofill-inline-menu-button-iframe",
    class extends HTMLElement {
      constructor() {
        super();
        new AutofillInlineMenuButtonIframe(this);
      }
    },
  );

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it("creates a custom element that is an instance of the AutofillIframeElement parent class", () => {
    document.body.innerHTML =
      "<autofill-inline-menu-button-iframe></autofill-inline-menu-button-iframe>";

    const iframe = document.querySelector("autofill-inline-menu-button-iframe");

    expect(iframe).toBeInstanceOf(HTMLElement);
    expect(iframe.shadowRoot).toBeDefined();
  });

  it("keeps an early fade-in from showing an unpositioned button", () => {
    const host = document.createElement("div");
    const attachShadow = jest.spyOn(host, "attachShadow");
    const port = createPortSpyMock(AutofillOverlayPort.Button);
    jest.mocked(chrome.runtime.connect).mockReturnValueOnce(port);
    const hasFocus = jest.spyOn(document, "hasFocus").mockReturnValue(false);

    new AutofillInlineMenuButtonIframe(host);
    const shadow: ShadowRoot = attachShadow.mock.results[0].value;
    const iframe = shadow.querySelector("iframe");
    iframe.dispatchEvent(new Event("load"));
    sendPortMessage(port, { command: "initAutofillInlineMenuButton", showAnimations: false });
    const position = {
      command: "updateAutofillInlineMenuPosition",
      styles: { left: "80px", top: "30px", width: "20px", height: "20px" },
    };
    sendPortMessage(port, position);
    sendPortMessage(port, { command: "fadeInAutofillInlineMenuIframe" });

    expect(iframe.style.opacity).toBe("1");
    expect(iframe.style.width).toBe("0px");
    expect(iframe.style.height).toBe("0px");

    hasFocus.mockReturnValue(true);
    sendPortMessage(port, position);
    expect(iframe.style).toMatchObject(position.styles);
  });
});
