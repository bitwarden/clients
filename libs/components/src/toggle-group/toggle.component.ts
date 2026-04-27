import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";

import { BerryComponent } from "../berry";

import { ToggleGroupComponent } from "./toggle-group.component";

let nextId = 0;

@Component({
  selector: "bit-toggle",
  templateUrl: "./toggle.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    tabindex: "-1",
    "[class]": "hostClasses",
  },
})
export class ToggleComponent<TValue> {
  protected readonly id = "bit-toggle-" + nextId++;

  private readonly groupComponent = inject(ToggleGroupComponent<TValue>);

  readonly value = input.required<TValue>();
  protected readonly labelContent = viewChild<ElementRef<HTMLSpanElement>>("labelContent");
  private readonly berryComponent = contentChild(BerryComponent);
  protected readonly hasBerry = computed(() => !!this.berryComponent());

  protected readonly labelTitle = signal<string | null>(null);

  constructor() {
    // Set label title after view is initialized
    afterNextRender(() => {
      const labelText = this.labelContent()?.nativeElement.innerText;
      if (labelText) {
        this.labelTitle.set(labelText);
      }
    });

    effect(() => {
      const berryVariant = this.selected() ? "contrast" : "primary";
      this.berryComponent()?.variant.set(berryVariant);
    });
  }

  protected readonly name = this.groupComponent.name;
  readonly selected = computed(() => this.groupComponent.selected() === this.value());

  protected handleInputChange() {
    this.groupComponent.onInputInteraction(this.value());
  }

  protected readonly hostClasses = ["tw-group/toggle", "tw-flex", "tw-min-w-16", "tw-relative"];

  protected readonly inputClasses = [
    "tw-peer/toggle-input",
    "tw-appearance-none",
    "tw-outline-none",
  ];

  protected readonly labelClasses = [
    "tw-relative",
    "tw-h-full",
    "tw-w-full",
    "tw-flex",
    "tw-items-center",
    "tw-justify-center",
    "tw-gap-1.5",
    "!tw-font-medium",
    "tw-leading-5",
    "tw-transition",
    "tw-text-center",
    "tw-text-sm",
    "tw-rounded-xl",
    "tw-z-[2]",
    "tw-transition",
    "tw-duration-[350ms]",
    // "tw-border-primary-600",
    "!tw-text-fg-body",
    // "tw-border-solid",
    // "tw-border-y",
    // "tw-border-r",
    // "tw-border-l-0",
    "tw-cursor-pointer",
    "hover:tw-bg-bg-hover",

    "after:tw-content-['']",
    "after:tw-w-px",
    "after:tw-h-[calc(100%_-_theme(spacing.2))]",
    "after:tw-absolute",
    "after:tw-right-[-2px]",
    "after:tw-top-[50%]",
    "after:tw-translate-x-[100%]",
    "after:tw-translate-y-[-50%]",
    "after:tw-border-r",
    "after:tw-border-border-base",

    "&:last-of-type:after:tw-opacity-0",

    // "group-first-of-type/toggle:tw-border-l",
    // "group-first-of-type/toggle:tw-rounded-s-full",
    // "group-last-of-type/toggle:tw-rounded-e-full",

    "peer-focus-visible/toggle-input:tw-outline-none",
    "peer-focus-visible/toggle-input:tw-ring",
    "peer-focus-visible/toggle-input:tw-ring-offset-1",
    "peer-focus-visible/toggle-input:tw-ring-border-focus",
    "peer-focus-visible/toggle-input:tw-z-10",
    "peer-focus-visible/toggle-input:tw-bg-bg-hover",
    // "peer-focus-visible/toggle-input:tw-border-primary-600",
    // "peer-focus-visible/toggle-input:tw-text-fg-body",

    // "peer-checked/toggle-input:tw-bg-bg-brand-stronger",
    // "peer-checked/toggle-input:tw-border-primary-600",
    "peer-checked/toggle-input:!tw-text-fg-contrast",
    "peer-checked/toggle-input:after:tw-opacity-[0]",
    "tw-py-1.5",
    "tw-px-3",

    // Fix for bootstrap styles that add bottom margin
    "!tw-mb-0",
  ];
}
