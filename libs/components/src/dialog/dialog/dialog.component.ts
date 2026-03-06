import { CdkTrapFocus } from "@angular/cdk/a11y";
import { CdkScrollable } from "@angular/cdk/scrolling";
import { CommonModule } from "@angular/common";
import {
  Component,
  effect,
  inject,
  viewChild,
  input,
  booleanAttribute,
  ElementRef,
  DestroyRef,
  computed,
  signal,
  AfterViewInit,
  NgZone,
} from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { combineLatest, firstValueFrom, switchMap } from "rxjs";

import { I18nPipe } from "@bitwarden/ui-common";

import { BitIconButtonComponent } from "../../icon-button/icon-button.component";
import { queryForAutofocusDescendents } from "../../input";
import { getRootFontSizePx } from "../../shared";
import { SpinnerComponent } from "../../spinner";
import { TypographyDirective } from "../../typography/typography.directive";
import { hasScrollableContent$ } from "../../utils/";
import { hasScrolledFrom } from "../../utils/has-scrolled-from";
import { DialogRef } from "../dialog.service";
import { DialogCloseDirective } from "../directives/dialog-close.directive";
import { DialogTitleContainerDirective } from "../directives/dialog-title-container.directive";
import { DrawerService } from "../drawer.service";

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

/** Width in rem for each drawer size, used to declare push-mode column widths. */
export const drawerSizeToWidthRem: Record<string, number> = {
  small: 24,
  default: 32,
  large: 42,
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-dialog, [bit-dialog]",
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
  private readonly ngZone = inject(NgZone);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly drawerService = inject(DrawerService);

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

  /** Max width class */
  protected readonly width = computed(() => {
    const size = this.dialogSize();

    if (this.dialogRef?.isDrawer) {
      return this.drawerService.isPushMode() ? drawerSizeToWidth[size] : "";
    }
    return dialogSizeToWidth[size];
  });

  protected readonly classes = computed(() => {
    const isDrawer = this.dialogRef?.isDrawer;
    // Drawers use tw-w-full (100% of column) so the element fills its grid track
    // without overflowing — the column itself is capped by the grid template.
    // Regular dialogs use tw-w-screen for full-width mobile presentation.
    const widthClass = isDrawer ? "tw-w-full" : "tw-w-screen";
    const baseClasses = ["tw-flex", "tw-flex-col", widthClass];
    const sizeClasses = isDrawer
      ? ["tw-h-full"]
      : [
          "md:tw-p-4",
          "tw-max-h-[90vh]", // needed to prevent dialogs from overlapping the desktop header
        ];

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

  async ngAfterViewInit() {
    /**
     * Wait for the zone to stabilize before performing any focus behaviors. This ensures that all
     * child elements are rendered and stable.
     */
    if (this.ngZone.isStable) {
      this.handleAutofocus();
    } else {
      await firstValueFrom(this.ngZone.onStable);
      this.handleAutofocus();
    }
  }

  /**
   * Ensure that the user's focus is in the dialog by autofocusing the appropriate element.
   *
   * If there is a descendant of the dialog with the AutofocusDirective applied, we defer to that.
   * If not, we want to fallback to a default behavior of focusing the dialog's header element. We
   * choose the dialog header as the default fallback for dialog focus because it is always present,
   * unlike possible interactive elements.
   */
  handleAutofocus() {
    /**
     * Angular's contentChildren query cannot see into the internal templates of child components.
     * We need to use a regular DOM query instead to see if there are descendants using the
     * AutofocusDirective.
     */
    const dialogRef = this.el.nativeElement;
    const autofocusDescendants = queryForAutofocusDescendents(dialogRef);
    const hasAutofocusDescendants = autofocusDescendants.length > 0;

    if (!hasAutofocusDescendants) {
      /**
       * Wait a tick for any focus management to occur on the trigger element before moving focus
       * to the dialog header.
       *
       * We are doing this manually instead of using Angular's built-in focus management
       * directives (`cdkTrapFocusAutoCapture` and `cdkFocusInitial`) because we need this delay
       * behavior.
       *
       * And yes, we need the timeout even though we are already waiting for ngZone to stabilize.
       */
      const headerFocusTimeout = setTimeout(() => {
        this.dialogHeader().nativeElement.focus();
      }, 0);

      this.destroyRef.onDestroy(() => clearTimeout(headerFocusTimeout));
    }
  }
}
