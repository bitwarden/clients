import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
} from "@angular/core";

import { IconComponent } from "../icon";
import { IconTileComponent } from "../icon-tile";
import { BitwardenIcon } from "../shared/icon";

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
  readonly heading = input.required<string>();
  readonly subtitle = input<string>();
  readonly open = model<boolean>(false);
  readonly startIcon = input<BitwardenIcon>();
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly size = input<AccordionSize>("default");
  readonly variant = input<AccordionVariant>("default");

  readonly contentId = `bit-accordion-content-${nextId++}`;

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
      // Collapse inner radii and borders when stacked as siblings
      "[&:not(:first-of-type)]:tw-rounded-t-none",
      "[&:not(:last-of-type)]:tw-rounded-b-none",
      "[&:not(:last-of-type)]:tw-border-b-0",
      // Mirror those overrides onto the child button and content panel
      "[&:not(:first-of-type)>[data-accordion-trigger]]:tw-rounded-t-none",
      "[&:not(:last-of-type)>[data-accordion-trigger]]:tw-rounded-b-none",
      "[&:not(:last-of-type)>[data-accordion-content]]:tw-rounded-b-none",
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
      "tw-transition-colors",
      "tw-rounded-t-xl",
      this.open() ? "" : "tw-rounded-b-xl",
      this.variant() === "default" ? "tw-bg-bg-secondary" : "tw-bg-bg-primary",
      "enabled:hover:tw-bg-bg-hover",
      "focus-visible:tw-outline-none",
      "focus-visible:tw-ring-2",
      "focus-visible:tw-ring-offset-1",
      "focus-visible:tw-ring-border-focus",
      "disabled:tw-cursor-not-allowed",
      "disabled:tw-opacity-60",
      ...this.triggerSizeClasses(),
    ].join(" "),
  );

  private readonly triggerSizeClasses = computed((): string[] => {
    if (this.size() === "sm") {
      return ["tw-p-3"];
    }
    return ["tw-p-4"];
  });

  protected readonly iconTileSize = computed(() => (this.size() === "sm" ? "base" : "lg"));

  protected readonly headingClassList = computed(() =>
    [
      "tw-font-medium",
      "tw-text-fg-heading",
      "tw-leading-6",
      this.size() === "sm" ? "tw-text-base" : "tw-text-lg",
    ].join(" "),
  );

  protected readonly subtitleClassList = "tw-text-sm/5 tw-text-fg-body";

  protected readonly contentClassList = computed(() =>
    [
      "tw-p-4",
      "tw-rounded-b-xl",
      this.variant() === "subtle" ? "tw-border-t tw-border-solid tw-border-border-base" : "",
    ].join(" "),
  );
}
