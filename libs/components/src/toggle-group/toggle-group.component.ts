import {
  afterRenderEffect,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  DestroyRef,
  ElementRef,
  inject,
  input,
  model,
  signal,
  untracked,
} from "@angular/core";

import { Option } from "../select/option";

import { ToggleDropdownComponent } from "./toggle-dropdown.component";
import { ToggleComponent } from "./toggle.component";

let nextId = 0;

@Component({
  selector: "bit-toggle-group",
  templateUrl: "./toggle-group.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToggleDropdownComponent],
  host: {
    "[attr.role]": "displayMode() === 'dropdown' ? null : 'radiogroup'",
    "[attr.aria-label]": "displayMode() === 'dropdown' ? null : label()",
    "[class]": "classlist()",
    "[style.--count]": "toggles().length",
    "[style.--active]": "activeIndex()",
  },
})
export class ToggleGroupComponent<TValue = unknown> {
  private readonly id = nextId++;
  readonly name = `bit-toggle-group-${this.id}`;

  private readonly el = inject(ElementRef<HTMLElement>);

  readonly toggles = contentChildren(ToggleComponent);

  readonly activeIndex = computed(() =>
    this.toggles().findIndex((t) => t.value() === this.selected()),
  );

  /**
   * Whether the toggle group should take up the full width of its container.
   * When true, each toggle button will be equally sized to fill the available space.
   */
  readonly fullWidth = input(undefined, { transform: booleanAttribute });

  /**
   * When true, the toggle group stays inline-grid at all breakpoints and never expands to full width.
   */
  readonly inline = input(undefined, { transform: booleanAttribute });

  /**
   * Accessible name for the toggle group. Rendered as `aria-label` on the host
   * while in radiogroup mode, and forwarded to the dropdown's inner combobox
   * (via a screen-reader-only `<label for>`) when the responsive variant fires.
   */
  readonly label = input<string>();

  /**
   * The selected value in the toggle group.
   *
   * Use `[(selected)]` for two-way binding, or `[selected]` + `(selectedChange)`
   * to listen one-way. The `selectedChange` event fires identically in all
   * display modes (inline, full-width, and the responsive dropdown), so
   * consumers do not need to branch on the rendered mode.
   */
  readonly selected = model.required<TValue>();

  readonly displayMode = signal<"inline" | "full-width" | "dropdown">("inline");
  readonly toggleOptions = signal<Option<TValue>[]>([]);

  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    const el = this.el.nativeElement;
    // Mutable so the ResizeObserver always reads the latest value, and the
    // afterRenderEffect below can refresh it when projected toggles change.
    let naturalWidth = 0;
    let observerStarted = false;

    afterRenderEffect(() => {
      // Re-run whenever the set of projected toggles changes — every real
      // consumer renders them via `@for option of (rootOptions$ | async)`, so
      // the children arrive after the first paint and need a fresh measurement.
      const togglesCount = this.toggles().length;

      // In dropdown mode the toggles are not projected (the template's @if
      // swaps <ng-content> out for <bit-toggle-dropdown>), so measuring would
      // capture the dropdown's width instead. Skip and keep the prior value.
      if (togglesCount === 0 || untracked(this.displayMode) === "dropdown") {
        return;
      }

      // Measure the unconstrained natural width of the toggle group by forcing it to
      // size to its content, temporarily overriding any max-width that may be set on
      // the host. Math.floor normalizes sub-pixel float differences between
      // getBoundingClientRect and ResizeObserver's borderBoxSize (which can diverge by
      // a fraction of a pixel inside transformed/padded containers like cards), preventing
      // an inline↔dropdown oscillation loop.
      el.style.width = "max-content";
      el.style.maxWidth = "none";
      naturalWidth = Math.floor(el.getBoundingClientRect().width);
      el.style.maxWidth = "";
      el.style.width = "";

      // Handle the case where the component renders into a container that is already
      // too narrow — ResizeObserver won't fire for the initial size if it doesn't change.
      if (Math.floor(el.getBoundingClientRect().width) < naturalWidth) {
        this.toggleOptions.set(this.buildToggleOptions());
        this.displayMode.set("dropdown");
      } else if (this.fullWidth()) {
        this.displayMode.set("full-width");
      }

      if (observerStarted) {
        return;
      }
      observerStarted = true;

      const observer = new ResizeObserver((entries) => {
        const currentWidth = Math.floor(entries[0].borderBoxSize[0].inlineSize);
        const mode = this.displayMode();

        if (currentWidth < naturalWidth && (mode === "inline" || mode === "full-width")) {
          this.toggleOptions.set(this.buildToggleOptions());
          this.displayMode.set("dropdown");
          return;
        }

        if (currentWidth >= naturalWidth && mode === "dropdown") {
          this.toggleOptions.set([]);
          this.displayMode.set(this.fullWidth() ? "full-width" : "inline");
        }
      });

      observer.observe(el);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  protected readonly dropdownItems = computed<Option<TValue>[]>(() => {
    const selected = this.selected();
    return this.toggleOptions().map((option) => ({
      ...option,
      icon: option.value === selected ? "bwi-check" : undefined,
    }));
  });

  private buildToggleOptions(): Option<TValue>[] {
    return this.toggles().map((toggle) => ({
      value: toggle.value(),
      label: toggle.labelContent()?.nativeElement.innerText,
      count: toggle.berryComponent()?.content(),
    }));
  }

  protected readonly classlist = computed(() => {
    const mode = this.displayMode();

    if (mode === "dropdown") {
      return ["tw-block"];
    }

    const isFullWidth = mode === "full-width" || this.fullWidth();

    return [
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
      ...(isFullWidth
        ? ["tw-grid", "tw-w-full", "[&>*]:tw-flex-1"]
        : this.inline()
          ? ["tw-inline-grid"]
          : ["tw-grid", "md:tw-inline-grid"]),
    ];
  });

  onInputInteraction(value: TValue) {
    this.selected.set(value);
  }
}
