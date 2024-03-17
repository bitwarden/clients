import { ClearClipboardDelay, AutofillOverlayVisibility } from "../constants";

export type ClearClipboardDelaySetting =
  (typeof ClearClipboardDelay)[keyof typeof ClearClipboardDelay];

export type InlineMenuVisibilitySetting =
  (typeof AutofillOverlayVisibility)[keyof typeof AutofillOverlayVisibility];
