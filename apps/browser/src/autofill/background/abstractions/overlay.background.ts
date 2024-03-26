import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";

import AutofillPageDetails from "../../models/autofill-page-details";
import { PageDetail } from "../../services/abstractions/autofill.service";

import { LockedVaultPendingNotificationsData } from "./notification.background";

type PageDetailsForTab = Record<
  chrome.runtime.MessageSender["tab"]["id"],
  Map<chrome.runtime.MessageSender["frameId"], PageDetail>
>;

type SubFrameOffsetData = {
  url?: string;
  top: number;
  left: number;
  frameId?: number;
} | null;

type SubFrameOffsetsForTab = Record<
  chrome.runtime.MessageSender["tab"]["id"],
  Map<chrome.runtime.MessageSender["frameId"], SubFrameOffsetData>
>;

type WebsiteIconData = {
  imageEnabled: boolean;
  image: string;
  fallbackImage: string;
  icon: string;
};

type OverlayAddNewItemMessage = {
  login?: {
    uri?: string;
    hostname: string;
    username: string;
    password: string;
  };
};

type OverlayBackgroundExtensionMessage = {
  [key: string]: any;
  command: string;
  tab?: chrome.tabs.Tab;
  sender?: string;
  details?: AutofillPageDetails;
  overlayElement?: string;
  forceCloseOverlay?: boolean;
  isOverlayHidden?: boolean;
  setTransparentOverlay?: boolean;
  data?: LockedVaultPendingNotificationsData;
  isFieldCurrentlyFocused?: boolean;
  isCurrentlyFilling?: boolean;
} & OverlayAddNewItemMessage;

type OverlayPortMessage = {
  [key: string]: any;
  command: string;
  direction?: string;
  overlayCipherId?: string;
};

type FocusedFieldData = {
  focusedFieldStyles: Partial<CSSStyleDeclaration>;
  focusedFieldRects: Partial<DOMRect>;
  tabId?: number;
  frameId?: number;
};

type OverlayCipherData = {
  id: string;
  name: string;
  type: CipherType;
  reprompt: CipherRepromptType;
  favorite: boolean;
  icon: { imageEnabled: boolean; image: string; fallbackImage: string; icon: string };
  login?: { username: string };
  card?: string;
};

type BackgroundMessageParam = {
  message: OverlayBackgroundExtensionMessage;
};
type BackgroundSenderParam = {
  sender: chrome.runtime.MessageSender;
};
type BackgroundOnMessageHandlerParams = BackgroundMessageParam & BackgroundSenderParam;

type OverlayBackgroundExtensionMessageHandlers = {
  [key: string]: CallableFunction;
  openAutofillOverlay: () => void;
  closeAutofillOverlay: ({ message, sender }: BackgroundOnMessageHandlerParams) => void;
  autofillOverlayElementClosed: ({ message }: BackgroundMessageParam) => void;
  autofillOverlayAddNewVaultItem: ({ message, sender }: BackgroundOnMessageHandlerParams) => void;
  getAutofillOverlayVisibility: () => void;
  checkAutofillOverlayFocused: () => void;
  focusAutofillOverlayList: () => void;
  updateAutofillOverlayPosition: ({
    message,
    sender,
  }: BackgroundOnMessageHandlerParams) => Promise<void>;
  updateAutofillOverlayHidden: ({ message, sender }: BackgroundOnMessageHandlerParams) => void;
  updateFocusedFieldData: ({ message, sender }: BackgroundOnMessageHandlerParams) => void;
  collectPageDetailsResponse: ({ message, sender }: BackgroundOnMessageHandlerParams) => void;
  unlockCompleted: ({ message }: BackgroundMessageParam) => void;
  addEditCipherSubmitted: () => void;
  deletedCipher: () => void;
  checkIsFieldCurrentlyFocused: () => boolean;
  checkIsFieldCurrentlyFilling: () => boolean;
  updateIsFieldCurrentlyFocused: ({ message }: BackgroundMessageParam) => void;
  updateIsFieldCurrentlyFilling: ({ message }: BackgroundMessageParam) => void;
  checkIsInlineMenuButtonVisible: ({ sender }: BackgroundSenderParam) => void;
  checkIsInlineMenuListVisible: ({ sender }: BackgroundSenderParam) => void;
  updateSubFrameData: ({ message, sender }: BackgroundOnMessageHandlerParams) => void;
  rebuildSubFrameOffsets: ({ sender }: BackgroundSenderParam) => void;
};

type PortMessageParam = {
  message: OverlayPortMessage;
};
type PortConnectionParam = {
  port: chrome.runtime.Port;
};
type PortOnMessageHandlerParams = PortMessageParam & PortConnectionParam;

type OverlayButtonPortMessageHandlers = {
  [key: string]: CallableFunction;
  overlayButtonClicked: ({ port }: PortConnectionParam) => void;
  closeAutofillOverlay: ({ port }: PortConnectionParam) => void;
  forceCloseAutofillOverlay: ({ port }: PortConnectionParam) => void;
  overlayPageBlurred: () => void;
  redirectOverlayFocusOut: ({ message, port }: PortOnMessageHandlerParams) => void;
};

type OverlayListPortMessageHandlers = {
  [key: string]: CallableFunction;
  checkAutofillOverlayButtonFocused: () => void;
  forceCloseAutofillOverlay: ({ port }: PortConnectionParam) => void;
  overlayPageBlurred: () => void;
  unlockVault: ({ port }: PortConnectionParam) => void;
  fillSelectedListItem: ({ message, port }: PortOnMessageHandlerParams) => void;
  addNewVaultItem: ({ port }: PortConnectionParam) => void;
  viewSelectedCipher: ({ message, port }: PortOnMessageHandlerParams) => void;
  redirectOverlayFocusOut: ({ message, port }: PortOnMessageHandlerParams) => void;
};

interface OverlayBackground {
  init(): Promise<void>;
  removePageDetails(tabId: number): void;
  updateOverlayCiphers(): void;
}

export {
  PageDetailsForTab,
  SubFrameOffsetData,
  SubFrameOffsetsForTab,
  WebsiteIconData,
  OverlayBackgroundExtensionMessage,
  OverlayPortMessage,
  FocusedFieldData,
  OverlayCipherData,
  OverlayAddNewItemMessage,
  OverlayBackgroundExtensionMessageHandlers,
  OverlayButtonPortMessageHandlers,
  OverlayListPortMessageHandlers,
  OverlayBackground,
};
