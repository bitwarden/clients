import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { CipherType } from "@bitwarden/common/vault/enums";

import { AutofillOverlayElementType } from "../../enums/autofill-overlay.enum";
import AutofillScript from "../../models/autofill-script";

import { AutofillMonitor } from "./autofill-monitor";

export type AutofillExtensionMessage = {
  command: string;
  tab?: chrome.tabs.Tab;
  sender?: string;
  fillScript?: AutofillScript;
  url?: string;
  subFrameUrl?: string;
  subFrameId?: string;
  pageDetailsUrl?: string;
  showAnimations?: boolean;
  ciphers?: any;
  isInlineMenuHidden?: boolean;
  overlayElement?: AutofillOverlayElementType;
  isFocusingFieldElement?: boolean;
  authStatus?: AuthenticationStatus;
  isOpeningFullInlineMenu?: boolean;
  addNewCipherType?: CipherType;
  ignoreFieldFocus?: boolean;
  iframeTargetedFields?: { selector: string; fieldType: string; formCategory?: string }[];
  data?: {
    direction?: "previous" | "next" | "current";
    forceCloseInlineMenu?: boolean;
  };
};

export type AutofillExtensionMessageParam = { message: AutofillExtensionMessage };

export type AutofillExtensionMessageHandlers = {
  [key: string]: CallableFunction;
  collectPageDetails: ({ message }: AutofillExtensionMessageParam) => void;
  collectPageDetailsImmediately: ({ message }: AutofillExtensionMessageParam) => void;
  collectAutofillTriage: () => void;
  fillForm: ({ message }: AutofillExtensionMessageParam) => void;
  applyTargetedFields: ({ message }: AutofillExtensionMessageParam) => void;
  clearTargetingRulesCache: () => void;
  startAutofillMonitors: () => void;
  stopAutofillMonitors: () => void;
};

export interface AutofillInit extends AutofillMonitor {
  init(): void;
  destroy(): void;
}
