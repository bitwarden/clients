import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { BottomNavigationButton, BottomNavigationComponent } from "@bitwarden/components";

@Component({
  selector: "popup-tab-navigation",
  templateUrl: "popup-tab-navigation.component.html",
  imports: [BottomNavigationComponent],
  host: {
    class: "tw-size-full tw-flex tw-flex-col",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PopupTabNavigationComponent {
  readonly navButtons = input<BottomNavigationButton[]>([]);
}
