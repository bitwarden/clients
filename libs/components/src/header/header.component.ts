import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { TypographyDirective } from "../typography/typography.directive";

@Component({
  selector: "bit-header",
  templateUrl: "./header.component.html",
  imports: [TypographyDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  /**
   * The title of the page
   */
  readonly title = input.required<string>();

  /**
   * Icon to show before the title
   */
  readonly icon = input<string>();
}
