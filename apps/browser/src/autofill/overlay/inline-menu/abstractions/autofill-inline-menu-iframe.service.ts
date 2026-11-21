export type AutofillInlineMenuIframeExtensionMessage = {
  command: string;
  styles?: Partial<CSSStyleDeclaration>;
  theme?: string;
  portKey?: string;
  generatedPassword?: string;
  refreshPassword?: boolean;
  showAnimations?: boolean;
  /** The iframe hosts the Angular list page, which draws its own panel. */
  useAngularUi?: boolean;
};

export type AutofillInlineMenuIframeExtensionMessageParam = {
  message: AutofillInlineMenuIframeExtensionMessage;
};

export type BackgroundPortMessageHandlers = {
  [key: string]: CallableFunction;
  initAutofillInlineMenuButton: ({
    message,
  }: AutofillInlineMenuIframeExtensionMessageParam) => void;
  initAutofillInlineMenuList: ({ message }: AutofillInlineMenuIframeExtensionMessageParam) => void;
  updateAutofillInlineMenuPosition: ({
    message,
  }: AutofillInlineMenuIframeExtensionMessageParam) => void;
  toggleAutofillInlineMenuHidden: ({
    message,
  }: AutofillInlineMenuIframeExtensionMessageParam) => void;
  updateAutofillInlineMenuColorScheme: () => void;
  fadeInAutofillInlineMenuIframe: () => void;
  updateAutofillInlineMenuGeneratedPassword: ({
    message,
  }: AutofillInlineMenuIframeExtensionMessageParam) => void;
};

export interface AutofillInlineMenuIframeService {
  initMenuIframe(): void;
  destroy(): void;
}
