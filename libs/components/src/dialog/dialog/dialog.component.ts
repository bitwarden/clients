import { CdkTrapFocus } from "@angular/cdk/a11y";
import { CdkScrollable } from "@angular/cdk/scrolling";
import { CommonModule } from "@angular/common";
import {
  Component,
  inject,
  viewChild,
  input,
  booleanAttribute,
  ElementRef,
  DestroyRef,
  computed,
  signal,
} from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { combineLatest, switchMap } from "rxjs";

import { I18nPipe } from "@bitwarden/ui-common";

import { BitIconButtonComponent } from "../../icon-button/icon-button.component";
import { SpinnerComponent } from "../../spinner";
import { TypographyDirective } from "../../typography/typography.directive";
import { hasScrollableContent$ } from "../../utils/";
import { hasScrolledFrom } from "../../utils/has-scrolled-from";
import { DialogRef } from "../dialog.service";
import { DialogCloseDirective } from "../directives/dialog-close.directive";
import { DialogTitleContainerDirective } from "../directives/dialog-title-container.directive";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-dialog",
  templateUrl: "./dialog.component.html",
  host: {
    "[class]": "classes()",
    "(keydown.esc)": "handleEsc($event)",
    "(animationend)": "onAnimationEnd()",
  },
  imports: [
    CommonModule,
    DialogTitleContainerDirective,
    TypographyDirective,
    BitIconButtonComponent,
    DialogCloseDirective,
    I18nPipe,
    CdkTrapFocus,
    CdkScrollable,
    SpinnerComponent,
  ],
})
export class DialogComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly scrollableBody = viewChild.required(CdkScrollable);
  private readonly scrollBottom = viewChild.required<ElementRef<HTMLDivElement>>("scrollBottom");

  protected dialogRef = inject(DialogRef, { optional: true });
  protected bodyHasScrolledFrom = hasScrolledFrom(this.scrollableBody);

  private scrollableBody$ = toObservable(this.scrollableBody);
  private scrollBottom$ = toObservable(this.scrollBottom);

  protected isScrollable$ = combineLatest([this.scrollableBody$, this.scrollBottom$]).pipe(
    switchMap(([body, bottom]) =>
      hasScrollableContent$(body.getElementRef().nativeElement, bottom.nativeElement),
    ),
  );

  /** Background color */
  readonly background = input<"default" | "alt">("default");

  /**
   * Dialog size, more complex dialogs should use large, otherwise default is fine.
   */
  readonly dialogSize = input<"small" | "default" | "large">("default");

  /**
   * Title to show in the dialog's header
   */
  readonly title = input<string>();

  /**
   * Subtitle to show in the dialog's header
   */
  readonly subtitle = input<string>();

  /**
   * Disable the built-in padding on the dialog, for use with tabbed dialogs.
   */
  readonly disablePadding = input(false, { transform: booleanAttribute });

  /**
   * Disable animations for the dialog.
   */
  readonly disableAnimations = input(false, { transform: booleanAttribute });

  /**
   * Mark the dialog as loading which replaces the content with a spinner.
   */
  readonly loading = input(false);

  private readonly animationCompleted = signal(false);

  protected readonly classes = computed(() => {
    // `tw-max-h-[90vh]` is needed to prevent dialogs from overlapping the desktop header
    const baseClasses = ["tw-flex", "tw-flex-col", "tw-w-screen"];
    const sizeClasses = this.dialogRef?.isDrawer
      ? ["tw-min-h-screen", "md:tw-w-[23rem]"]
      : ["md:tw-p-4", "tw-w-screen", "tw-max-h-[90vh]"];

    const animationClasses =
      this.disableAnimations() || this.animationCompleted() || this.dialogRef?.isDrawer
        ? []
        : this.dialogSize() === "small"
          ? ["tw-animate-slide-down"]
          : ["tw-animate-slide-up", "md:tw-animate-slide-down"];

    return [...baseClasses, this.width, ...sizeClasses, ...animationClasses];
  });

  handleEsc(event: Event) {
    if (!this.dialogRef?.disableClose) {
      this.dialogRef?.close();
      event.stopPropagation();
    }
  }

  get width() {
    switch (this.dialogSize()) {
      case "small": {
        return "md:tw-max-w-sm";
      }
      case "large": {
        return "md:tw-max-w-3xl";
      }
      default: {
        return "md:tw-max-w-xl";
      }
    }
  }

  onAnimationEnd() {
    this.animationCompleted.set(true);
  }
}
