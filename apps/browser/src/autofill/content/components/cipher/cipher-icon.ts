import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { Globe } from "../../../content/components/icons";

export type CipherIconProps = {
  color: string;
  size: string;
  theme: Theme;
  uri?: string;
};

/**
 * @param {string} props.color contextual color override if no icon URI is available
 * @param {string} props.size valid CSS `width` value, represents the width-basis of the graphic, with height maintaining original aspect-ratio
 */
export function CipherIcon({ color, size, theme, uri }: CipherIconProps) {
  const iconClass = cipherIconStyle({ width: size });

  if (!uri) {
    return html`<span class=${iconClass}>${Globe({ color, theme })}</span>`;
  }

  // An icon that can't load (e.g. for a private IP or an internal hostname) shows the globe
  // instead of the browser's broken-image placeholder. The globe is rendered hidden beside the
  // image, so a later render with an icon that loads shows the image again.
  return html`<img
      class=${iconClass}
      src=${uri}
      @error=${showGlobeInstead}
      @load=${showImageInstead}
    /><span class=${iconClass} hidden>${Globe({ color, theme })}</span>`;
}

function showGlobeInstead(event: Event) {
  toggleFallback(event.currentTarget as HTMLImageElement, true);
}

function showImageInstead(event: Event) {
  toggleFallback(event.currentTarget as HTMLImageElement, false);
}

function toggleFallback(image: HTMLImageElement, showGlobe: boolean) {
  const globe = image.nextElementSibling as HTMLElement | null;
  image.hidden = showGlobe;
  if (globe) {
    globe.hidden = !showGlobe;
  }
}

const cipherIconStyle = ({ width }: { width: string }) => css`
  width: ${width};
  height: fit-content;
  max-height: 24px; /* fallback for Safari */
`;
