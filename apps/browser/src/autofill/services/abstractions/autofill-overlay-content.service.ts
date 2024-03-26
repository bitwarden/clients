import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";

import AutofillField from "../../models/autofill-field";
import { ElementWithOpId, FormFieldElement } from "../../types";

export type OpenAutofillOverlayOptions = {
  isFocusingFieldElement?: boolean;
  isOpeningFullOverlay?: boolean;
  authStatus?: AuthenticationStatus;
};

export type AutofillOverlayContentExtensionMessageHandlers = {
  [key: string]: CallableFunction;
  blurMostRecentOverlayField: () => void;
};

export interface AutofillOverlayContentService {
  // isFieldCurrentlyFocused: boolean;
  // isCurrentlyFilling: boolean;
  isOverlayCiphersPopulated: boolean;
  pageDetailsUpdateRequired: boolean;
  autofillOverlayVisibility: number;
  extensionMessageHandlers: any;
  init(): void;
  setupAutofillOverlayListenerOnField(
    autofillFieldElement: ElementWithOpId<FormFieldElement>,
    autofillFieldData: AutofillField,
  ): Promise<void>;
  openAutofillOverlay(options: OpenAutofillOverlayOptions): void;
  // removeAutofillOverlay(): void;
  // removeAutofillOverlayButton(): void;
  // removeAutofillOverlayList(): void;
  addNewVaultItem(): void;
  redirectOverlayFocusOut(direction: "previous" | "next"): void;
  focusMostRecentOverlayField(): void;
  blurMostRecentOverlayField(): void;
  destroy(): void;
}
