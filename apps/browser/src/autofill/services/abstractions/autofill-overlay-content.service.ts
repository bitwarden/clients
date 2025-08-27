import { ModifyLoginCipherFormData } from "../../background/abstractions/overlay-notifications.background";
import { SubFrameOffsetData } from "../../background/abstractions/overlay.background";
import { AutofillExtensionMessageParam } from "../../content/abstractions/autofill-init";
import AutofillField from "../../models/autofill-field";
import AutofillPageDetails from "../../models/autofill-page-details";
import { ElementWithOpId, FormFieldElement } from "../../types";

export type SubFrameDataFromWindowMessage = SubFrameOffsetData & {
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
  }: AutofillExtensionMessageParam) => Promise<ModifyLoginCipherFormData>;
};

export interface AutofillOverlayContentService {
  pageDetailsUpdateRequired: boolean;
  messageHandlers: AutofillOverlayContentExtensionMessageHandlers;
  init(): void;
  setupOverlayListeners(
    autofillFieldElement: ElementWithOpId<FormFieldElement>,
    autofillFieldData: AutofillField,
    pageDetails: AutofillPageDetails,
  ): Promise<void>;
  blurMostRecentlyFocusedField(isClosingInlineMenu?: boolean): void;
  refreshMenuLayerPosition(): void;
  getOwnedInlineMenuTagNames(): string[];
  clearUserFilledFields(): void;
  destroy(): void;
}
