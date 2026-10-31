import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { map } from "rxjs";

import { IMPORT_ORGANIZATION_ID_ROUTE_PARAM } from "@bitwarden/importer-ui";

import { ImportShellContentWebComponent } from "./import-shell-content-web.component";

/** The route component for the import, for the user or for an organization. The router keeps it
 *  when only the organization in the URL changes, but each organization has its own staged items,
 *  location step and links, so the content is rebuilt for it rather than reused. */
@Component({
  templateUrl: "import-shell-web.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImportShellContentWebComponent],
})
export class ImportShellWebComponent {
  protected readonly organizationKey = toSignal(
    inject(ActivatedRoute).paramMap.pipe(
      map((params) => params.get(IMPORT_ORGANIZATION_ID_ROUTE_PARAM) ?? ""),
    ),
    { requireSync: true },
  );
}
