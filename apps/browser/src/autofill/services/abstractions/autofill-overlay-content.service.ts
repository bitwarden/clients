import { ModifyLoginCipherFormData } from "../../background/abstractions/overlay-notifications.background";
import { SubFrameOffsetData } from "../../background/abstractions/overlay.background";
import { AutofillExtensionMessageParam } from "../../content/abstractions/autofill-init";
import { AutofillMonitor } from "../../content/abstractions/autofill-monitor";
import AutofillField from "../../models/autofill-field";
import AutofillPageDetails from "../../models/autofill-page-details";
import { ElementWithOpId, FormFieldElement } from "../../types";

/**
 * Payload posted between frames to accumulate a sub frame's offset as it is
 * relayed up the frame tree. `subFrameDepth`
 *
 * This type guards the *send* side at compile time: the runtime counterpart for
 * untrusted inbound messages is `isSubFramePositioningMessageData` in `../utils`.
 */
export type SubFrameOffsetWindowMessageData = Omit<NonNullable<SubFrameOffsetData>, "url"> & {
  /**
   * Forbid `url`. This protects against leaking a frame's location to every
   * ancestor frame when posted with a `"*"` target origin.
   */
  url?: never;

  /** tracks how many frames the message has traversed so the relay can stop at
   * `MAX_SUB_FRAME_DEPTH` rather than walk an unbounded chain.
   */
  subFrameDepth: number;
};

export type AutofillOverlayContentExtensionMessageHandlers = {
  [key: string]: CallableFunction;
  addNewVaultItemFromOverlay: ({ message }: AutofillExtensionMessageParam) => void;
  focusMostRecentlyFocusedField: () => void;
  blurMostRecentlyFocusedField: () => Promise<void>;
  unsetMostRecentlyFocusedField: () => void;
  checkIsMostRecentlyFocusedFieldWithinViewport: () => Promise<boolean>;
  bgUnlockPopoutOpened: () => Promise<void>;
  bgVaultItemRepromptPopoutOpened: () => Promise<void>;
  redirectAutofillInlineMenuFocusOut: ({ message }: AutofillExtensionMessageParam) => void;
  getSubFrameOffsets: ({ message }: AutofillExtensionMessageParam) => Promise<SubFrameOffsetData>;
  getSubFrameOffsetsFromWindowMessage: ({ message }: AutofillExtensionMessageParam) => void;
  checkMostRecentlyFocusedFieldHasValue: () => boolean;
  setupRebuildSubFrameOffsetsListeners: () => void;
  destroyAutofillInlineMenuListeners: () => void;
  getInlineMenuFormFieldData: ({
    message,
  }: AutofillExtensionMessageParam) => Promise<ModifyLoginCipherFormData | void>;
};

export interface AutofillOverlayContentService extends AutofillMonitor {
  pageDetailsUpdateRequired: boolean;
  messageHandlers: AutofillOverlayContentExtensionMessageHandlers;
  setupOverlayListeners(
    autofillFieldElement: ElementWithOpId<FormFieldElement>,
    autofillFieldData: AutofillField,
    pageDetails: AutofillPageDetails,
  ): Promise<void>;
  blurMostRecentlyFocusedField(isClosingInlineMenu?: boolean): void;
  getOwnedInlineMenuTagNames(): string[];
  isElementInlineMenu(element: Element): boolean;
  getUnownedTopLayerItems(includeCandidates?: boolean): NodeListOf<Element> | undefined;
  refreshMenuLayerPosition(): void;
  clearUserFilledFields(): void;
  destroy(): void;
}
