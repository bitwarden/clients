import { Component, effect, input } from "@angular/core";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";

import { Icon, isIcon } from "@bitwarden/assets/svg";

@Component({
  selector: "bit-icon",
  host: {
    "[attr.aria-hidden]": "!ariaLabel()",
    "[attr.aria-label]": "ariaLabel()",
    "[innerHtml]": "innerHtml",
  },
  template: ``,
})
export class BitIconComponent {
  innerHtml: SafeHtml | null = null;

  readonly icon = input<Icon>();

  readonly ariaLabel = input<string>();

  constructor(private domSanitizer: DomSanitizer) {
    effect(() => {
      const icon = this.icon();
      if (!isIcon(icon)) {
        return;
      }
      const svg = icon.svg;
      this.innerHtml = this.domSanitizer.bypassSecurityTrustHtml(svg);
    });
  }
}
