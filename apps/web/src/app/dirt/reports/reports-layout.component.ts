import { Component } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router } from "@angular/router";
import { filter } from "rxjs/operators";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-reports-layout",
  templateUrl: "reports-layout.component.html",
  standalone: false,
})
export class ReportsLayoutComponent {
  homepage = true;

  constructor(router: Router) {
    const reportsHomeRoute = "/reports";

    this.homepage = router.url === reportsHomeRoute;
    router.events
      .pipe(
        takeUntilDestroyed(),
        filter((event) => event instanceof NavigationEnd),
      )
      .subscribe((event) => {
        this.homepage = (event as NavigationEnd).url == reportsHomeRoute;
      });
  }
}
