import AutofillOverlayIframeService from "./autofill-overlay-iframe.service.deprecated";

class AutofillOverlayIframeElement {
  constructor(
    element: HTMLElement,
    iframePath: string,
    portName: string,
    initStyles: Partial<CSSStyleDeclaration>,
    iframeTitle: string,
    ariaAlert?: string,
  ) {
    const shadow: ShadowRoot = element.attachShadow({ mode: "closed" });
    const autofillOverlayIframeService = new AutofillOverlayIframeService(
      iframePath,
      portName,
      shadow,
    );
    autofillOverlayIframeService.initOverlayIframe(initStyles, iframeTitle, ariaAlert);
  }
}

export default AutofillOverlayIframeElement;
