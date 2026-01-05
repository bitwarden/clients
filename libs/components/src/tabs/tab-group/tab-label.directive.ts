import { Directive, TemplateRef } from "@angular/core";

/**
 * Used to identify template based tab labels (allows complex labels instead of just plaintext)
 *
 * @example
 * ```
 * <bit-tab>
 *   <ng-template bitTabLabel>
 *     <i class="bwi bwi-search"></i> Search
 *   </ng-template>
 *
 *   <p>Tab Content</p>
 * </bit-tab>
 * ```
 */
@Directive({
  selector: "[bitTabLabel]",
})
export class TabLabelDirective {
  constructor(public templateRef: TemplateRef<unknown>) {}
}
