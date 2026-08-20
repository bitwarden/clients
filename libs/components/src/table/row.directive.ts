import { Directive, HostBinding, input } from "@angular/core";

@Directive({
  selector: "tr[bitRow]",
})
export class RowDirective {
  readonly alignContent = input<"top" | "middle" | "bottom" | "baseline">("middle");

  get alignmentClass(): string {
    switch (this.alignContent()) {
      case "top":
        return "tw-align-top";
      case "middle":
        return "tw-align-middle";
      case "bottom":
        return "tw-align-bottom";
      default:
        return "tw-align-baseline";
    }
  }

  @HostBinding("class") get classList() {
    return [
      "tw-border-0",
      "tw-border-b",
      "tw-border-border-base",
      "tw-border-solid",
      "has-[input[type=checkbox]:hover]:tw-bg-bg-brand-softer",
      "has-[input[type=checkbox]:focus-visible]:tw-bg-bg-brand-softer",
      "has-[input[type=checkbox]:checked]:tw-bg-bg-brand-soft",
      "last:tw-border-0",
      "tw-transition-colors",
      this.alignmentClass,
    ];
  }
}
