import { AutofillInlineMenuButtonWindowMessageHandlers } from "./autofill-inline-menu-button";
import { AutofillInlineMenuListWindowMessageHandlers } from "./autofill-inline-menu-list";

export type AutofillInlineMenuPageElementWindowMessageHandlers =
  | AutofillInlineMenuButtonWindowMessageHandlers
  | AutofillInlineMenuListWindowMessageHandlers;

export type AutofillInlineMenuPageElementWindowMessage = {
  [key: string]: any;
  command: string;
  inlineMenuCipherId?: string;
  height?: number;
};
