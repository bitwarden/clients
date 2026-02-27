import { AutofillExtensionMessageParam } from "../../../content/abstractions/autofill-init";

export type InlineMenuExtensionMessageHandlers = {
  [key: string]: CallableFunction;
  closeAutofillInlineMenu: ({ message }: AutofillExtensionMessageParam) => void;
  appendAutofillInlineMenuToDom: ({ message }: AutofillExtensionMessageParam) => Promise<void>;
};

export interface AutofillInlineMenuContentService {
  messageHandlers: InlineMenuExtensionMessageHandlers;
  isElementInlineMenu(element: HTMLElement): boolean;
  getOwnedTagNames: () => string[];
  getUnownedTopLayerItems: (includeCandidates?: boolean) => NodeListOf<Element>;
  refreshTopLayerPosition: () => void;
  destroy(): void;
}
