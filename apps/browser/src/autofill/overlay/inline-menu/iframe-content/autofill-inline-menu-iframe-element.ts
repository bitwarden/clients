import { AutofillInlineMenuIframeService } from "./autofill-inline-menu-iframe.service";

export class AutofillInlineMenuIframeElement {
  constructor(
    element: HTMLElement,
    portName: string,
    initStyles: Partial<CSSStyleDeclaration>,
    iframeTitle: string,
    ariaAlert?: string,
  ) {
    const shadow: ShadowRoot = element.attachShadow({ mode: "closed" });
    const autofillInlineMenuIframeService = new AutofillInlineMenuIframeService(
      shadow,
      portName,
      initStyles,
      iframeTitle,
      ariaAlert,
    );
    autofillInlineMenuIframeService.initMenuIframe();
  }
}
