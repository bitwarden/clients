import AutofillOverlayButtonIframe from "./autofill-overlay-button-iframe.deprecated";

describe("AutofillOverlayButtonIframe", () => {
  window.customElements.define(
    "autofill-overlay-button-iframe",
    class extends HTMLElement {
      constructor() {
        super();
        new AutofillOverlayButtonIframe(this);
      }
    },
  );

  afterAll(() => {
    jest.clearAllMocks();
  });

  it("creates a custom element that is an instance of the AutofillIframeElement parent class", () => {
    document.body.innerHTML = "<autofill-overlay-button-iframe></autofill-overlay-button-iframe>";

    const iframe = document.querySelector("autofill-overlay-button-iframe");

    expect(iframe).toBeInstanceOf(HTMLElement);
    expect(iframe.shadowRoot).toBeDefined();
  });
});
