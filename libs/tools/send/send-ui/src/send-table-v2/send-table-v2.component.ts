import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, TrackByFunction, input, output } from "@angular/core";

import { NoSendsIcon } from "@bitwarden/assets/svg";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { AuthType } from "@bitwarden/common/tools/send/types/auth-type";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import {
  BitCellComponent,
  BitCellDefDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  BitTableV2Component,
  ButtonModule,
  IconButtonModule,
  IconModule,
  LinkModule,
  MenuModule,
  TooltipDirective,
  TypographyModule,
  defineTable,
  BitTableToolbarComponent,
  SearchModule,
  FilterMenuModule,
  StatusLockupComponent,
  SvgComponent,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { NewSendDropdownV2Component } from "../new-send-dropdown-v2/new-send-dropdown-v2.component";
import { getSendItemIcon } from "../send-item-icon";

/** Synthetic (non-Send) columns declared on the table. */
type SendTableV2Column = "actions";

type SendFilters = { search: string; type: SendType | null };

/**
 * A `bit-table-v2` rendering of Sends, behaving like {@link SendTableComponent}: sortable by name
 * and deletion date, status indicators on each name, and an action menu per row for copying the
 * link, removing the password, and deleting. Clicking a row emits `editSend`.
 *
 * **Beta.** Inherits the `bit-table-v2` beta status; see the table's own documentation.
 */
@Component({
  selector: "tools-send-table-v2",
  templateUrl: "./send-table-v2.component.html",
  imports: [
    CommonModule,
    BitCellComponent,
    BitCellDefDirective,
    BitColumnComponent,
    BitHeaderCellComponent,
    BitTableV2Component,
    ButtonModule,
    IconButtonModule,
    IconModule,
    LinkModule,
    MenuModule,
    TooltipDirective,
    TypographyModule,
    BitTableToolbarComponent,
    SearchModule,
    FilterMenuModule,
    I18nPipe,
    NewSendDropdownV2Component,
    StatusLockupComponent,
    SvgComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendTableV2Component {
  protected readonly SendType = SendType;
  protected readonly authType = AuthType;
  readonly itemIcon = getSendItemIcon;
  protected readonly noItemIcon = NoSendsIcon;

  /**
   * The Sends to display. Sorting and display are handled by the table.
   */
  readonly sends = input<SendView[]>([]);

  /**
   * Whether Send functionality is disabled by policy.
   * When true, the "Remove Password" option is hidden from the action menu.
   */
  readonly disableSend = input(false);

  /**
   * Emitted when a user clicks on a Send row to edit it.
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

  /**
   * Emitted when a user clicks the "Delete" action in the bulk actions bar.
   * The selected SendViews are passed as the event payload.
   */
  readonly bulkDeleteSend = output<readonly SendView[]>();

  /**
   * Emitted when a user clicks the "Create" button.
   * The type of Send being created is the event payload
   */
  readonly addSend = output<SendType>();

  protected readonly table = defineTable<SendView, SendTableV2Column>(this.sends);

  protected readonly trackById: TrackByFunction<SendView> = (_index, send) => send.id;

  readonly filter = (row: SendView, f: SendFilters) =>
    (f.type == null || row.type === f.type) &&
    (!f.search || row.name.toLowerCase().includes(f.search.toLowerCase()));

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

  protected onAddSend(sendType: SendType): void {
    this.addSend.emit(sendType);
  }
}
