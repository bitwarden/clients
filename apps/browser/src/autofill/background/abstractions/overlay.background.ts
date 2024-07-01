import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";

import AutofillPageDetails from "../../models/autofill-page-details";
import { PageDetail } from "../../services/abstractions/autofill.service";

import { LockedVaultPendingNotificationsData } from "./notification.background";

export type PageDetailsForTab = Record<
  chrome.runtime.MessageSender["tab"]["id"],
  Map<chrome.runtime.MessageSender["frameId"], PageDetail>
>;

export type SubFrameOffsetData = {
  top: number;
  left: number;
  url?: string;
  frameId?: number;
  parentFrameIds?: number[];
} | null;

export type SubFrameOffsetsForTab = Record<
  chrome.runtime.MessageSender["tab"]["id"],
  Map<chrome.runtime.MessageSender["frameId"], SubFrameOffsetData>
>;

export type WebsiteIconData = {
  imageEnabled: boolean;
  image: string;
  fallbackImage: string;
  icon: string;
};

export type FocusedFieldData = {
  focusedFieldStyles: Partial<CSSStyleDeclaration>;
  focusedFieldRects: Partial<DOMRect>;
  filledByCipherType?: CipherType;
  tabId?: number;
  frameId?: number;
};

export type InlineMenuElementPosition = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export type InlineMenuPosition = {
  button?: InlineMenuElementPosition;
  list?: InlineMenuElementPosition;
};

export type NewLoginCipherData = {
  uri?: string;
  hostname: string;
  username: string;
  password: string;
};

export type NewCardCipherData = {
  cardholderName: string;
  number: string;
  expirationMonth: string;
  expirationYear: string;
  expirationDate?: string;
  cvv: string;
};

export type OverlayAddNewItemMessage = {
  addNewCipherType?: CipherType;
  login?: NewLoginCipherData;
  card?: NewCardCipherData;
};

export type CloseInlineMenuMessage = {
  forceCloseInlineMenu?: boolean;
  overlayElement?: string;
};

export type ToggleInlineMenuHiddenMessage = {
  isInlineMenuHidden?: boolean;
  setTransparentInlineMenu?: boolean;
};

export type OverlayBackgroundExtensionMessage = {
  command: string;
  portKey?: string;
  tab?: chrome.tabs.Tab;
  sender?: string;
  details?: AutofillPageDetails;
  isFieldCurrentlyFocused?: boolean;
  isFieldCurrentlyFilling?: boolean;
  isVisible?: boolean;
  subFrameData?: SubFrameOffsetData;
  focusedFieldData?: FocusedFieldData;
  styles?: Partial<CSSStyleDeclaration>;
  data?: LockedVaultPendingNotificationsData;
} & OverlayAddNewItemMessage &
  CloseInlineMenuMessage &
  ToggleInlineMenuHiddenMessage;

export type OverlayPortMessage = {
  [key: string]: any;
  command: string;
  direction?: string;
  inlineMenuCipherId?: string;
  addNewCipherType?: CipherType;
};

export type InlineMenuCipherData = {
  id: string;
  name: string;
  type: CipherType;
  reprompt: CipherRepromptType;
  favorite: boolean;
  icon: WebsiteIconData;
  login?: { username: string };
  card?: string;
};

export type BackgroundMessageParam = {
  message: OverlayBackgroundExtensionMessage;
};
export type BackgroundSenderParam = {
  sender: chrome.runtime.MessageSender;
};
export type BackgroundOnMessageHandlerParams = BackgroundMessageParam & BackgroundSenderParam;

export type OverlayBackgroundExtensionMessageHandlers = {
  [key: string]: CallableFunction;
  autofillOverlayElementClosed: ({ message, sender }: BackgroundOnMessageHandlerParams) => void;
  autofillOverlayAddNewVaultItem: ({ message, sender }: BackgroundOnMessageHandlerParams) => void;
  triggerAutofillOverlayReposition: ({ message, sender }: BackgroundOnMessageHandlerParams) => void;
  checkIsInlineMenuCiphersPopulated: ({ sender }: BackgroundSenderParam) => void;
  updateFocusedFieldData: ({ message, sender }: BackgroundOnMessageHandlerParams) => void;
  updateIsFieldCurrentlyFocused: ({ message }: BackgroundMessageParam) => void;
  checkIsFieldCurrentlyFocused: () => boolean;
  updateIsFieldCurrentlyFilling: ({ message }: BackgroundMessageParam) => void;
  checkIsFieldCurrentlyFilling: () => boolean;
  getAutofillInlineMenuVisibility: () => void;
  openAutofillInlineMenu: () => void;
  closeAutofillInlineMenu: ({ message, sender }: BackgroundOnMessageHandlerParams) => void;
  checkAutofillInlineMenuFocused: ({ sender }: BackgroundSenderParam) => void;
  focusAutofillInlineMenuList: () => void;
  updateAutofillInlineMenuPosition: ({
    message,
    sender,
  }: BackgroundOnMessageHandlerParams) => Promise<void>;
  getAutofillInlineMenuPosition: () => InlineMenuPosition;
  updateAutofillInlineMenuElementIsVisibleStatus: ({
    message,
    sender,
  }: BackgroundOnMessageHandlerParams) => void;
  checkIsAutofillInlineMenuButtonVisible: () => void;
  checkIsAutofillInlineMenuListVisible: () => void;
  getCurrentTabFrameId: ({ sender }: BackgroundSenderParam) => number;
  updateSubFrameData: ({ message, sender }: BackgroundOnMessageHandlerParams) => void;
  triggerSubFrameFocusInRebuild: ({ sender }: BackgroundSenderParam) => void;
  destroyAutofillInlineMenuListeners: ({
    message,
    sender,
  }: BackgroundOnMessageHandlerParams) => void;
  collectPageDetailsResponse: ({ message, sender }: BackgroundOnMessageHandlerParams) => void;
  unlockCompleted: ({ message }: BackgroundMessageParam) => void;
  doFullSync: () => void;
  addedCipher: () => void;
  addEditCipherSubmitted: () => void;
  editedCipher: () => void;
  deletedCipher: () => void;
};

export type PortMessageParam = {
  message: OverlayPortMessage;
};
export type PortConnectionParam = {
  port: chrome.runtime.Port;
};
export type PortOnMessageHandlerParams = PortMessageParam & PortConnectionParam;

export type InlineMenuButtonPortMessageHandlers = {
  [key: string]: CallableFunction;
  triggerDelayedAutofillInlineMenuClosure: ({ port }: PortConnectionParam) => void;
  autofillInlineMenuButtonClicked: ({ port }: PortConnectionParam) => void;
  autofillInlineMenuBlurred: () => void;
  redirectAutofillInlineMenuFocusOut: ({ message, port }: PortOnMessageHandlerParams) => void;
  updateAutofillInlineMenuColorScheme: () => void;
};

export type InlineMenuListPortMessageHandlers = {
  [key: string]: CallableFunction;
  checkAutofillInlineMenuButtonFocused: () => void;
  autofillInlineMenuBlurred: () => void;
  unlockVault: ({ port }: PortConnectionParam) => void;
  fillAutofillInlineMenuCipher: ({ message, port }: PortOnMessageHandlerParams) => void;
  addNewVaultItem: ({ message, port }: PortOnMessageHandlerParams) => void;
  viewSelectedCipher: ({ message, port }: PortOnMessageHandlerParams) => void;
  redirectAutofillInlineMenuFocusOut: ({ message, port }: PortOnMessageHandlerParams) => void;
  updateAutofillInlineMenuListHeight: ({ message, port }: PortOnMessageHandlerParams) => void;
};

export interface OverlayBackground {
  init(): Promise<void>;
  removePageDetails(tabId: number): void;
  updateOverlayCiphers(updateAllCipherTypes?: boolean): Promise<void>;
}
