import { Component } from "@angular/core";

import { AppComponent as BaseAppComponent } from "@bitwarden/web-vault/app/app.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-root",
  templateUrl: "../../../../apps/web/src/app/app.component.html",
  standalone: false,
})
export class AppComponent extends BaseAppComponent {}
