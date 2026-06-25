import {
  booleanLeaf,
  defineScalarOverlay,
  enumLeaf,
} from "@bitwarden/common/platform/managed-settings";

/* eslint-disable no-restricted-imports */
import {
  COPY_BUTTON,
  CopyButtonDisplayMode,
} from "../../vault/popup/services/vault-popup-copy-buttons.service";
import { COMPACT_MODE } from "../popup/layout/popup-compact-mode.service";
/* eslint-enable no-restricted-imports */

/** Register managed overlays for the browser-only appearance keys (compact mode, copy buttons). Idempotent. */
export function registerBrowserAppearanceOverlay(): void {
  const copyModes: readonly CopyButtonDisplayMode[] = ["combined", "quick"];
  defineScalarOverlay(COMPACT_MODE, "theming.compactMode", booleanLeaf);
  defineScalarOverlay(COPY_BUTTON, "vaultAppearance.copyButtons", enumLeaf(copyModes));
}
