import { ChangeDetectionStrategy, Component, computed, input, model, output } from "@angular/core";

/**
 * Secret value with reveal toggle + copy. Hidden by default (security blur).
 *
 * BOUNDARY: like KlsCopyFieldComponent, copy is emitted, not performed here.
 * The masked representation never exposes the secret until the user reveals it.
 */
@Component({
  selector: "kls-reveal-field",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block" },
  template: `
    <div class="tw-flex tw-items-center tw-justify-between tw-gap-3 tw-py-1.5">
      <div class="tw-min-w-0">
        @if (label()) {
          <div class="tw-text-[12px] tw-font-medium tw-text-fg-body-subtle">{{ label() }}</div>
        }
        <div class="tw-truncate tw-font-mono tw-text-sm tw-tracking-tight tw-text-fg-body">
          {{ display() }}
        </div>
      </div>

      <div class="tw-flex tw-shrink-0 tw-items-center tw-gap-1">
        <button
          type="button"
          class="tw-rounded-[var(--fk-radius-sm)] tw-p-2 tw-text-fg-body-subtle tw-transition-colors hover:tw-bg-bg-secondary hover:tw-text-fg-body focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-[color:var(--color-border-focus)]"
          [attr.aria-label]="revealed() ? 'Hide' : 'Reveal'"
          [attr.aria-pressed]="revealed()"
          (click)="toggle()"
        >
          @if (revealed()) {
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.4 5.1A9.7 9.7 0 0 1 12 4.8c5 0 9 4.2 9 7.2a12 12 0 0 1-2.2 3.1M6.1 6.6A12 12 0 0 0 3 12c0 3 4 7.2 9 7.2 1 0 2-.2 2.9-.5"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          } @else {
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linejoin="round"
              />
              <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" />
            </svg>
          }
        </button>

        <button
          type="button"
          class="tw-rounded-[var(--fk-radius-sm)] tw-p-2 tw-text-fg-body-subtle tw-transition-colors hover:tw-bg-bg-secondary hover:tw-text-fg-body focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-[color:var(--color-border-focus)]"
          aria-label="Copy"
          (click)="copy.emit(value())"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect
              x="9"
              y="9"
              width="11"
              height="11"
              rx="2"
              stroke="currentColor"
              stroke-width="2"
            />
            <path
              d="M5 15V5a2 2 0 0 1 2-2h10"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  `,
})
export class KlsRevealFieldComponent {
  readonly label = input<string>("");
  readonly value = input.required<string>();
  /** Two-way bindable reveal state. */
  readonly revealed = model<boolean>(false);
  readonly copy = output<string>();

  protected readonly display = computed(() =>
    this.revealed() ? this.value() : "•".repeat(Math.min(Math.max(this.value().length, 8), 24)),
  );

  protected toggle(): void {
    this.revealed.update((v) => !v);
  }
}
