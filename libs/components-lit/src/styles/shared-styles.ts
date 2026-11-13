import { unsafeCSS } from "lit";

import shadowCss from "./shadow.css?inline";

/** Tailwind utilities, preflight and icon classes for use inside shadow roots. */
export const sharedStyles = unsafeCSS(shadowCss);
