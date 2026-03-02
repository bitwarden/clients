import { CdkTrapFocus } from "@angular/cdk/a11y";
import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  signal,
} from "@angular/core";

import { getRootFontSizePx } from "../../shared";
import {
  DialogSize,
  dialogSizeToWidth,
  drawerSizeToWidth,
  drawerSizeToWidthRem,
} from "../dialog-sizes";
import { DialogRef } from "../dialog.service";
import { DrawerService } from "../drawer.service";

/**
 * Low-level container that provides the visual chrome and layout constraints.
 *
 * **Responsibilities:**
 *
 * - Applies size-dependent max-width constraints via the `dialogSize` input.
 * - Renders default visual chrome (background, border, shadow, rounded corners)
 *   unless `disableChrome` is set.
 * - Traps focus inside the container via `CdkTrapFocus`.
 * - Closes the dialog on <kbd>Escape</kbd> (when `dialogRef.disableClose` is false).
 * - Plays a slide-in entrance animation (skipped for drawers or when `disableAnimations` is set).
 * - In drawer mode, declares the push-width on `DrawerService` so sibling content
 *   can offset itself accordingly.
 *
 * This component is a **building block** — it does not include a title bar,
 * footer, or close button. Wrap it with `<bit-dialog>` for a full dialog shell,
 * or use it directly when you need a custom dialog.
 *
 * @example
 * ```html
 * <!-- Minimal usage inside a CDK dialog template -->
 * <bit-dialog-container dialogSize="large">
 *   <h2>Custom Content</h2>
 *   <p>Full control over the interior layout.</p>
 * </bit-dialog-container>
 * ```
 */
@Component({
  selector: "bit-dialog-container",
  template: `<section [class]="innerClasses()"><ng-content></ng-content></section>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [CdkTrapFocus],
  host: {
    "[class]": "classes()",
    "(keydown.esc)": "handleEsc($event)",
    "(animationend)": "onAnimationEnd()",
  },
})
export class DialogContainerComponent {
  private readonly drawerService = inject(DrawerService);
  protected readonly dialogRef = inject(DialogRef, { optional: true });

  constructor() {
    effect(() => {
      if (!this.dialogRef?.isDrawer) {
        return;
      }
      const size = this.dialogSize();
      const rootFontSizePx = getRootFontSizePx();
      this.drawerService.declarePushWidth((drawerSizeToWidthRem[size] ?? 32) * rootFontSizePx);
    });
  }

  /**
   * Dialog size, controls the max-width constraint.
   */
  readonly dialogSize = input<DialogSize>("default");

  /**
   * Disable animations for the dialog.
   */
  readonly disableAnimations = input(false, { transform: booleanAttribute });

  /**
   * Disable the default visual chrome (background, border, drop shadow, rounded corners).
   */
  readonly disableChrome = input(false, { transform: booleanAttribute });

  private readonly animationCompleted = signal(false);

  /** Max width class */
  protected readonly width = computed(() => {
    const size = this.dialogSize();

    if (this.dialogRef?.isDrawer) {
      return this.drawerService.isPushMode() ? drawerSizeToWidth[size] : "";
    }
    return dialogSizeToWidth[size];
  });

  protected readonly innerClasses = computed(() => {
    if (this.disableChrome()) {
      return ["tw-contents"];
    }

    const isDrawer = this.dialogRef?.isDrawer;
    const chrome = [
      "tw-self-center",
      "tw-w-full",
      "tw-overflow-hidden",
      "tw-border",
      "tw-border-solid",
      "tw-border-secondary-100",
      "tw-bg-background",
      "tw-text-main",
    ];
    const shapeClasses = isDrawer
      ? ["tw-h-full", "tw-border-t-0"]
      : ["tw-rounded-t-xl", "md:tw-rounded-xl", "tw-shadow-lg"];

    return [...chrome, ...shapeClasses];
  });

  protected readonly classes = computed(() => {
    const isDrawer = this.dialogRef?.isDrawer;
    const widthClass = isDrawer ? ["tw-w-full"] : ["md:tw-p-4", "tw-w-screen"];
    const baseClasses = ["tw-flex", ...widthClass];
    const sizeClasses = isDrawer ? ["tw-h-full"] : ["tw-max-h-[90vh]"];

    const size = this.dialogSize();
    const animationClasses =
      this.disableAnimations() || this.animationCompleted() || this.dialogRef?.isDrawer
        ? []
        : size === "small"
          ? ["tw-animate-slide-down"]
          : ["tw-animate-slide-up", "md:tw-animate-slide-down"];

    return [...baseClasses, this.width(), ...sizeClasses, ...animationClasses];
  });

  handleEsc(event: Event) {
    if (!this.dialogRef?.disableClose) {
      this.dialogRef?.close();
      event.stopPropagation();
    }
  }

  onAnimationEnd() {
    this.animationCompleted.set(true);
  }
}
