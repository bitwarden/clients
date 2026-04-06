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

  afterAll(() => {
    jest.clearAllMocks();
  });

  it("creates a custom element that is an instance of the AutofillIframeElement parent class", () => {
    document.body.innerHTML =
      "<autofill-inline-menu-button-iframe></autofill-inline-menu-button-iframe>";

    const iframe = document.querySelector("autofill-inline-menu-button-iframe");

    expect(iframe).toBeInstanceOf(HTMLElement);
    expect(iframe.shadowRoot).toBeDefined();
  });
});
