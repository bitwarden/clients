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
 * > `NOTE:` The maximum displayed value is 999. If the value is over 999, a “+” character is appended to indicate more.
 */
@Component({
  selector: "bit-berry",
  templateUrl: "berry.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BerryComponent {
  protected readonly variant = input<BerryVariant>("primary");
  protected readonly value = input<number>();
  protected readonly type = input<"status" | "count">("count");

  protected readonly content = computed(() => {
    const value = this.value();
    const type = this.type();

    if (type === "status" || !value || value < 0) {
      return undefined;
    }
    return value > 999 ? "999+" : `${value}`;
  });

  protected readonly textColor = computed(() => {
    return this.variant() === "contrast" ? "tw-text-fg-heading" : "tw-text-fg-contrast";
  });

  protected readonly padding = computed(() => {
    return (this.value()?.toString().length ?? 0) > 2 ? "tw-px-1.5 tw-py-0.5" : "";
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
