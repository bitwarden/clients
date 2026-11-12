import { nothing } from "lit";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";

import { BitSvg, isBitSvg } from "@bitwarden/assets/svg";

/**
 * Renders a `BitSvg` inline, so selectors in the caller's shadow root (`[&_svg]:...`) reach it.
 *
 * @internal
 */
export function svgContent(content: BitSvg | null | undefined) {
  // Safe: `BitSvg` can only be created by the `svg` tag, which rejects interpolated values.
  return isBitSvg(content) ? unsafeSVG(content.svg) : nothing;
}
