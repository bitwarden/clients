import { FocusableOption } from "@angular/cdk/a11y";
import { Directive, ElementRef, computed, inject, input } from "@angular/core";

/** Shared classes for the label content span inside a tab list item. */
export const TAB_LABEL_CONTENT_CLASSES =
  "tw-flex tw-items-center tw-gap-1.5 tw-h-6 tw-rounded group-focus-visible/tab-list-item:tw-ring-2 group-focus-visible/tab-list-item:tw-ring-border-focus";

/**
 * Directive used for styling tab header items for both nav links (anchor tags)
 * and content tabs (button tags)
 */
@Directive({
  selector: "[bitTabListItem]",
  host: {
    "[attr.disabled]": "disabledInput() || null",
    "[class]": "classList()",
  },
})
export class TabListItemDirective implements FocusableOption {
  readonly active = input<boolean>();
  readonly disabledInput = input(false, { alias: "disabled" });

  // Satisfies FocusableOption interface from CDK (cannot change external interface)
  get disabled(): boolean {
    return this.disabledInput();
  }

  readonly elementRef = inject(ElementRef);

  focus() {
    this.elementRef.nativeElement.focus();
  }

  click() {
    this.elementRef.nativeElement.click();
  }

  protected readonly classList = computed(() =>
    this.baseClassList
      .concat(this.active() ? this.activeClassList : [])
      .concat(this.disabledInput() ? this.disabledClassList : [])
      .concat(this.textColorClassList()),
  );

  /**
   * Classes used for styling tab item text color.
   * Separate text color class list required to override bootstrap classes in Web.
   */
  protected readonly textColorClassList = computed(() => {
    if (this.disabledInput()) {
      return ["!tw-text-fg-inactive", "hover:!tw-text-fg-inactive"];
    }
    if (this.active()) {
      return ["!tw-text-fg-brand"];
    }
    return ["!tw-text-fg-body", "hover:!tw-text-fg-brand"];
  });

  readonly baseClassList: string[] = [
    "tw-block",
    "tw-relative",
    "tw-h-full",
    "tw-max-w-fit",
    "tw-whitespace-nowrap",
    "tw-pb-3",
    "tw-text-sm",
    "tw-font-medium",
    "tw-bg-transparent",
    "tw-outline-none",
    "tw-group/tab-list-item",
    "tw-transition",

    "after:tw-content-['']",
    "after:tw-w-full",
    "after:tw-h-[2px]",
    "after:tw-bg-bg-brand",
    "after:tw-absolute",
    "after:-tw-bottom-px",
    "after:tw-inset-x-0",
    "after:tw-transition-opacity",
    "after:tw-opacity-0",
  ];

  readonly disabledClassList: string[] = ["tw-cursor-default"];

  readonly activeClassList: string[] = ["tw-font-semibold", "after:tw-opacity-100"];
}
