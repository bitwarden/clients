import { NgClass } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

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
 * > `NOTE:` The maximum displayed count is 999. If the count is over 999, a “+” character is appended to indicate more.
 */
@Component({
  selector: "bit-berry",
  imports: [NgClass],
  templateUrl: "berry.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BerryComponent {
  protected readonly variant = input<BerryVariant>("primary");
  protected readonly count = input<number>();

  protected readonly content = computed(() => {
    const count = this.count();
    if (count == null || count <= 0) {
      return undefined;
    }
    return count > 999 ? "999+" : `${count}`;
  });

  protected readonly computedSize = computed<"small" | "large">(() => {
    const count = this.count();
    return count && count > 0 ? "large" : "small";
  });

  protected readonly textColor = computed(() => {
    return this.variant() === "contrast" ? "tw-text-fg-dark" : "tw-text-fg-white";
  });

  protected readonly padding = computed(() => {
    return this.count() > 9 ? "tw-px-1.5 tw-py-0.5" : "";
  });

  protected readonly berryClasses = computed(() => {
    const baseClasses = [
      "tw-inline-flex",
      "tw-items-center",
      "tw-justify-center",
      "tw-align-middle",
      "tw-text-xxs",
      "tw-rounded-full",
    ];

    const sizeClasses = {
      small: ["tw-h-2", "tw-w-2"],
      large: ["tw-h-4", "tw-min-w-4", this.padding()],
    };

    const variantClass = {
      primary: "tw-bg-bg-brand",
      subtle: "tw-bg-bg-contrast",
      success: "tw-bg-bg-success",
      warning: "tw-bg-bg-warning",
      danger: "tw-bg-bg-danger",
      accentPrimary: "tw-bg-fg-accent-primary-strong",
      contrast: "tw-bg-bg-white",
    };

    return [
      ...baseClasses,
      ...sizeClasses[this.computedSize()],
      variantClass[this.variant()],
      this.textColor(),
    ];
  });
}
