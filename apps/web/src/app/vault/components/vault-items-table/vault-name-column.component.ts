import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  BitCellComponent,
  BitCellDefDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  IconModule,
  LinkModule,
  SortFn,
  TableDataSource,
} from "@bitwarden/components";

import { compareNames, NameColumnRow, prioritizeCollections, VaultRowBase } from "./vault-row";

/**
 * Name column for a vault items `bit-table-v2`. Renders the type icon
 * (`slot=start`), the name as an activation link, and the subtitle
 * (`slot=secondary`). Drop into a `<bit-table-v2>` alongside the other
 * `vault-*-column` components; it registers itself with the ancestor table.
 */
@Component({
  selector: "vault-name-column",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    JslibModule,
    BitColumnComponent,
    BitHeaderCellComponent,
    BitCellComponent,
    BitCellDefDirective,
    IconModule,
    LinkModule,
  ],
  template: `
    <bit-column sortable defaultSort="asc" [sortFn]="sortFn" width="minmax(240px, 3fr)">
      <bit-header-cell>{{ "name" | i18n }}</bit-header-cell>
      <bit-cell *bitCellDef="ds().columns.name; let row">
        @if (row.cipher; as cipher) {
          <app-vault-icon slot="start" [cipher]="cipher" />
        } @else {
          <bit-icon slot="start" name="bwi-collection-shared" class="tw-text-muted" />
        }
        <button
          bitLink
          linkType="primary"
          type="button"
          [disabled]="disabled()"
          (click)="rowClick.emit(row)"
        >
          {{ row.name }}
        </button>
        @if (row.subtitle; as subtitle) {
          <span slot="secondary">{{ subtitle }}</span>
        }
      </bit-cell>
    </bit-column>
  `,
})
export class VaultNameColumnComponent<T extends NameColumnRow> {
  readonly ds = input.required<TableDataSource<T>>();
  readonly disabled = input(false);
  readonly rowClick = output<T>();

  /** Collections before ciphers, then alphabetically by name. */
  protected readonly sortFn: SortFn = (a: VaultRowBase, b: VaultRowBase) => {
    const byKind = prioritizeCollections(a, b);
    return byKind !== 0 ? byKind : compareNames(a, b);
  };
}
