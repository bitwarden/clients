import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from "@angular/core";

const EXPIRING_SECONDS = 7;
const CIRCUMFERENCE = 2 * Math.PI * 11;

/** A thin countdown ring around the seconds left in the current TOTP period. */
@Component({
  selector: "autofill-totp-countdown",
  host: { class: "tw-flex tw-size-6 tw-shrink-0" },
  template: `
    <svg class="tw-size-6" viewBox="0 0 24 24" aria-hidden="true">
      <circle class="tw-fill-none tw-stroke-border-base" r="11" cx="12" cy="12" stroke-width="1" />
      <circle
        class="tw-fill-none"
        [class.tw-stroke-fg-body]="!expiring()"
        [class.tw-stroke-fg-danger]="expiring()"
        r="11"
        cx="12"
        cy="12"
        stroke-width="1.5"
        transform="rotate(-90 12 12)"
        [attr.stroke-dasharray]="CIRCUMFERENCE"
        [attr.stroke-dashoffset]="dashOffset()"
      />
      <text
        x="12"
        y="12"
        text-anchor="middle"
        dominant-baseline="central"
        font-size="10"
        [class.tw-fill-fg-body]="!expiring()"
        [class.tw-fill-fg-danger]="expiring()"
      >
        {{ seconds() }}
      </text>
    </svg>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TotpCountdownComponent {
  protected readonly CIRCUMFERENCE = CIRCUMFERENCE;

  readonly period = input(30);
  /** Freezes the countdown at a fixed value instead of tracking the clock. */
  readonly secondsRemaining = input<number>();

  /** Emits each time the period rolls over and a new code is due. */
  readonly periodElapsed = output<void>();

  private readonly liveSeconds = signal(0);

  protected readonly seconds = computed(() => this.secondsRemaining() ?? this.liveSeconds());
  protected readonly expiring = computed(() => this.seconds() <= EXPIRING_SECONDS);
  protected readonly dashOffset = computed(
    () => ((this.period() - this.seconds()) / this.period()) * CIRCUMFERENCE,
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
