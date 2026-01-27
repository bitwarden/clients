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

  readonly content = input<Icon>();
  readonly ariaLabel = input<string>();

  protected readonly innerHtml = computed<SafeHtml | null>(() => {
    const content = this.content();
    if (!isIcon(content)) {
      return null;
    }
    const svg = content.svg;
    return this.domSanitizer.bypassSecurityTrustHtml(svg);
  });
}
