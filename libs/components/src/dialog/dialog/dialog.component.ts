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
  AfterViewInit,
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

type DialogSize = "small" | "default" | "large";

const dialogSizeToWidth = {
  small: "md:tw-max-w-sm",
  default: "md:tw-max-w-xl",
  large: "md:tw-max-w-3xl",
} as const;

const drawerSizeToWidth = {
  small: "md:tw-max-w-sm",
  default: "md:tw-max-w-lg",
  large: "md:tw-max-w-2xl",
} as const;

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
export class DialogComponent implements AfterViewInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogHeader =
    viewChild.required<ElementRef<HTMLHeadingElement>>("dialogHeader");
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
  readonly dialogSize = input<DialogSize>("default");

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

  protected readonly width = computed(() => {
    const size = this.dialogSize() ?? "default";
    const isDrawer = this.dialogRef?.isDrawer;

    if (isDrawer) {
      return drawerSizeToWidth[size];
    }

    return dialogSizeToWidth[size];
  });

  protected readonly classes = computed(() => {
    // `tw-max-h-[90vh]` is needed to prevent dialogs from overlapping the desktop header
    const baseClasses = ["tw-flex", "tw-flex-col", "tw-w-screen"];
    const sizeClasses = this.dialogRef?.isDrawer ? ["tw-h-full"] : ["md:tw-p-4", "tw-max-h-[90vh]"];

    const size = this.dialogSize() ?? "default";
    const animationClasses =
      this.disableAnimations() || this.animationCompleted() || this.dialogRef?.isDrawer
        ? []
        : size === "small"
          ? ["tw-animate-slide-down"]
          : ["tw-animate-slide-up", "md:tw-animate-slide-down"];

    return [...baseClasses, this.width(), ...sizeClasses, ...animationClasses];
  });

  ngAfterViewInit() {
    /**
     * Wait a tick for any focus management to occur on the trigger element before moving focus to
     * the dialog header. We choose the dialog header because it is always present, unlike possible
     * interactive elements.
     *
     * We are doing this manually instead of using `cdkTrapFocusAutoCapture` and `cdkFocusInitial`
     * because we need this delay behavior.
     */
    const headerFocusTimeout = setTimeout(() => {
      this.dialogHeader().nativeElement.focus();
    }, 0);

    this.destroyRef.onDestroy(() => clearTimeout(headerFocusTimeout));
  }

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
