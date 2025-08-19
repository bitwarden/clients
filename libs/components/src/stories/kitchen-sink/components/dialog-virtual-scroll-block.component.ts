import { ScrollingModule } from "@angular/cdk/scrolling";
import { Component, OnInit } from "@angular/core";

import { DialogModule, DialogService } from "../../../dialog";
import { IconButtonModule } from "../../../icon-button";
import { ScrollLayoutDirective } from "../../../layout";
import { SectionComponent } from "../../../section";
import { TableDataSource, TableModule } from "../../../table";

@Component({
  selector: "dialog-virtual-scroll-block",
  standalone: true,
  imports: [
    DialogModule,
    IconButtonModule,
    SectionComponent,
    TableModule,
    ScrollingModule,
    ScrollLayoutDirective,
  ],
  template: /*html*/ `<bit-section>
    <cdk-virtual-scroll-viewport bitScrollLayout itemSize="49.5">
      <bit-table [dataSource]="dataSource">
        <ng-container header>
          <tr>
            <th bitCell bitSortable="id" default>Id</th>
            <th bitCell bitSortable="name">Name</th>
            <th bitCell>Options</th>
          </tr>
        </ng-container>
        <ng-template body let-rows$>
          <tr bitRow *cdkVirtualFor="let r of rows$">
            <td bitCell>{{ r.id }}</td>
            <td bitCell>{{ r.name }}</td>
            <td bitCell>
              <button
                bitIconButton="bwi-ellipsis-v"
                type="button"
                aria-label="Options"
                (click)="openDefaultDialog()"
              ></button>
            </td>
          </tr>
        </ng-template>
      </bit-table>
    </cdk-virtual-scroll-viewport>
  </bit-section>`,
})
export class DialogVirtualScrollBlockComponent implements OnInit {
  constructor(public dialogService: DialogService) {}

  protected dataSource = new TableDataSource<{ id: number; name: string; other: string }>();

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
