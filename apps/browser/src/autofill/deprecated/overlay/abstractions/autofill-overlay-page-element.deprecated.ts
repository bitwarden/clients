import { OverlayButtonWindowMessageHandlers } from "./autofill-overlay-button.deprecated";
import { OverlayListWindowMessageHandlers } from "./autofill-overlay-list.deprecated";

type WindowMessageHandlers = OverlayButtonWindowMessageHandlers | OverlayListWindowMessageHandlers;

type AutofillOverlayPageElementWindowMessage = {
  [key: string]: any;
  command: string;
  overlayCipherId?: string;
  height?: number;
};

export { WindowMessageHandlers, AutofillOverlayPageElementWindowMessage };
