import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

export type KlsButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type KlsButtonSize = "sm" | "md" | "lg";

const BASE =
  "tw-inline-flex tw-items-center tw-justify-center tw-gap-2 tw-font-medium tw-leading-none " +
  "tw-rounded-[var(--fk-radius-full)] tw-border tw-select-none " +
  "focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-offset-2 focus-visible:tw-ring-[color:var(--color-border-focus)] " +
  "disabled:tw-pointer-events-none disabled:tw-opacity-40";

const VARIANTS: Record<KlsButtonVariant, string> = {
  primary:
    "tw-bg-fg-brand tw-border-transparent tw-text-contrast tw-shadow-[var(--fk-elev-sm)] " +
    "hover:tw-brightness-110 hover:tw-shadow-[var(--fk-elev-md)] active:tw-scale-[0.97] active:tw-shadow-[var(--fk-elev-xs)]",
  secondary:
    "tw-border-transparent tw-text-fg-body tw-shadow-[var(--fk-elev-glow)] " +
    "hover:tw-shadow-[var(--fk-elev-sm)] active:tw-scale-[0.97]",
  ghost:
    "tw-bg-transparent tw-border-transparent tw-text-fg-body " +
    "hover:tw-text-fg-heading active:tw-scale-[0.97]",
  danger:
    "tw-bg-fg-danger tw-border-transparent tw-text-contrast tw-shadow-[var(--fk-elev-sm)] " +
    "hover:tw-brightness-110 hover:tw-shadow-[var(--fk-elev-md)] active:tw-scale-[0.97]",
};

const SIZES: Record<KlsButtonSize, string> = {
  sm: "tw-h-8 tw-px-4 tw-text-[13px]",
  md: "tw-h-10 tw-px-5 tw-text-sm",
  lg: "tw-h-12 tw-px-6 tw-text-[15px]",
};

@Component({
  selector: "button[klsButton], a[klsButton]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: "<ng-content></ng-content>",
  host: {
    "[class]": "classes()",
    "[style.transition]":
      "'all var(--fk-dur-fast) var(--fk-ease), transform var(--fk-dur-fast) var(--fk-ease-spring)'",
    "[style.backdrop-filter]": "variant() === 'secondary' ? 'blur(var(--fk-blur-subtle))' : null",
    "[style.-webkit-backdrop-filter]": "variant() === 'secondary' ? 'blur(var(--fk-blur-subtle))' : null",
    "[style.background-color]": "variant() === 'secondary' ? 'var(--fk-card-bg)' : null",
  },
})
export class KlsButtonComponent {
  readonly variant = input<KlsButtonVariant>("primary");
  readonly size = input<KlsButtonSize>("md");

  protected readonly classes = computed(() =>
    [BASE, VARIANTS[this.variant()], SIZES[this.size()]].join(" "),
  );
}
