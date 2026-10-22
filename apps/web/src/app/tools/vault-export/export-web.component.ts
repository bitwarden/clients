import { Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { BreadcrumbsModule } from "@bitwarden/components";
import { ExportComponent } from "@bitwarden/vault-export-ui";

import { HeaderModule } from "../../layouts/header/header.module";
import { SharedModule } from "../../shared";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "export-web.component.html",
  imports: [BreadcrumbsModule, SharedModule, ExportComponent, HeaderModule],
})
export class ExportWebComponent {
  protected readonly showBreadcrumbs = toSignal(
    inject(ConfigService).getFeatureFlag$(FeatureFlag.VFO1Foundation),
    { initialValue: false },
  );

  protected loading = false;
  protected disabled = false;

  constructor(private router: Router) {}

  /**
   * Callback that is called after a successful export.
   */
  protected async onSuccessfulExport(organizationId: string): Promise<void> {}
}
