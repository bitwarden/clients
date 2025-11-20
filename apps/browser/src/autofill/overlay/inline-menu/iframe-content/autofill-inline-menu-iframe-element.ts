import { AutofillInlineMenuIframeService } from "./autofill-inline-menu-iframe.service";

export class AutofillInlineMenuIframeElement {
  constructor(
    element: HTMLElement,
    portName: string,
    initStyles: Partial<CSSStyleDeclaration>,
    iframeTitle: string,
    ariaAlert?: string,
  ) {
    const style = this.createInternalStyleNode();
    const shadow: ShadowRoot = element.attachShadow({ mode: "closed" });
    shadow.prepend(style);

    const autofillInlineMenuIframeService = new AutofillInlineMenuIframeService(
      shadow,
      portName,
      initStyles,
      iframeTitle,
      ariaAlert,
    );
    autofillInlineMenuIframeService.initMenuIframe();
  }

  /**
   * Builds and prepends an internal stylesheet to the container node with rules
   * to prevent targeting by the host's global styling rules. This should only be
   * used for pseudo elements such as `::backdrop` or `::before`. All other
   * styles should be applied inline upon the parent container itself for improved
   * specificity priority.
   */
  private createInternalStyleNode() {
    const css = document.createTextNode(`
      :host::backdrop,
      :host::before,
      :host::after {
        all: initial !important;
        backdrop-filter: none !important;
        filter: none !important;
        inset: auto !important;
        touch-action: auto !important;
        user-select: text !important;
        display: none !important;
        position: relative !important;
        top: auto !important;
        right: auto !important;
        bottom: auto !important;
        left: auto !important;
        transform: none !important;
        transform-origin: 50% 50% !important;
        opacity: 1 !important;
        mix-blend-mode: normal !important;
        isolation: isolate !important;
        z-index: 0 !important;
        background: none !important;
        background-color: transparent !important;
        background-image: none !important;
        width: 0 !important;
        height: 0 !important;
        content: "" !important;
        pointer-events: all !important;
      }
    `);
    const style = globalThis.document.createElement("style");
    style.setAttribute("type", "text/css");
    style.appendChild(css);

    return style;
  }
}
