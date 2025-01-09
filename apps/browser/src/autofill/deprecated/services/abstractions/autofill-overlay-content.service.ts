import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";

import AutofillField from "../../../models/autofill-field";
import AutofillPageDetails from "../../../models/autofill-page-details";
import { AutofillOverlayContentService } from "../../../services/abstractions/autofill-overlay-content.service";
import { ElementWithOpId, FormFieldElement } from "../../../types";

type OpenAutofillOverlayOptions = {
  isFocusingFieldElement?: boolean;
  isOpeningFullOverlay?: boolean;
  authStatus?: AuthenticationStatus;
};

interface LegacyAutofillOverlayContentService extends AutofillOverlayContentService {
  isFieldCurrentlyFocused: boolean;
  isCurrentlyFilling: boolean;
  isOverlayCiphersPopulated: boolean;
  pageDetailsUpdateRequired: boolean;
  autofillOverlayVisibility: number;
  init(): void;
  setupAutofillOverlayListenerOnField(
    autofillFieldElement: ElementWithOpId<FormFieldElement>,
    autofillFieldData: AutofillField,
    pageDetails: AutofillPageDetails,
  ): Promise<void>;
  openAutofillOverlay(options: OpenAutofillOverlayOptions): void;
  removeAutofillOverlay(): void;
  removeAutofillOverlayButton(): void;
  removeAutofillOverlayList(): void;
  addNewVaultItem(): void;
  redirectOverlayFocusOut(direction: "previous" | "next"): void;
  focusMostRecentOverlayField(): void;
  blurMostRecentOverlayField(): void;
  destroy(): void;
}

export { OpenAutofillOverlayOptions, LegacyAutofillOverlayContentService };
