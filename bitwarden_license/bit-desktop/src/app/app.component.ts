import { Component } from "@angular/core";

import { BaseAppComponent } from "@bitwarden/desktop/app/base-app.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-root",
  styles: [],
  templateUrl: "../../../../apps/desktop/src/app/app.component.html",
  standalone: false,
})
export class AppComponent extends BaseAppComponent {}
