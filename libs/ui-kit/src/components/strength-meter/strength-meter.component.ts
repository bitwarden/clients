import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

/**
 * Password-strength visualisation (zxcvbn-style score 0–4). The score itself is
 * computed by core/the generator via the bridge; this only renders it.
 */
@Component({
  selector: "kls-strength-meter",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block" },
  template: `
    <div class="tw-flex tw-items-center tw-gap-2">
      <div
        class="tw-flex tw-flex-1 tw-gap-1"
        role="meter"
        aria-label="Password strength"
        [attr.aria-valuenow]="score()"
        aria-valuemin="0"
        aria-valuemax="4"
      >
        @for (seg of segments; track seg) {
          <span
            class="tw-h-1.5 tw-flex-1 tw-rounded-[var(--fk-radius-full)] tw-transition-colors"
            [style.background-color]="
              seg <= score() ? barColor() : 'rgb(var(--color-gray-500) / 0.3)'
            "
          ></span>
        }
      </div>
      @if (showLabel()) {
        <span
          class="tw-w-16 tw-text-right tw-text-[12px] tw-font-medium"
          [style.color]="barColor()"
        >
          {{ label() }}
        </span>
      }
    </div>
  `,
})
export class KlsStrengthMeterComponent {
  /** 0–4 (zxcvbn convention). */
  readonly score = input.required<number>();
  readonly showLabel = input<boolean>(true);

  protected readonly segments = [1, 2, 3, 4] as const;

  protected readonly barColor = computed(() => {
    const s = this.score();
    if (s <= 1) {
      return "rgb(var(--fk-strength-weak))";
    }
    if (s === 2) {
      return "rgb(var(--fk-strength-medium))";
    }
    return "rgb(var(--fk-strength-strong))";
  });

  protected readonly label = computed(() => {
    const s = this.score();
    if (s <= 1) {
      return "Weak";
    }
    if (s === 2) {
      return "Fair";
    }
    if (s === 3) {
      return "Good";
    }
    return "Strong";
  });
}
