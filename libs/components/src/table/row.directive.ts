import { Directive, HostBinding, Input } from "@angular/core";

@Directive({
  selector: "tr[bitRow]",
  standalone: true,
})
export class RowDirective {
  @Input() alignContent: "top" | "middle" | "bottom" | "baseline" = "middle";

  get alignmentClass(): string {
    switch (this.alignContent) {
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
      "hover:tw-bg-background-alt",
      "last:tw-border-0",
      this.alignmentClass,
    ];
  }
}
