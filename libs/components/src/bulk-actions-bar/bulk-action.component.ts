import { FocusableOption } from "@angular/cdk/a11y";
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  signal,
} from "@angular/core";

import { IconComponent } from "../icon/icon.component";
import { BitwardenIcon } from "../shared/icon";

@Component({
  selector: "button[bitBulkAction], a[bitBulkAction]",
  templateUrl: "./bulk-action.component.html",
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class]": "actionClasses",
    "[attr.tabindex]": "tabIndex()",
  },
})
export class BulkActionComponent implements FocusableOption {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly icon = input.required<BitwardenIcon>();

  // Driven by the parent bar's FocusKeyManager to implement the toolbar
  // roving-tabindex pattern: only the active item is part of the document
  // tab order; the rest are reachable only via arrow keys.
  readonly tabIndex = signal(-1);

  focus(): void {
    // focusVisible is not yet in TypeScript's FocusOptions but is supported in all modern browsers
    this.elementRef.nativeElement.focus({ focusVisible: true } as FocusOptions & {
      focusVisible?: boolean;
    });
  }

  get disabled(): boolean {
    return (this.elementRef.nativeElement as HTMLButtonElement).disabled === true;
  }

  protected readonly actionClasses = [
    "tw-inline-flex",
    "tw-items-center",
    "tw-gap-2",
    "tw-px-3",
    "tw-py-2",
    "tw-text-sm",
    "!tw-text-fg-contrast",
    "!tw-no-underline",
    "tw-bg-transparent",
    "tw-border-none",
    "tw-cursor-pointer",
    "tw-rounded-lg",
    "hover:tw-bg-bg-hover-contrast",
    "focus-visible:tw-bg-bg-hover-contrast",
    "focus-visible:tw-outline-none",
    "focus-visible:tw-ring-2",
    "focus-visible:tw-ring-inset",
    "focus-visible:tw-ring-border-focus-contrast",
    "disabled:!tw-text-fg-inactive",
    "disabled:tw-cursor-default",
    "disabled:hover:tw-bg-transparent",
    "aria-disabled:!tw-text-fg-inactive",
    "aria-disabled:tw-cursor-default",
    "aria-disabled:hover:tw-bg-transparent",
  ];
}
