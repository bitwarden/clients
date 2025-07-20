// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { NgClass } from "@angular/common";
import {
  AfterContentChecked,
  AfterViewInit,
  Component,
  ElementRef,
  HostBinding,
  signal,
  ViewChild,
  input,
} from "@angular/core";

import { ToggleGroupComponent } from "./toggle-group.component";

let nextId = 0;

@Component({
  selector: "bit-toggle",
  templateUrl: "./toggle.component.html",
  imports: [NgClass],
})
export class ToggleComponent<TValue> implements AfterContentChecked, AfterViewInit {
  id = nextId++;

  readonly value = input<TValue>();
  @ViewChild("labelContent") labelContent: ElementRef<HTMLSpanElement>;
  @ViewChild("bitBadgeContainer") bitBadgeContainer: ElementRef<HTMLSpanElement>;

  constructor(private groupComponent: ToggleGroupComponent<TValue>) {}

  @HostBinding("tabIndex") tabIndex = "-1";
  @HostBinding("class") classList = ["tw-group/toggle", "tw-flex", "tw-min-w-16"];

  protected bitBadgeContainerHasChidlren = signal(false);
  protected labelTitle = signal<string>(null);

  get name() {
    return this.groupComponent.name;
  }

  get selected() {
    return this.groupComponent.selected() === this.value();
  }

  get inputClasses() {
    return ["tw-peer/toggle-input", "tw-appearance-none", "tw-outline-none"];
  }

  get labelClasses() {
    return [
      "tw-h-full",
      "tw-w-full",
      "tw-flex",
      "tw-items-center",
      "tw-justify-center",
      "tw-gap-1.5",
      "!tw-font-semibold",
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

  onInputInteraction() {
    this.groupComponent.onInputInteraction(this.value());
  }

  ngAfterContentChecked() {
    this.bitBadgeContainerHasChidlren.set(
      this.bitBadgeContainer?.nativeElement.childElementCount > 0,
    );
  }

  ngAfterViewInit() {
    const labelText = this.labelContent?.nativeElement.innerText;
    if (labelText) {
      this.labelTitle.set(labelText);
    }
  }
}
