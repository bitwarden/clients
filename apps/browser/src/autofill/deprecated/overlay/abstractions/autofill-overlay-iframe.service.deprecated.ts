type AutofillOverlayIframeExtensionMessage = {
  command: string;
  styles?: Partial<CSSStyleDeclaration>;
  theme?: string;
};

type AutofillOverlayIframeWindowMessageHandlers = {
  [key: string]: CallableFunction;
  updateAutofillOverlayListHeight: (message: AutofillOverlayIframeExtensionMessage) => void;
  getPageColorScheme: () => void;
};

type AutofillOverlayIframeExtensionMessageParam = {
  message: AutofillOverlayIframeExtensionMessage;
};

type BackgroundPortMessageHandlers = {
  [key: string]: CallableFunction;
  initAutofillOverlayList: ({ message }: AutofillOverlayIframeExtensionMessageParam) => void;
  updateIframePosition: ({ message }: AutofillOverlayIframeExtensionMessageParam) => void;
  updateOverlayHidden: ({ message }: AutofillOverlayIframeExtensionMessageParam) => void;
};

interface AutofillOverlayIframeService {
  initOverlayIframe(initStyles: Partial<CSSStyleDeclaration>, ariaAlert?: string): void;
}

export {
  AutofillOverlayIframeExtensionMessage,
  AutofillOverlayIframeWindowMessageHandlers,
  BackgroundPortMessageHandlers,
  AutofillOverlayIframeService,
};
