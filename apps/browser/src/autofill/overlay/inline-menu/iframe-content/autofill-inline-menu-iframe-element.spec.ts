import { AutofillOverlayPort } from "../../../enums/autofill-overlay.enum";

import { AutofillInlineMenuIframeElement } from "./autofill-inline-menu-iframe-element";
import { AutofillInlineMenuIframeService } from "./autofill-inline-menu-iframe.service";

jest.mock("./autofill-inline-menu-iframe.service");

describe("AutofillInlineMenuIframeElement", () => {
  window.customElements.define(
    "autofill-inline-menu-iframe",
    class extends HTMLElement {
      constructor() {
        super();
        new AutofillInlineMenuIframeElement(
          this,
          AutofillOverlayPort.Button,
          { background: "transparent", border: "none" },
          "bitwardenInlineMenuButton",
        );
      }
    },
  );

  afterAll(() => {
    jest.clearAllMocks();
  });

  it("creates a custom element that is an instance of the HTMLElement parent class", () => {
    document.body.innerHTML = "<autofill-inline-menu-iframe></autofill-inline-menu-iframe>";

    const iframe = document.querySelector("autofill-inline-menu-iframe");

    expect(iframe).toBeInstanceOf(HTMLElement);
  });

  it("attaches a closed shadow DOM", () => {
    document.body.innerHTML = "<autofill-inline-menu-iframe></autofill-inline-menu-iframe>";

    const iframe = document.querySelector("autofill-inline-menu-iframe");

    expect(iframe.shadowRoot).toBeNull();
  });

  it("instantiates the autofill inline menu iframe service for each attached custom element", () => {
    expect(AutofillInlineMenuIframeService).toHaveBeenCalledTimes(2);
  });
});
