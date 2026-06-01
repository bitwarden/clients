import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnInit, inject } from "@angular/core";

import { BadgeComponent } from "../../../badge";
import { BadgeGroupComponent } from "../../../badge-group";
import { DialogModule, DialogService } from "../../../dialog";
import { IconButtonModule } from "../../../icon-button";
import { SectionComponent } from "../../../section";
import { TableDataSource } from "../../../table/table-data-source";
import {
  BitCellComponent,
  BitColumnComponent,
  BitColumnForDirective,
  BitColumnHeaderDirective,
  BitHeaderCellComponent,
  BitTableV2Component,
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
    BitColumnHeaderDirective,
    BitColumnForDirective,
    BitHeaderCellComponent,
    BitCellComponent,
  ],
  template: `<bit-section>
    <bit-table-v2 [dataSource]="dataSource" [displayedColumns]="displayedColumns" [rowSize]="64">
      <bit-column sortable defaultSort="asc">
        <bit-header-cell *bitColumnHeader>Id</bit-header-cell>
        <bit-cell *bitColumnFor="dataSource.columns.id; let cell">{{ cell.id }}</bit-cell>
      </bit-column>
      <bit-column sortable>
        <bit-header-cell *bitColumnHeader>Name</bit-header-cell>
        <bit-cell *bitColumnFor="dataSource.columns.name; let cell">{{ cell.name }}</bit-cell>
      </bit-column>
      <bit-column sortable>
        <bit-header-cell *bitColumnHeader>Updated</bit-header-cell>
        <bit-cell *bitColumnFor="dataSource.columns.updatedAt; let cell">
          {{ cell.updatedAt | date: "mediumDate" }}
        </bit-cell>
      </bit-column>
      <bit-column sortable [sortFn]="sortByTags">
        <bit-header-cell *bitColumnHeader>Tags</bit-header-cell>
        <bit-cell *bitColumnFor="dataSource.columns.tags; let cell" [truncate]="false">
          <bit-badge-group>
            @for (tag of cell.tags; track tag) {
              <span bitBadge variant="subtle">{{ tag }}</span>
            }
          </bit-badge-group>
        </bit-cell>
      </bit-column>
      <bit-column width="64px">
        <bit-header-cell *bitColumnHeader></bit-header-cell>
        <bit-cell *bitColumnFor="dataSource.synthetic('actions'); let cell">
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
  protected readonly displayedColumns = ["id", "name", "updatedAt", "tags", "actions"];
  protected readonly dataSource = new TableDataSource<Row>();

  protected readonly sortByTags = (a: Row, b: Row) =>
    a.tags.join(",").localeCompare(b.tags.join(","));

  ngOnInit(): void {
    const base = new Date(Date.UTC(2026, 0, 1));
    this.dataSource.data = [...Array(100).keys()].map((i) => {
      const date = new Date(base);
      date.setUTCDate(base.getUTCDate() + i);
      return {
        id: i,
        name: `name-${i}`,
        updatedAt: date,
        tags: Array.from({ length: (i % 3) + 1 }, (_, j) => TAG_POOL[(i + j) % TAG_POOL.length]),
      };
    });
  }

  async openDefaultDialog() {
    await this.dialogService.openSimpleDialog({
      type: "info",
      title: "Foo",
      content: "Bar",
    });
  }
}
