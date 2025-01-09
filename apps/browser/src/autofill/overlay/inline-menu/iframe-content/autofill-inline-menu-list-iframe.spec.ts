import { AutofillInlineMenuListIframe } from "./autofill-inline-menu-list-iframe";

describe("AutofillInlineMenuListIframe", () => {
  window.customElements.define(
    "autofill-inline-menu-list-iframe",
    class extends HTMLElement {
      constructor() {
        super();
        new AutofillInlineMenuListIframe(this);
      }
    },
  );

  afterAll(() => {
    jest.clearAllMocks();
  });

  it("creates a custom element that is an instance of the AutofillIframeElement parent class", () => {
    document.body.innerHTML =
      "<autofill-inline-menu-list-iframe></autofill-inline-menu-list-iframe>";

    const iframe = document.querySelector("autofill-inline-menu-list-iframe");

    expect(iframe).toBeInstanceOf(HTMLElement);
    expect(iframe.shadowRoot).toBeDefined();
  });
});
