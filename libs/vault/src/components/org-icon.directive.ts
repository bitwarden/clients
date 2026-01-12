import { Directive, ElementRef, HostBinding, Input, Renderer2 } from "@angular/core";

import { ProductTierType } from "@bitwarden/common/billing/enums";

export type OrgIconSize = "default" | "small" | "large";

@Directive({
  selector: "[appOrgIcon]",
})
export class OrgIconDirective {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ required: true }) tierType!: ProductTierType;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() size?: OrgIconSize = "default";

  constructor(
    private el: ElementRef,
    private renderer: Renderer2,
  ) {
    this.renderer.setAttribute(this.el.nativeElement, "aria-hidden", "true");
  }

  get iconSize(): "bwi-sm" | "bwi-lg" | "" {
    switch (this.size) {
      case "small":
        return "bwi-sm";
      case "large":
        return "bwi-lg";
      default:
        return "";
    }
  }

  get orgIcon(): string {
    switch (this.tierType) {
      case ProductTierType.Free:
      case ProductTierType.Families:
        return "bwi-family";
      case ProductTierType.Teams:
      case ProductTierType.Enterprise:
      case ProductTierType.TeamsStarter:
        return "bwi-business";
      default:
        return "";
    }
  }

  @HostBinding("class") get classList() {
    return ["bwi", this.iconSize, this.orgIcon];
  }
}
