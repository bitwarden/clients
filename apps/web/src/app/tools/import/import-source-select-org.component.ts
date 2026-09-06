import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

import { isId, OrganizationId } from "@bitwarden/common/types/guid";
import { ImportSourceSelectComponent } from "@bitwarden/importer-ui";

import { HeaderModule } from "../../layouts/header/header.module";

@Component({
  templateUrl: "import-source-select-org.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImportSourceSelectComponent, HeaderModule],
})
export class ImportSourceSelectOrgComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);

  // TODO: (PM-41469) wire these into `ImportSourceSelectComponent` once format/strategy selection and import
  // execution exist (follow-on story) — captured now so the org route keeps its own identity
  // instead of silently reusing the personal wrapper (see `ImportSourceSelectWebComponent`).
  protected readonly routeOrgId = signal<OrganizationId | undefined>(undefined);
  protected readonly returnTo = signal<string | undefined>(undefined);

  ngOnInit(): void {
    const orgIdParam = this.route.snapshot.paramMap.get("organizationId");
    if (orgIdParam === undefined) {
      throw new Error("`organizationId` is a required route parameter");
    }

    if (!isId<OrganizationId>(orgIdParam)) {
      throw new Error("Invalid OrganizationId provided in route parameter `organizationId`");
    }

    this.routeOrgId.set(orgIdParam);
    this.returnTo.set(this.route.snapshot.queryParamMap.get("returnTo") ?? undefined);
  }
}
