import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  untracked,
} from "@angular/core";

import { IconComponent } from "../icon";
import { IconTileComponent } from "../icon-tile";
import { BitwardenIcon } from "../shared/icon";

import { AccordionGroupComponent } from "./accordion-group.component";

export type AccordionSize = "sm" | "default";

export type AccordionVariant = "default" | "subtle";

let nextId = 0;

@Component({
  selector: "bit-accordion",
  templateUrl: "./accordion.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, IconTileComponent],
  host: {
    "[class]": "hostClassList()",
  },
})
export class AccordionComponent {
  private readonly group = inject(AccordionGroupComponent, { optional: true });

  constructor() {
    effect(() => {
      if (this.open()) {
        this.group?.notifyOpened(this._baseId);
      }
    });

    effect(() => {
      const activeId = this.group?.activeAccordionId();
      if (activeId != null && activeId !== this._baseId) {
        untracked(() => this.open.set(false));
      }
    });
  }

  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly open = model<boolean>(false);
  readonly startIcon = input<BitwardenIcon>();
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly size = input<AccordionSize>("default");
  readonly variant = input<AccordionVariant>("default");

  protected readonly resolvedVariant = computed(() => this.group?.variant() ?? this.variant());

  protected readonly _baseId = `bit-accordion-${nextId++}`;
  readonly triggerId = `${this._baseId}-trigger`;
  readonly contentId = `${this._baseId}-content`;

  protected toggle() {
    if (!this.disabled()) {
      this.open.update((o) => !o);
    }
  }

  protected readonly hostClassList = computed(() =>
    [
      "tw-block",
      "tw-border",
      "tw-border-solid",
      "tw-border-border-base",
      "tw-rounded-xl",
      ...(this.group
        ? [
            // Collapse inner radii and borders when stacked inside a group
            "[&:not(:first-of-type)]:tw-rounded-t-none",
            "[&:not(:last-of-type)]:tw-rounded-b-none",
            "[&:not(:last-of-type)]:tw-border-b-0",
            // Mirror those overrides onto the child button and content panel
            "[&:not(:first-of-type)>[data-accordion-trigger]]:tw-rounded-t-none",
            "[&:not(:last-of-type)>[data-accordion-trigger]]:tw-rounded-b-none",
            "[&:not(:last-of-type)>[data-accordion-content]]:tw-rounded-b-none",
          ]
        : []),
    ].join(" "),
  );

  protected readonly triggerClassList = computed(() =>
    [
      "tw-flex",
      "tw-items-center",
      "tw-gap-3",
      "tw-w-full",
      "tw-border-0",
      "tw-text-start",
      "tw-cursor-pointer",
      "[transition:background-color_150ms_ease]",
      "tw-rounded-t-xl",
      this.open() ? "" : "tw-rounded-b-xl",
      this.resolvedVariant() === "default" ? "tw-bg-bg-secondary" : "tw-bg-bg-primary",
      "enabled:hover:tw-bg-bg-hover",
      "focus-visible:tw-outline-none",
      "focus-visible:tw-ring-2",
      "focus-visible:tw-ring-inset",
      "focus-visible:tw-ring-border-focus",
      "focus-visible:tw-border-border-focus",
      "disabled:tw-cursor-not-allowed",
      "disabled:tw-text-fg-inactive",
      this.size() === "sm" ? "tw-p-3" : "tw-p-4",
    ].join(" "),
  );

  protected readonly iconTileSize = computed(() => (this.size() === "sm" ? "base" : "lg"));

  protected readonly headingClassList = computed(() =>
    [
      "tw-font-medium",
      "tw-leading-6",
      this.size() === "sm" ? "tw-text-base" : "tw-text-lg",
      this.disabled() ? "tw-text-fg-inactive" : "tw-text-fg-heading",
    ].join(" "),
  );

  protected readonly subtitleClassList = computed(() =>
    ["tw-text-sm/5", this.disabled() ? "tw-text-fg-inactive" : "tw-text-fg-body"].join(" "),
  );

  protected readonly chevronClasses = computed(() =>
    [
      "tw-text-xl",
      "tw-shrink-0",
      this.disabled() ? "tw-text-fg-inactive" : "tw-text-fg-heading",
    ].join(" "),
  );

  protected readonly contentClassList = computed(() =>
    [
      "tw-grid",
      "tw-rounded-b-xl",
      "tw-overflow-hidden",
      "tw-transition-[grid-template-rows,padding] tw-duration-150",
      this.resolvedVariant() === "subtle" && this.open()
        ? "tw-border-t tw-border-solid tw-border-border-base"
        : "",
      this.open() ? "tw-grid-rows-[1fr] tw-py-4" : "tw-grid-rows-[0fr] tw-py-0",
    ].join(" "),
  );
}
