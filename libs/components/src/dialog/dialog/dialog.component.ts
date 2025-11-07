import { CdkTrapFocus } from "@angular/cdk/a11y";
import { CdkScrollable } from "@angular/cdk/scrolling";
import { CommonModule } from "@angular/common";
import {
  Component,
  HostBinding,
  inject,
  viewChild,
  input,
  booleanAttribute,
  ElementRef,
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
import { dialogAnimation } from "../animations";
import { DialogRef } from "../dialog.service";
import { DialogCloseDirective } from "../directives/dialog-close.directive";
import { DialogTitleContainerDirective } from "../directives/dialog-title-container.directive";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-dialog",
  templateUrl: "./dialog.component.html",
  animations: [dialogAnimation],
  host: {
    "(keydown.esc)": "handleEsc($event)",
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
  private readonly scrollableBody = viewChild.required(CdkScrollable);
  private readonly scrollBottom = viewChild.required<ElementRef<HTMLDivElement>>("scrollBottom");

  protected dialogRef = inject(DialogRef, { optional: true });
  protected bodyHasScrolledFrom = hasScrolledFrom(this.scrollableBody);
  protected readonly animationDone = signal(false);

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
   * Mark the dialog as loading which replaces the content with a spinner.
   */
  readonly loading = input(false);

  @HostBinding("class") get classes() {
    // `tw-max-h-[90vh]` is needed to prevent dialogs from overlapping the desktop header
    return ["tw-flex", "tw-flex-col", "tw-w-screen"]
      .concat(
        this.width,
        this.dialogRef?.isDrawer
          ? ["tw-min-h-screen", "md:tw-w-[23rem]"]
          : ["tw-p-4", "tw-w-screen", "tw-max-h-[90vh]"],
      )
      .flat();
  }

  handleEsc(event: Event) {
    if (!this.dialogRef?.disableClose) {
      this.dialogRef?.close();
      event.stopPropagation();
    }
  }

  onAnimationDone() {
    this.animationDone.set(true);
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
}
