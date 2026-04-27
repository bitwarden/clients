import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  contentChildren,
} from "@angular/core";

import { ToggleComponent } from "./toggle.component";

let nextId = 0;

@Component({
  selector: "bit-toggle-group",
  templateUrl: "./toggle-group.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: "radiogroup",
    "[class]": "classlist()",
    "[style.--count]": "toggles().length",
    "[style.--active]": "activeIndex()",
  },
})
export class ToggleGroupComponent<TValue = unknown> {
  private readonly id = nextId++;
  readonly name = `bit-toggle-group-${this.id}`;

  readonly toggles = contentChildren(ToggleComponent);

  readonly activeIndex = computed(() =>
    this.toggles().findIndex((t) => t.value() === this.selected()),
  );

  /**
   * Whether the toggle group should take up the full width of its container.
   * When true, each toggle button will be equally sized to fill the available space.
   */
  readonly fullWidth = input<boolean, unknown>(undefined, { transform: booleanAttribute });

  /**
   * The selected value in the toggle group.
   */
  readonly selected = model<TValue>();

  protected readonly classlist = computed(() => [
    "tw-inline-grid",
    "tw-gap-1",
    "tw-auto-cols-fr",
    "tw-grid-flow-col",
    "tw-border",
    "tw-rounded-2xl",
    "tw-border-border-base",
    "tw-p-1",
    "tw-relative",
    "after:tw-content-['']",
    "after:tw-rounded-xl",
    "after:tw-pointer-events-none",
    "after:tw-absolute",
    "after:tw-top-1",
    "after:tw-left-1",
    "after:tw-h-[calc(100%_-_theme(spacing.2))]",
    // Width accounts for left+right padding AND (count-1) grid gaps (tw-gap-1 = spacing.1 each).
    // Total to subtract = (count+1)*spacing.1, written as count*spacing.1 + spacing.1.
    "after:tw-w-[calc((100%_-_var(--count)*theme(spacing.1)_-_theme(spacing.1))/var(--count,1))]",
    // Translate by (slot-width + one gap) per step: 100% = pill's own width, + spacing.1 = gap.
    "after:tw-translate-x-[calc(var(--active,0)*(100%_+_theme(spacing.1)))]",
    "after:tw-transition-transform",
    "after:tw-duration-[225ms]",
    "after:tw-rounded-xl",
    "after:tw-bg-bg-brand-stronger",
    ...(this.fullWidth() ? ["tw-grid", "tw-w-full", "[&>*]:tw-flex-1"] : []),
  ]);

  onInputInteraction(value: TValue) {
    this.selected.set(value);
  }
}
