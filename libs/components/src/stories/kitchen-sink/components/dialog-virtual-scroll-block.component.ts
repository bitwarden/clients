import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnInit, inject } from "@angular/core";

import { BadgeComponent } from "../../../badge";
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
        <th *bitColumnHeader bit-cell>Id</th>
        <td *bitColumnFor="dataSource.columns.id; let cell" bit-cell>{{ cell.id }}</td>
      </bit-column>
      <bit-column sortable>
        <th *bitColumnHeader bit-cell>Name</th>
        <td *bitColumnFor="dataSource.columns.name; let cell" bit-cell>{{ cell.name }}</td>
      </bit-column>
      <bit-column sortable>
        <th *bitColumnHeader bit-cell>Updated</th>
        <td *bitColumnFor="dataSource.columns.updatedAt; let cell" bit-cell>
          {{ cell.updatedAt | date: "mediumDate" }}
        </td>
      </bit-column>
      <bit-column sortable [sortFn]="sortByTags">
        <th *bitColumnHeader bit-cell>Tags</th>
        <td *bitColumnFor="dataSource.columns.tags; let cell" bit-cell [truncate]="false">
          <div class="tw-flex tw-gap-1">
            @for (tag of cell.tags; track tag) {
              <span bitBadge variant="subtle">{{ tag }}</span>
            }
          </div>
        </td>
      </bit-column>
      <bit-column>
        <th *bitColumnHeader bit-cell></th>
        <td *bitColumnFor="dataSource.synthetic('actions'); let cell" bit-cell>
          <button
            slot="end"
            bitIconButton="bwi-ellipsis-v"
            type="button"
            label="Options"
            (click)="openDefaultDialog()"
          ></button>
        </td>
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
