import { Component } from "@angular/core";

import { AppComponent as BaseAppComponent } from "@bitwarden/web-vault/app/app.component";

@Component({
  selector: "app-root",
  templateUrl: "../../../../apps/web/src/app/app.component.html",
  standalone: false,
})
export class AppComponent extends BaseAppComponent {}
