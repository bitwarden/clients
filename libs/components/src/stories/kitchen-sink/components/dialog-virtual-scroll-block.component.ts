import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from "@angular/core";

import { BadgeComponent } from "../../../badge";
import { BadgeGroupComponent } from "../../../badge-group";
import { DialogModule, DialogService } from "../../../dialog";
import { IconButtonModule } from "../../../icon-button";
import { SectionComponent } from "../../../section";
import {
  BitCellComponent,
  BitCellDefDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  BitTableV2Component,
  TableModel,
} from "../../../table/v2";

type Row = { id: number; name: string; updatedAt: Date; tags: string[] };

const TAG_POOL = ["Personal", "Work", "Shared", "Archived", "Favorite", "Family"];

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "dialog-virtual-scroll-block",
  imports: [
    DatePipe,
    BadgeComponent,
    BadgeGroupComponent,
    DialogModule,
    IconButtonModule,
    SectionComponent,
    BitTableV2Component,
    BitColumnComponent,
    BitCellDefDirective,
    BitHeaderCellComponent,
    BitCellComponent,
  ],
  template: `<bit-section>
    <bit-table-v2 [table]="table" [virtualRowHeight]="64">
      <bit-column sortable defaultSort="asc">
        <bit-header-cell>Id</bit-header-cell>
        <bit-cell *bitCellDef="table.columns.id; let row">{{ row.id }}</bit-cell>
      </bit-column>
      <bit-column sortable>
        <bit-header-cell>Name</bit-header-cell>
        <bit-cell *bitCellDef="table.columns.name; let row">{{ row.name }}</bit-cell>
      </bit-column>
      <bit-column sortable>
        <bit-header-cell>Updated</bit-header-cell>
        <bit-cell *bitCellDef="table.columns.updatedAt; let row">
          {{ row.updatedAt | date: "mediumDate" }}
        </bit-cell>
      </bit-column>
      <bit-column sortable [sortFn]="sortByTags">
        <bit-header-cell>Tags</bit-header-cell>
        <bit-cell *bitCellDef="table.columns.tags; let row" [truncate]="false">
          <bit-badge-group>
            @for (tag of row.tags; track tag) {
              <span bitBadge variant="subtle">{{ tag }}</span>
            }
          </bit-badge-group>
        </bit-cell>
      </bit-column>
      <bit-column width="64px">
        <bit-header-cell></bit-header-cell>
        <bit-cell *bitCellDef="table.columns.actions; let row">
          <button
            slot="end"
            bitIconButton="bwi-ellipsis-v"
            type="button"
            label="Options"
            (click)="openDefaultDialog()"
          ></button>
        </bit-cell>
      </bit-column>
    </bit-table-v2>
  </bit-section>`,
})
export class DialogVirtualScrollBlockComponent implements OnInit {
  protected readonly dialogService = inject(DialogService);
  private readonly rows = signal<Row[]>([]);
  protected readonly table = new TableModel<Row, "actions">({
    data: this.rows,
    displayedColumns: ["id", "name", "updatedAt", "tags", "actions"],
  });

  protected readonly sortByTags = (a: Row, b: Row) =>
    a.tags.join(",").localeCompare(b.tags.join(","));

  ngOnInit(): void {
    const base = new Date(Date.UTC(2026, 0, 1));
    this.rows.set(
      [...Array(100).keys()].map((i) => {
        const date = new Date(base);
        date.setUTCDate(base.getUTCDate() + i);
        return {
          id: i,
          name: `name-${i}`,
          updatedAt: date,
          tags: Array.from({ length: (i % 3) + 1 }, (_, j) => TAG_POOL[(i + j) % TAG_POOL.length]),
        };
      }),
    );
  }

  async openDefaultDialog() {
    await this.dialogService.openSimpleDialog({
      type: "info",
      title: "Foo",
      content: "Bar",
    });
  }
}
