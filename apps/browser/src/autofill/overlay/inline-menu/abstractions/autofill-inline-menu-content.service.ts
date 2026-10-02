import { AutofillExtensionMessageParam } from "../../../content/abstractions/autofill-init";
import { AutofillMonitor } from "../../../content/abstractions/autofill-monitor";

export type InlineMenuExtensionMessageHandlers = {
  [key: string]: CallableFunction;
  closeAutofillInlineMenu: ({ message }: AutofillExtensionMessageParam) => void;
  appendAutofillInlineMenuToDom: ({ message }: AutofillExtensionMessageParam) => Promise<void>;
};

export interface AutofillInlineMenuContentService extends AutofillMonitor {
  messageHandlers: InlineMenuExtensionMessageHandlers;
  isElementInlineMenu(element: HTMLElement): boolean;
  getUnownedTopLayerItems: (includeCandidates?: boolean) => Element[];
  refreshTopLayerPosition: () => void;
  destroy(): void;
}
