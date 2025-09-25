import { Component, OnInit } from "@angular/core";

import { AppComponent as BaseAppComponent } from "@bitwarden/browser/popup/app.component";

@Component({
  selector: "app-root",
  templateUrl: "../../../../apps/browser/src/popup/app.component.html",
  standalone: false,
})
export class AppComponent extends BaseAppComponent implements OnInit {
  ngOnInit() {
    return super.ngOnInit();
  }
}
