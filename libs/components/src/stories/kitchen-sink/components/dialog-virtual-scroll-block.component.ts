import { ChangeDetectionStrategy, Component, OnInit, inject } from "@angular/core";

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

type Row = { id: number; name: string; other: string };

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "dialog-virtual-scroll-block",
  imports: [
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
      <bit-column>
        <th *bitColumnHeader bit-cell></th>
        <td *bitColumnFor="dataSource.synthetic('actions'); let cell" bit-cell>
          <button
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
  protected readonly displayedColumns = ["id", "name", "actions"];
  protected readonly dataSource = new TableDataSource<Row>();

  ngOnInit(): void {
    this.dataSource.data = [...Array(100).keys()].map((i) => ({
      id: i,
      name: `name-${i}`,
      other: `other-${i}`,
    }));
  }

  async openDefaultDialog() {
    await this.dialogService.openSimpleDialog({
      type: "info",
      title: "Foo",
      content: "Bar",
    });
  }
}
