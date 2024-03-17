import { Component, HostBinding, Input } from "@angular/core";

import { ToggleGroupComponent } from "./toggle-group.component";

let nextId = 0;

@Component({
  selector: "bit-toggle",
  templateUrl: "./toggle.component.html",
  preserveWhitespaces: false,
})
export class ToggleComponent<TValue> {
  id = nextId++;

  @Input() value?: TValue;

  constructor(private groupComponent: ToggleGroupComponent<TValue>) {}

  @HostBinding("tabIndex") tabIndex = "-1";
  @HostBinding("class") classList = ["tw-group"];

  get name() {
    return this.groupComponent.name;
  }

  get selected() {
    return this.groupComponent.selected === this.value;
  }

  get inputClasses() {
    return ["tw-peer", "tw-appearance-none", "tw-outline-none"];
  }

  get labelClasses() {
    return [
      "!tw-font-semibold",
      "tw-transition",
      "tw-text-center",
      "tw-border-text-muted",
      "!tw-text-muted",
      "tw-border-solid",
      "tw-border-y",
      "tw-border-r",
      "tw-border-l-0",
      "tw-cursor-pointer",
      "group-first-of-type:tw-border-l",
      "group-first-of-type:tw-rounded-l",
      "group-last-of-type:tw-rounded-r",

      "peer-focus:tw-outline-none",
      "peer-focus:tw-ring",
      "peer-focus:tw-ring-offset-2",
      "peer-focus:tw-ring-primary-500",
      "peer-focus:tw-z-10",
      "peer-focus:tw-bg-primary-500",
      "peer-focus:tw-border-primary-500",
      "peer-focus:!tw-text-contrast",

      "hover:tw-no-underline",
      "hover:tw-bg-text-muted",
      "hover:tw-border-text-muted",
      "hover:!tw-text-contrast",

      "peer-checked:tw-bg-primary-500",
      "peer-checked:tw-border-primary-500",
      "peer-checked:!tw-text-contrast",
      "tw-py-1.5",
      "tw-px-3",

      // Fix for bootstrap styles that add bottom margin
      "!tw-mb-0",

      // Fix for badge being slightly off center vertically
      "[&>[bitBadge]]:tw-mt-px",
    ];
  }

  onInputInteraction() {
    this.groupComponent.onInputInteraction(this.value);
  }
}
