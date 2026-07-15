import { Directive, ElementRef, HostBinding, Input, Renderer2 } from "@angular/core";

import { ProductTierType } from "@bitwarden/common/billing/enums";
import { BitwardenIcon } from "@bitwarden/components";

export type OrgIconSize = "default" | "small" | "large";

/**
 * Maps an organization's product tier to its corresponding Bitwarden icon.
 * Returns an empty string for unrecognized tiers.
 */
export function getOrgIcon(tierType: ProductTierType): BitwardenIcon | "" {
  switch (tierType) {
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

  get orgIcon(): BitwardenIcon | "" {
    return getOrgIcon(this.tierType);
  }

  @HostBinding("class") get classList() {
    return ["bwi", this.iconSize, this.orgIcon];
  }
}
