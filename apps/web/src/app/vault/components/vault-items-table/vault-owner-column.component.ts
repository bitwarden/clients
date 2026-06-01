import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import {
  BitCellComponent,
  BitCellDefDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  TableDataSource,
} from "@bitwarden/components";
import { OrganizationNameBadgeComponent } from "@bitwarden/vault";

import { OwnerColumnRow } from "./vault-row";

/** Owner column: renders the organization badge for each row. */
@Component({
  selector: "vault-owner-column",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    JslibModule,
    BitColumnComponent,
    BitHeaderCellComponent,
    BitCellComponent,
    BitCellDefDirective,
    OrganizationNameBadgeComponent,
  ],
  template: `
    <bit-column width="2fr">
      <bit-header-cell>{{ "owner" | i18n }}</bit-header-cell>
      <bit-cell *bitCellDef="ds().columns.organizationId; let row">
        <app-org-badge
          [organizationId]="row.organizationId"
          [organizationName]="organizationName(row.organizationId)"
          [disabled]="disabled()"
        />
      </bit-cell>
    </bit-column>
  `,
})
export class VaultOwnerColumnComponent<T extends OwnerColumnRow> {
  readonly ds = input.required<TableDataSource<T>>();
  readonly allOrganizations = input<Organization[]>([]);
  readonly disabled = input(false);

  protected organizationName(organizationId: string | undefined): string {
    return this.allOrganizations().find((o) => String(o.id) === organizationId)?.name ?? "";
  }
}
