import { booleanLeaf, defineScalarOverlay, numberEnumLeaf } from "../../platform/managed-settings";
import { AutofillOverlayVisibility } from "../constants";
import { ENABLE_CONTEXT_MENU, INLINE_MENU_VISIBILITY } from "../services/autofill-settings.service";
import { SHOW_FAVICONS } from "../services/domain-settings.service";
import {
  ENABLE_ADDED_LOGIN_PROMPT,
  ENABLE_CHANGED_PASSWORD_PROMPT,
} from "../services/user-notification-settings.service";
import { InlineMenuVisibilitySetting } from "../types";

/** Register managed overlays for the autofill tier-2 keys. Idempotent. */
export function registerAutofillOverlay(): void {
  const visibilities: readonly InlineMenuVisibilitySetting[] = [
    AutofillOverlayVisibility.Off,
    AutofillOverlayVisibility.OnButtonClick,
    AutofillOverlayVisibility.OnFieldFocus,
  ];
  defineScalarOverlay(
    INLINE_MENU_VISIBILITY,
    "autofill.inlineMenuVisibility",
    numberEnumLeaf(visibilities),
  );
  defineScalarOverlay(ENABLE_CONTEXT_MENU, "autofill.contextMenu", booleanLeaf);
  defineScalarOverlay(ENABLE_ADDED_LOGIN_PROMPT, "autofill.addedLoginPrompt", booleanLeaf);
  defineScalarOverlay(
    ENABLE_CHANGED_PASSWORD_PROMPT,
    "autofill.changedPasswordPrompt",
    booleanLeaf,
  );
  defineScalarOverlay(SHOW_FAVICONS, "autofill.showFavicons", booleanLeaf);
}
