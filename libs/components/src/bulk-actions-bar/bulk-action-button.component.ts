import { FocusableOption } from "@angular/cdk/a11y";
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";

import { setA11yTitleAndAriaLabel } from "../a11y/set-a11y-title-and-aria-label";
import { IconComponent } from "../icon/icon.component";
import { BitwardenIcon } from "../shared/icon";
import { TooltipDirective } from "../tooltip/tooltip.directive";

/** @internal Used only by `BulkActionsBarComponent` to render its toolbar buttons. */
@Component({
  selector: "button[bitBulkActionButton], a[bitBulkActionButton]",
  templateUrl: "./bulk-action-button.component.html",
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [TooltipDirective],
  host: {
    "[class]": "actionClasses()",
    "[attr.tabindex]": "tabIndex()",
  },
})
export class BulkActionButtonComponent implements FocusableOption {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly tooltip = inject(TooltipDirective, { self: true });

  readonly icon = input.required<BitwardenIcon>();
  readonly compact = input(false);

  // Driven by the parent bar's FocusKeyManager to implement the toolbar
  // roving-tabindex pattern: only the active item is part of the document
  // tab order; the rest are reachable only via arrow keys.
  readonly tabIndex = signal(-1);

  private readonly label = viewChild<ElementRef<HTMLSpanElement>>("label");
  private readonly labelText = computed(
    () => this.label()?.nativeElement.textContent?.trim() ?? "",
  );

  constructor() {
    // Drive the host TooltipDirective's content from compact state. Empty
    // content is guarded inside the tooltip component template, so nothing
    // renders while compact is false.
    effect(() => {
      this.tooltip.tooltipContent.set(this.compact() ? this.labelText() : "");
    });

    effect(() => {
      const el = this.elementRef.nativeElement;
      if (this.compact() && this.labelText()) {
        setA11yTitleAndAriaLabel({ element: el, label: this.labelText() });
      } else {
        el.removeAttribute("aria-label");
      }
    });
  }

  focus(): void {
    // focusVisible is not yet in TypeScript's FocusOptions but is supported in all modern browsers
    this.elementRef.nativeElement.focus({ focusVisible: true } as FocusOptions & {
      focusVisible?: boolean;
    });
  }

  /**
   * Overrides the label's inline `display` so the parent bar can read the
   * full-label intrinsic width even while `compact()` is true. Without this,
   * a remeasurement while compact would capture the compact width (labels
   * are `tw-hidden` → `display: none`) and trap the bar in compact mode.
   * Call with `false` to clear the override and let `tw-hidden` re-apply.
   * @internal
   */
  forceLabelVisible(visible: boolean): void {
    const el = this.label()?.nativeElement;
    if (el) {
      el.style.display = visible ? "inline" : "";
    }
  }

  get disabled(): boolean {
    return (this.elementRef.nativeElement as HTMLButtonElement).disabled === true;
  }

  protected readonly actionClasses = computed(() => [
    "tw-inline-flex",
    "tw-items-center",
    "tw-gap-2",
    ...(this.compact() ? ["tw-p-2"] : ["tw-px-3", "tw-py-2"]),
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
  ]);
}
