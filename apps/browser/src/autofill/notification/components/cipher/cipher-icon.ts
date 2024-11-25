import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { Globe } from "../icons";

export function CipherIcon({
  imageEnabled,
  image: uri,
  theme,
}: {
  imageEnabled: boolean;
  image: string;
  theme: Theme;
}) {
  return imageEnabled ? html`<img src=${uri} />` : Globe({ theme });
}
