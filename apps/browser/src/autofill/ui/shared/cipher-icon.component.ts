import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { IconComponent } from "@bitwarden/components";

@Component({
  selector: "autofill-cipher-icon",
  imports: [IconComponent],
  host: { class: "tw-flex tw-size-6 tw-shrink-0 tw-items-center tw-justify-center" },
  template: `
    @if (uri()) {
      <img [src]="uri()" alt="" class="tw-max-h-6 tw-w-6 tw-object-contain" />
    } @else {
      <bit-icon name="bwi-globe" class="tw-text-xl tw-text-fg-body-subtle" />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CipherIconComponent {
  /** Favicon URL. Falls back to a globe icon when omitted. */
  readonly uri = input<string>();
}
