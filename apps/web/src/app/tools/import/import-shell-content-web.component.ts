import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterOutlet } from "@angular/router";

import { CollectionAdminService, CollectionService } from "@bitwarden/admin-console/common";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { BreadcrumbsModule } from "@bitwarden/components";
import { ImportCollectionServiceAbstraction } from "@bitwarden/importer-core";
import { ImportShellProgressComponent, importShellProviders } from "@bitwarden/importer-ui";
import { I18nPipe, safeProvider } from "@bitwarden/ui-common";

import { HeaderModule } from "../../layouts/header/header.module";

import { ImportCollectionAdminService } from "./import-collection-admin.service";
import { ImportRouteContext } from "./import-route-context";

/** The page header, step progress and screens of one import. Built once per organization by
 *  `ImportShellWebComponent`, so the providers below, the organization they were built for and
 *  anything staged all belong to that one import. */
@Component({
  selector: "app-import-shell-content",
  templateUrl: "import-shell-content-web.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BreadcrumbsModule, HeaderModule, I18nPipe, ImportShellProgressComponent, RouterOutlet],
  // The same shell serves the personal import and an organization's from its admin console; the
  // route's organizationId picks which location step it gets.
  providers: [
    ...importShellProviders(CollectionService, {
      organizationCollections: ImportCollectionServiceAbstraction,
    }),
    safeProvider({
      provide: ImportCollectionServiceAbstraction,
      useClass: ImportCollectionAdminService,
      deps: [CollectionAdminService],
    }),
  ],
})
export class ImportShellContentWebComponent {
  private readonly organizationId = inject(ImportRouteContext).organizationId(
    inject(ActivatedRoute),
  );

  protected readonly showBreadcrumbs = toSignal(
    inject(ConfigService).getFeatureFlag$(FeatureFlag.VFO1Foundation),
    { initialValue: false },
  );

  // The settings the import page sits under: the user's, or the organization's.
  protected readonly settingsRoute =
    this.organizationId == null
      ? ["/settings"]
      : ["/organizations", this.organizationId, "settings"];
}
