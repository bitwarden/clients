import { ChangeDetectionStrategy, Component, computed, input, model } from "@angular/core";

export type BerryVariant =
  | "primary"
  | "subtle"
  | "success"
  | "warning"
  | "danger"
  | "accentPrimary"
  | "contrast";

/**
 * The berry component is a compact visual indicator used to display short,
 * supplemental status information about another element,
 * like a navigation item, button, or icon button.
 * They draw users’ attention to status changes or new notifications.
 *
 * `NOTE:` By default, the full numeric value is displayed. Use `maxDigits` to cap the number of
 * digits shown — values at or above `10^maxDigits` display as `(10^maxDigits - 1)+` (e.g., `maxDigits=2` shows `99+`).
 */
@Component({
  selector: "bit-berry",
  templateUrl: "berry.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BerryComponent {
  readonly variant = model<BerryVariant>("primary");
  /**
   * Limits the number of digits displayed in a count berry. When the value reaches or exceeds 10^maxDigits, it displays the maximum representable value followed by +
   * @example
   * maxDigits=2 shows 99+ for values ≥ 100. If undefined, the full value is shown.
   */
  readonly maxDigits = input<number>();
  readonly value = input<number>();
  readonly type = input<"status" | "count">("count");

  protected readonly content = computed(() => {
    const value = this.value();
    const type = this.type();

    if (type === "status" || !value || value < 0) {
      return undefined;
    }

    const maxDigits = this.maxDigits();

    // 10 ** maxDigits means 10 raised to the power of maxDigits.
    // Same as Math.pow(10, maxDigits). So 10 ** 3 === 1000, 10 ** 4 === 10000, etc.
    if (maxDigits && value >= 10 ** maxDigits) {
      return `${(10 ** maxDigits - 1).toLocaleString()}+`;
    }
    return `${value.toLocaleString()}`;
  });

  protected readonly textColor = computed(() => {
    return this.variant() === "contrast" ? "tw-text-fg-heading" : "tw-text-fg-contrast";
  });

  protected readonly padding = computed(() => {
    return (this.content()?.toString().length ?? 0) > 2 ? "tw-px-1.5 tw-py-0.5" : "";
  });

  protected readonly containerClasses = computed(() => {
    const baseClasses = [
      "tw-inline-flex",
      "tw-items-center",
      "tw-justify-center",
      "tw-align-middle",
      "tw-text-xxs",
      "tw-rounded-full",
    ];

    const typeClasses = {
      status: ["tw-h-2", "tw-w-2"],
      count: ["tw-h-4", "tw-min-w-4", this.padding()],
    };

    const variantClass = {
      primary: "tw-bg-bg-brand",
      subtle: "tw-bg-bg-contrast",
      success: "tw-bg-bg-success",
      warning: "tw-bg-bg-warning",
      danger: "tw-bg-bg-danger",
      accentPrimary: "tw-bg-fg-accent-primary-strong",
      contrast: "tw-bg-bg-primary",
    };

    return [
      ...baseClasses,
      ...typeClasses[this.type()],
      variantClass[this.variant()],
      this.textColor(),
    ].join(" ");
  });
}
