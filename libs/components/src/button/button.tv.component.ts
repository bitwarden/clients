// NOTE: Illustrative only — tailwind-variants is not installed.
// Shows what button.component.ts would look like using tailwind-variants.

import {
  input,
  HostBinding,
  Component,
  model,
  computed,
  booleanAttribute,
  inject,
  ElementRef,
} from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { tv } from "tailwind-variants";
import { debounce, interval } from "rxjs";

import { AriaDisableDirective } from "../a11y";
import { ButtonLikeAbstraction, ButtonType, ButtonSize } from "../shared/button-like.abstraction";
import { BitwardenIcon } from "../shared/icon";
import { SpinnerComponent } from "../spinner";
import { ariaDisableElement } from "../utils";

const focusRing = [
  "focus-visible:tw-ring-2",
  "focus-visible:tw-ring-offset-2",
  "focus-visible:tw-ring-primary-600",
  "focus-visible:tw-z-10",
] as const;

const buttonVariants = tv({
  slots: {
    // Host element — was @HostBinding, previously built by hand with .concat()
    root: [
      "tw-font-medium",
      "tw-rounded-full",
      "tw-transition",
      "tw-border-2",
      "tw-border-solid",
      "tw-text-center",
      "tw-no-underline",
      "hover:tw-no-underline",
      "focus:tw-outline-none",
    ],
    // Outer wrapper span
    wrapper: ["tw-relative", "tw-flex", "tw-items-center", "tw-justify-center"],
    // Icon + label row — visibility toggled by the `loading` variant
    content: ["tw-flex", "tw-items-center", "tw-gap-2"],
    // Absolutely positioned spinner overlay
    loadingOverlay: [
      "tw-absolute",
      "tw-inset-0",
      "tw-flex",
      "tw-items-center",
      "tw-justify-center",
    ],
  },

  variants: {
    buttonType: {
      primary: {
        root: [
          "tw-border-primary-600",
          "tw-bg-primary-600",
          "!tw-text-contrast",
          "hover:tw-bg-primary-700",
          "hover:tw-border-primary-700",
          ...focusRing,
        ],
      },
      secondary: {
        root: [
          "tw-bg-transparent",
          "tw-border-primary-600",
          "!tw-text-primary-600",
          "hover:tw-bg-hover-default",
          ...focusRing,
        ],
      },
      danger: {
        root: [
          "tw-bg-transparent",
          "tw-border-danger-600",
          "!tw-text-danger",
          "hover:tw-bg-danger-600",
          "hover:tw-border-danger-600",
          "hover:!tw-text-contrast",
          ...focusRing,
        ],
      },
      dangerPrimary: {
        root: [
          "tw-border-danger-600",
          "tw-bg-danger-600",
          "!tw-text-contrast",
          "hover:tw-bg-danger-700",
          "hover:tw-border-danger-700",
          ...focusRing,
        ],
      },
      unstyled: {},
    },

    size: {
      default: { root: ["tw-py-1.5", "tw-px-3"] },
      small: { root: ["tw-py-1", "tw-px-3", "tw-text-sm"] },
    },

    block: {
      true:  { root: ["tw-w-full", "tw-block"] },
      false: { root: ["tw-inline-block"] },
    },

    showDisabledStyles: {
      true: {
        root: [
          "aria-disabled:!tw-bg-secondary-300",
          "hover:tw-bg-secondary-300",
          "aria-disabled:tw-border-secondary-300",
          "hover:tw-border-secondary-300",
          "aria-disabled:!tw-text-muted",
          "hover:!tw-text-muted",
          "aria-disabled:tw-cursor-not-allowed",
          "hover:tw-no-underline",
        ],
      },
      false: {},
    },

    // Controls content visibility during loading. Expressed as a slot variant
    // so the spinner and the label are coordinated in one place.
    loading: {
      true:  { content: ["tw-invisible"] },
      false: {},
    },
  },

  defaultVariants: {
    buttonType: "secondary",
    size: "default",
    block: false,
    showDisabledStyles: false,
    loading: false,
  },
});

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "button[bitButton], a[bitButton]",
  templateUrl: "button.tv.component.html",
  providers: [{ provide: ButtonLikeAbstraction, useExisting: ButtonComponent }],
  imports: [SpinnerComponent],
  hostDirectives: [AriaDisableDirective],
})
export class ButtonComponent implements ButtonLikeAbstraction {
  // All slot classes computed together — one reactive derivation for the whole component.
  // The template destructures the slots it needs; no separate class computeds required.
  protected readonly styles = computed(() =>
    buttonVariants({
      buttonType: this.buttonType() ?? "secondary",
      size: this.size() ?? "default",
      block: this.block(),
      showDisabledStyles: this.showDisabledStyles() || this.disabled(),
      loading: this.showLoadingStyle() ?? false,
    }),
  );

  @HostBinding("class") get classList() {
    return this.styles().root();
  }

  protected readonly disabledAttr = computed(() => {
    const disabled = this.disabled() != null && this.disabled() !== false;
    return disabled || this.loading();
  });

  protected readonly showDisabledStyles = computed(() => {
    return this.showLoadingStyle() || (this.disabledAttr() && this.loading() === false);
  });

  readonly buttonType = input<ButtonType>("secondary");
  readonly startIcon = input<BitwardenIcon | undefined>(undefined);
  readonly endIcon = input<BitwardenIcon | undefined>(undefined);
  readonly size = input<ButtonSize>("default");
  readonly block = input(false, { transform: booleanAttribute });
  readonly loading = model<boolean>(false);

  readonly startIconClasses = computed(() => ["bwi", this.startIcon()]);
  readonly endIconClasses = computed(() => ["bwi", this.endIcon()]);

  protected readonly showLoadingStyle = toSignal(
    toObservable(this.loading).pipe(debounce((isLoading) => interval(isLoading ? 75 : 0))),
  );

  readonly disabled = model<boolean>(false);
  private el = inject(ElementRef<HTMLButtonElement>);

  constructor() {
    ariaDisableElement(this.el.nativeElement, this.disabledAttr);
  }
}
