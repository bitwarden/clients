import { ChangeDetectionStrategy, Component, input, output, signal } from "@angular/core";

/**
 * Labelled value row with a quick-copy affordance.
 *
 * SECURITY/BOUNDARY: this primitive does NOT write to the clipboard itself.
 * It emits `(copy)` and shows a transient "copied" state; the container wires
 * the event to `@klappstuhl/ui-bridge`'s CopyService (which owns the platform
 * clipboard + auto-clear behaviour). This keeps sensitive values off the UI's
 * direct code path.
 */
@Component({
  selector: "kls-copy-field",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block" },
  template: `
    <div class="tw-flex tw-items-center tw-justify-between tw-gap-3 tw-py-2.5">
      <div class="tw-min-w-0">
        @if (label()) {
          <div class="tw-mb-0.5 tw-text-[11px] tw-font-medium tw-uppercase tw-tracking-wider tw-text-fg-body-subtle">{{ label() }}</div>
        }
        <div
          class="tw-truncate tw-text-[14px] tw-text-fg-heading"
          [class.tw-font-mono]="mono()"
          [class.tw-tracking-tight]="mono()"
        >
          {{ value() }}
        </div>
      </div>

      <button
        type="button"
        class="tw-shrink-0 tw-rounded-[var(--fk-radius-full)] tw-p-2 tw-text-fg-body-subtle focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-[color:var(--color-border-focus)]"
        style="transition: all var(--fk-dur-fast) var(--fk-ease-spring); background-color: transparent"
        (mouseenter)="$any($event.currentTarget).style.backgroundColor = 'var(--fk-hover-bg)'; $any($event.currentTarget).style.transform = 'scale(1.1)'; $any($event.currentTarget).style.color = 'var(--color-fg-brand)'"
        (mouseleave)="$any($event.currentTarget).style.backgroundColor = 'transparent'; $any($event.currentTarget).style.transform = 'scale(1)'; $any($event.currentTarget).style.color = ''"
        [attr.aria-label]="copied() ? 'Copied' : 'Copy ' + label()"
        (click)="onCopy()"
      >
        @if (copied()) {
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M20 6 9 17l-5-5"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        } @else {
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
        }
      </button>
    </div>
  `,
})
export class KlsCopyFieldComponent {
  readonly label = input<string>("");
  readonly value = input.required<string>();
  readonly mono = input<boolean>(false);

  /** Emitted when the user requests a copy; the container performs the copy. */
  readonly copy = output<string>();

  protected readonly copied = signal(false);
  private readonly timer = signal<ReturnType<typeof setTimeout> | undefined>(undefined);

  protected onCopy(): void {
    this.copy.emit(this.value());
    this.copied.set(true);
    clearTimeout(this.timer());
    this.timer.set(setTimeout(() => this.copied.set(false), 1200));
  }
}
