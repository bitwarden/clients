import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import { BitwardenIcon } from "../shared/icon";

import { getLinkClasses, LinkType } from "./link.directive";

@Component({
  selector: "a[bitLink]",
  templateUrl: "./link.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  host: {
    "[class]": "classList()",
  },
})
export class LinkComponent {
  readonly linkType = input<LinkType>("primary");
  readonly startIcon = input<BitwardenIcon | undefined>(undefined);
  readonly endIcon = input<BitwardenIcon | undefined>(undefined);

  readonly classList = computed(() => {
    return getLinkClasses({ linkType: this.linkType(), verticalInset: "0.125rem" });
  });

  readonly startIconClasses = computed(() => {
    return ["bwi", this.startIcon()];
  });

  readonly endIconClasses = computed(() => {
    return ["bwi", this.endIcon()];
  });
}
