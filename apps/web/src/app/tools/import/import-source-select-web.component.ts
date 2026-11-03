import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

import { UpgradeImportType } from "@bitwarden/importer-core";
import { ImportSourceSelectComponent, importSourceFromQuery } from "@bitwarden/importer-ui";

import { ImportRouteContext } from "./import-route-context";

@Component({
  templateUrl: "import-source-select-web.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImportSourceSelectComponent],
})
export class ImportSourceSelectWebComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly routeContext = inject(ImportRouteContext);
  private readonly basePath = this.routeContext.basePath(
    this.routeContext.organizationId(this.route),
  );

  protected readonly initialSource = importSourceFromQuery(this.route);

  protected onContinue(importType: UpgradeImportType): void {
    void this.routeContext.navigate(this.route, [...this.basePath, importType]);
  }
}
