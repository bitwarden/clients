import { ChangeDetectionStrategy, Component } from "@angular/core";

import { SearchBarComponent } from "./components/search-bar.component";

@Component({
  selector: "magnify-root",
  standalone: true,
  imports: [SearchBarComponent],
  template: `<search-bar />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  constructor() {}
}
