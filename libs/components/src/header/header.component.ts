import { ChangeDetectionStrategy, Component, input } from "@angular/core";

@Component({
  selector: "bit-header",
  templateUrl: "./header.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
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
