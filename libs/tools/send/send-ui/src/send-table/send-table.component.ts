import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
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

/**
 * A table component for displaying Send items with sorting, status indicators, and action menus. Handles the presentation of sends in a tabular format with options
 * for editing, copying links, removing passwords, and deleting.
 */
@Component({
  selector: "tools-send-table",
  templateUrl: "./send-table.component.html",
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
export class SendTableComponent {
  protected readonly sendType = SendType;

  /**
   * The data source containing the Send items to display in the table.
   */
  readonly dataSource = input<TableDataSource<SendView>>();

  /**
   * Whether Send functionality is disabled by policy.
   * When true, the "Remove Password" option is hidden from the action menu.
   */
  readonly disableSend = input(false);

  /**
   * Emitted when a user clicks on a Send item to edit it.
   * The clicked SendView is passed as the event payload.
   */
  readonly editSend = output<SendView>();

  /**
   * Emitted when a user clicks the "Copy Send Link" action.
   * The SendView is passed as the event payload for generating and copying the link.
   */
  readonly copySend = output<SendView>();

  /**
   * Emitted when a user clicks the "Remove Password" action.
   * The SendView is passed as the event payload for password removal.
   * This action is only available if the Send has a password and Send is not disabled.
   */
  readonly removePassword = output<SendView>();

  /**
   * Emitted when a user clicks the "Delete" action.
   * The SendView is passed as the event payload for deletion.
   */
  readonly deleteSend = output<SendView>();

  protected onEditSend(send: SendView): void {
    this.editSend.emit(send);
  }

  protected onCopy(send: SendView): void {
    this.copySend.emit(send);
  }

  protected onRemovePassword(send: SendView): void {
    this.removePassword.emit(send);
  }

  protected onDelete(send: SendView): void {
    this.deleteSend.emit(send);
  }
}
