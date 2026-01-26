import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";

import { Icon, isIcon } from "@bitwarden/assets/svg";

@Component({
  selector: "bit-svg",
  host: {
    "[attr.aria-hidden]": "!ariaLabel()",
    "[attr.aria-label]": "ariaLabel()",
    "[innerHtml]": "innerHtml()",
    class: "tw-max-h-full tw-flex tw-justify-center",
  },
  template: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvgComponent {
  private domSanitizer = inject(DomSanitizer);

  readonly icon = input<Icon>();
  readonly ariaLabel = input<string>();

  protected readonly innerHtml = computed<SafeHtml | null>(() => {
    const icon = this.icon();
    if (!isIcon(icon)) {
      return null;
    }
    const svg = icon.svg;
    return this.domSanitizer.bypassSecurityTrustHtml(svg);
  });
}
