import {
  AfterViewInit,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  contentChild,
  contentChildren,
  Directive,
  ElementRef,
  inject,
  input,
  viewChild,
} from "@angular/core";

import { AutofocusFallbackDirective } from "../../a11y/autofocus-fallback.directive";
import { ButtonComponent } from "../../button";
import { IconComponent } from "../../icon";
import { TypographyDirective } from "../../typography/typography.directive";
import { fadeIn } from "../animations";
import { DialogTitleContainerDirective } from "../directives/dialog-title-container.directive";

@Directive({
  selector: "[bitDialogIcon]",
})
export class IconDirective {}

@Directive({
  selector: "[bitDialogFooter]",
})
export class DialogFooterDirective {
  readonly buttons = contentChildren<ButtonComponent, ElementRef<HTMLButtonElement>>(
    ButtonComponent,
    { read: ElementRef },
  );
}

@Component({
  selector: "bit-simple-dialog, [bit-simple-dialog]",
  templateUrl: "./simple-dialog.component.html",
  animations: [fadeIn],
  imports: [DialogTitleContainerDirective, TypographyDirective, IconComponent],
  hostDirectives: [{ directive: AutofocusFallbackDirective }],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimpleDialogComponent implements AfterViewInit {
  private readonly autofocusFallback = inject(AutofocusFallbackDirective, { host: true });

  private readonly dialogHeader =
    viewChild.required<ElementRef<HTMLHeadingElement>>("dialogHeader");

  private readonly footer = contentChild<DialogFooterDirective>(DialogFooterDirective);

  /**
   * Optional flag to hide the dialog's center icon. Defaults to false.
   */
  readonly hideIcon = input(false, { transform: booleanAttribute });

  ngAfterViewInit() {
    const footerButtons = this.footer()?.buttons() ?? [];

    /**
     * Ensure that the user's focus is in the dialog by setting an autofocus fallback element (i.e.
     * a fallback for when no other elements in the dialog are set to autofocus). Use the first
     * footer button. If none exist, use the header since it is always present.
     */
    this.autofocusFallback.bitAutofocusFallback.set(footerButtons[0] ?? this.dialogHeader());
  }
}
