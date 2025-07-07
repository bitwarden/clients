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
      "tw-border-secondary-300",
      "tw-border-solid",
      "hover:tw-bg-hover-default",
      "last:tw-border-0",
      this.alignmentClass,
    ];
  }
}
