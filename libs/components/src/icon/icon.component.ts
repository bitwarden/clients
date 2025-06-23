import { Component, Input, input } from "@angular/core";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";

import { Icon, isIcon } from "./icon";

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

  // TODO: Skipped for migration because:
  //  Accessor inputs cannot be migrated as they are too complex.
  @Input() set icon(icon: Icon) {
    if (!isIcon(icon)) {
      return;
    }

    const svg = icon.svg;
    this.innerHtml = this.domSanitizer.bypassSecurityTrustHtml(svg);
  }

  readonly ariaLabel = input<string | undefined>(undefined);

  constructor(private domSanitizer: DomSanitizer) {}
}
