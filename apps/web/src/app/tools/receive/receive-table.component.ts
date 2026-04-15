import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ReceiveView } from "@bitwarden/common/tools/receive/models/view/receive.view";
import {
  BadgeModule,
  ButtonModule,
  IconButtonModule,
  IconModule,
  LinkModule,
  MenuModule,
  TableDataSource,
  TableModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { ReceiveRow } from "./receive.component";

@Component({
  selector: "app-receive-table",
  templateUrl: "./receive-table.component.html",
  imports: [
    CommonModule,
    I18nPipe,
    JslibModule,
    TableModule,
    ButtonModule,
    LinkModule,
    IconButtonModule,
    MenuModule,
    BadgeModule,
    IconModule,
    TypographyModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceiveTableComponent {
  readonly dataSource = input<TableDataSource<ReceiveRow>>();

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
}
