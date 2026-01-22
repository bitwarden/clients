import { Component, OnInit } from "@angular/core";

import { IntegrationType } from "@bitwarden/common/enums/integration-type.enum";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { IntegrationGridComponent } from "../integration-grid/integration-grid.component";
import { FilterIntegrationsPipe } from "../integrations.pipe";
import { OrganizationIntegrationsState } from "../organization-integrations.state";
import { tap } from "rxjs/operators";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "single-sign-on",
  templateUrl: "single-sign-on.component.html",
  imports: [SharedModule, IntegrationGridComponent, FilterIntegrationsPipe],
})
export class SingleSignOnComponent implements OnInit {
  integrationsList$ = this.state.integrations$;
  IntegrationType = IntegrationType;

  constructor(private state: OrganizationIntegrationsState) {}

  ngOnInit() {
    // eslint-disable-next-line no-console
    this.integrationsList$
      .pipe(
        tap((integrations) =>
          console.log("[DEBUG] integrations in single-sign-on.component.ts =>", integrations),
        ),
      )
      .pipe(takeUntilDestroyed())
      .subscribe();
  }
}
