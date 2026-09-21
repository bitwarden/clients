import { A11yModule } from "@angular/cdk/a11y";
import { ChangeDetectionStrategy, Component, input } from "@angular/core";

/**
 * Internal base component for shared popover container and styles
 */
@Component({
  selector: "bit-popover-base",
  imports: [A11yModule],
  templateUrl: "./popover-base.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PopoverBaseComponent {
  /**
   * Screen-reader-accessible name for the popover dialog.
   */
  readonly accessibleName = input.required<string>();
}
