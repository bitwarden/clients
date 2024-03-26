import { AutofillExtensionMessageParam } from "../../content/abstractions/autofill-init";

export type InlineMenuExtensionMessageHandlers = {
  [key: string]: CallableFunction;
  closeInlineMenu: ({ message }: AutofillExtensionMessageParam) => void;
  updateInlineMenuElementsPosition: ({ message }: AutofillExtensionMessageParam) => Promise<void>;
  toggleInlineMenuHidden: ({ message }: AutofillExtensionMessageParam) => void;
  checkIsInlineMenuButtonVisible: () => boolean;
  checkIsInlineMenuListVisible: () => boolean;
};

export interface InlineMenuElements {
  extensionMessageHandlers: InlineMenuExtensionMessageHandlers;
  destroy: () => void;
}
