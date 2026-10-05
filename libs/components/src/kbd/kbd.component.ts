import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { injectModifierGlyph } from "../utils";

/**
 * Keys whose printed legend differs by locale. Anything not listed renders verbatim, so the
 * `keys` input stays open-ended.
 */
const KEY_MESSAGE_IDS: Record<string, string> = {
  esc: "keyEscape",
  escape: "keyEscape",
  ctrl: "keyControl",
  control: "keyControl",
  command: "keyCommand",
};

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
  private readonly i18nService = inject(I18nService);

  protected readonly resolvedKeys = computed(() => this.keys().map((k) => this.resolve(k)));

  private resolve(key: string): string {
    if (key === "modifier") {
      return this.glyph();
    }
    const messageId = KEY_MESSAGE_IDS[key.toLowerCase()];
    return messageId ? this.i18nService.t(messageId) : key;
  }
}
