import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import { injectModifierGlyph } from "../utils";

@Component({
  selector: "bit-kbd",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-inline-flex tw-items-center tw-gap-1" },
  template: `
    @for (key of resolvedKeys(); track $index) {
      @if (!$first) {
        <span class="tw-text-xs tw-leading-none tw-text-fg-body-subtle">+</span>
      }
      <kbd
        class="tw-inline-flex tw-items-center tw-rounded tw-border tw-border-solid tw-border-border-base tw-bg-bg-primary tw-p-1 tw-font-mono tw-text-xs/4 tw-text-fg-body-subtle"
        >{{ key }}</kbd
      >
    }
  `,
})
export class BitKbdComponent {
  readonly keys = input<string[]>([]);

  private readonly glyph = injectModifierGlyph();

  protected readonly resolvedKeys = computed(() =>
    this.keys().map((k) => (k === "modifier" ? this.glyph() : k)),
  );
}
