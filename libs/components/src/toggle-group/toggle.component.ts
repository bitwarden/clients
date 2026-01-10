import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";

import { BadgeComponent } from "../badge";

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
  protected readonly badgeElement = contentChild(BadgeComponent);
  protected readonly hasBadge = computed(() => !!this.badgeElement());

  protected readonly labelTitle = signal<string | null>(null);

  constructor() {
    // Set label title after view is initialized
    afterNextRender(() => {
      const labelText = this.labelContent()?.nativeElement.innerText;
      if (labelText) {
        this.labelTitle.set(labelText);
      }
    });
  }

  protected readonly name = this.groupComponent.name;
  readonly selected = computed(() => this.groupComponent.selected() === this.value());

  protected handleInputChange() {
    this.groupComponent.onInputInteraction(this.value());
  }

  protected readonly hostClasses = ["tw-group/toggle", "tw-flex", "tw-min-w-16"];

  protected readonly inputClasses = [
    "tw-peer/toggle-input",
    "tw-appearance-none",
    "tw-outline-none",
  ];

  protected readonly labelClasses = [
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
    "tw-border-primary-600",
    "!tw-text-primary-600",
    "tw-border-solid",
    "tw-border-y",
    "tw-border-r",
    "tw-border-l-0",
    "tw-cursor-pointer",
    "hover:tw-bg-hover-default",

    "group-first-of-type/toggle:tw-border-l",
    "group-first-of-type/toggle:tw-rounded-s-full",
    "group-last-of-type/toggle:tw-rounded-e-full",

    "peer-focus-visible/toggle-input:tw-outline-none",
    "peer-focus-visible/toggle-input:tw-ring",
    "peer-focus-visible/toggle-input:tw-ring-offset-2",
    "peer-focus-visible/toggle-input:tw-ring-primary-600",
    "peer-focus-visible/toggle-input:tw-z-10",
    "peer-focus-visible/toggle-input:tw-bg-primary-600",
    "peer-focus-visible/toggle-input:tw-border-primary-600",
    "peer-focus-visible/toggle-input:!tw-text-contrast",

    "peer-checked/toggle-input:tw-bg-primary-600",
    "peer-checked/toggle-input:tw-border-primary-600",
    "peer-checked/toggle-input:!tw-text-contrast",
    "tw-py-1.5",
    "tw-px-3",

    // Fix for bootstrap styles that add bottom margin
    "!tw-mb-0",
  ];
}
