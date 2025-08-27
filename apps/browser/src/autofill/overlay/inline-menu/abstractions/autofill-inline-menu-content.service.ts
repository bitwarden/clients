import { AutofillExtensionMessageParam } from "../../../content/abstractions/autofill-init";

export type InlineMenuExtensionMessageHandlers = {
  [key: string]: CallableFunction;
  closeAutofillInlineMenu: ({ message }: AutofillExtensionMessageParam) => void;
  appendAutofillInlineMenuToDom: ({ message }: AutofillExtensionMessageParam) => Promise<void>;
};

export interface AutofillInlineMenuContentService {
  messageHandlers: InlineMenuExtensionMessageHandlers;
  isElementInlineMenu(element: HTMLElement): boolean;
  refreshTopLayerPosition: () => void;
  getOwnedTagNames: () => string[];
  destroy(): void;
}
