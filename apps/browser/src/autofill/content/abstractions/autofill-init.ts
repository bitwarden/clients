import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { CipherType } from "@bitwarden/common/vault/enums";

import { AutofillOverlayElementType } from "../../enums/autofill-overlay.enum";
import AutofillScript from "../../models/autofill-script";

export type AutofillExtensionMessage = {
  command: string;
  tab?: chrome.tabs.Tab;
  sender?: string;
  fillScript?: AutofillScript;
  url?: string;
  subFrameUrl?: string;
  subFrameId?: string;
  pageDetailsUrl?: string;
  ciphers?: any;
  isInlineMenuHidden?: boolean;
  overlayElement?: AutofillOverlayElementType;
  isFocusingFieldElement?: boolean;
  authStatus?: AuthenticationStatus;
  isOpeningFullInlineMenu?: boolean;
  addNewCipherType?: CipherType;
  ignoreFieldFocus?: boolean;
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
  fillForm: ({ message }: AutofillExtensionMessageParam) => void;
};

export interface AutofillInit {
  init(): void;
  destroy(): void;
}
