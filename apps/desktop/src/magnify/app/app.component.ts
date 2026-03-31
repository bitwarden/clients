import { ChangeDetectionStrategy, Component } from "@angular/core";

import { UsernamePasswordSpotlightComponent } from "./spotlight-search/username-password/username-password-spotlight.component";

@Component({
  selector: "magnify-root",
  template: `<app-username-password-spotlight />`,
  standalone: true,
  imports: [UsernamePasswordSpotlightComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
})
export class AppComponent {}
