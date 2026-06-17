import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

export type KlsButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type KlsButtonSize = "sm" | "md";

const BASE =
  "tw-inline-flex tw-items-center tw-justify-center tw-gap-2 tw-font-medium tw-leading-none " +
  "tw-rounded-[var(--fk-radius-md)] tw-border tw-transition-colors tw-duration-150 tw-select-none " +
  "focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-[color:var(--color-border-focus)] " +
  "disabled:tw-opacity-50 disabled:tw-cursor-not-allowed";

const VARIANTS: Record<KlsButtonVariant, string> = {
  primary: "tw-bg-fg-brand tw-border-transparent tw-text-contrast hover:tw-bg-fg-brand-strong",
  secondary: "tw-bg-bg-secondary tw-border-border-base tw-text-fg-body hover:tw-bg-bg-tertiary",
  ghost: "tw-bg-transparent tw-border-transparent tw-text-fg-body hover:tw-bg-bg-secondary",
  danger: "tw-bg-fg-danger tw-border-transparent tw-text-contrast hover:tw-bg-fg-danger-strong",
};

const SIZES: Record<KlsButtonSize, string> = {
  sm: "tw-h-8 tw-px-3 tw-text-[13px]",
  md: "tw-h-10 tw-px-4 tw-text-sm",
};

/**
 * Premium button. Attribute selector so it applies to native <button>/<a>
 * elements (keeps semantics + a11y; no wrapper element).
 *
 * Usage: `<button klsButton variant="primary" size="md">Save</button>`
 */
@Component({
  selector: "button[klsButton], a[klsButton]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: "<ng-content></ng-content>",
  host: { "[class]": "classes()" },
})
export class KlsButtonComponent {
  readonly variant = input<KlsButtonVariant>("primary");
  readonly size = input<KlsButtonSize>("md");

  protected readonly classes = computed(() =>
    [BASE, VARIANTS[this.variant()], SIZES[this.size()]].join(" "),
  );
}
