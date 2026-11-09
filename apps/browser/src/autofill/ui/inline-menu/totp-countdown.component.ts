import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from "@angular/core";

import { TypographyModule } from "@bitwarden/components";

const EXPIRING_SECONDS = 7;
const INNER_CIRCUMFERENCE = 60;

/** Matches the vault's TOTP countdown ring. */
@Component({
  selector: "autofill-totp-countdown",
  imports: [TypographyModule],
  host: { class: "tw-relative tw-flex tw-size-7 tw-shrink-0 tw-items-center tw-justify-center" },
  template: `
    <span
      class="tw-absolute"
      bitTypography="helper"
      aria-hidden="true"
      [class.tw-text-fg-heading]="!expiring()"
      [class.tw-text-fg-danger]="expiring()"
    >
      {{ seconds() }}
    </span>
    <svg class="tw-size-7 -tw-rotate-90" viewBox="0 0 28 28" aria-hidden="true">
      <circle
        class="tw-fill-none"
        [class.tw-stroke-text-main]="!expiring()"
        [class.tw-stroke-danger-600]="expiring()"
        r="9.5"
        cy="14"
        cx="14"
        stroke-width="2"
        [attr.stroke-dasharray]="INNER_CIRCUMFERENCE"
        [style.stroke-dashoffset.px]="dashOffset()"
      ></circle>
      <circle
        class="tw-fill-none"
        [class.tw-stroke-text-main]="!expiring()"
        [class.tw-stroke-danger-600]="expiring()"
        r="11"
        cy="14"
        cx="14"
        stroke-width="1"
      ></circle>
    </svg>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TotpCountdownComponent {
  protected readonly INNER_CIRCUMFERENCE = INNER_CIRCUMFERENCE;

  readonly period = input(30);
  /** Freezes the countdown at a fixed value instead of tracking the clock. */
  readonly secondsRemaining = input<number>();

  /** Emits each time the period rolls over and a new code is due. */
  readonly periodElapsed = output<void>();

  private readonly liveSeconds = signal(0);

  protected readonly seconds = computed(() => this.secondsRemaining() ?? this.liveSeconds());
  protected readonly expiring = computed(() => this.seconds() <= EXPIRING_SECONDS);
  protected readonly dashOffset = computed(
    () => ((this.period() - this.seconds()) / this.period()) * INNER_CIRCUMFERENCE,
  );

  constructor() {
    effect((onCleanup) => {
      if (this.secondsRemaining() !== undefined) {
        return;
      }
      const period = this.period();
      const tick = () => {
        const elapsed = Math.round(Date.now() / 1000) % period;
        this.liveSeconds.set(period - elapsed);
        if (elapsed === 0) {
          this.periodElapsed.emit();
        }
      };
      tick();
      const id = globalThis.setInterval(tick, 1000);
      onCleanup(() => globalThis.clearInterval(id));
    });
  }
}
