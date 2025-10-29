import { Component, effect, input } from "@angular/core";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";

import { Icon, isIcon } from "@bitwarden/assets/svg";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-icon",
  host: {
    "[attr.aria-hidden]": "!ariaLabel()",
    "[attr.aria-label]": "ariaLabel()",
    "[innerHtml]": "innerHtml",
    class: "tw-max-h-full tw-flex tw-justify-center",
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
