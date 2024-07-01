import AutofillOverlayListIframe from "./autofill-overlay-list-iframe.deprecated";

describe("AutofillOverlayListIframe", () => {
  window.customElements.define(
    "autofill-overlay-list-iframe",
    class extends HTMLElement {
      constructor() {
        super();
        new AutofillOverlayListIframe(this);
      }
    },
  );

  afterAll(() => {
    jest.clearAllMocks();
  });

  it("creates a custom element that is an instance of the AutofillIframeElement parent class", () => {
    document.body.innerHTML = "<autofill-overlay-list-iframe></autofill-overlay-list-iframe>";

    const iframe = document.querySelector("autofill-overlay-list-iframe");

    expect(iframe).toBeInstanceOf(HTMLElement);
    expect(iframe.shadowRoot).toBeDefined();
  });
});
