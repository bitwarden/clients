import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ReceiveView } from "@bitwarden/common/tools/receive/models/view/receive.view";
import {
  BadgeModule,
  ButtonModule,
  IconButtonModule,
  LinkModule,
  MenuModule,
  TableDataSource,
  TableModule,
  TypographyModule,
} from "@bitwarden/components";

@Component({
  selector: "app-receive-table",
  templateUrl: "./receive-table.component.html",
  imports: [
    CommonModule,
    JslibModule,
    TableModule,
    ButtonModule,
    LinkModule,
    IconButtonModule,
    MenuModule,
    BadgeModule,
    TypographyModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceiveTableComponent {
  readonly dataSource = input<TableDataSource<ReceiveView>>();
  readonly disableReceive = input(false);

  readonly viewReceive = output<ReceiveView>();
  readonly copyReceive = output<ReceiveView>();
  readonly deleteReceive = output<ReceiveView>();

  protected onViewReceive(receive: ReceiveView): void {
    this.viewReceive.emit(receive);
  }

  protected onCopy(receive: ReceiveView): void {
    this.copyReceive.emit(receive);
  }

  protected onDelete(receive: ReceiveView): void {
    this.deleteReceive.emit(receive);
  }

  protected isExpired(view: ReceiveView): boolean {
    return view.expirationDate != null && view.expirationDate < new Date();
  }
}
