import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  TrackByFunction,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";
import { FormsModule } from "@angular/forms";

import { NoFolders, NoSendsIcon } from "@bitwarden/assets/svg";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { AuthType } from "@bitwarden/common/tools/send/types/auth-type";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { normalizeSearchQuery } from "@bitwarden/common/vault/services/search.service";
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
  IconTileComponent,
  FilterMenuComponent,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { NewSendDropdownV2Component } from "../new-send-dropdown-v2/new-send-dropdown-v2.component";
import { removeSendAuthI18nKeys } from "../send-auth/remove-send-auth-i18n";
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
    IconTileComponent,
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
    FormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendTableV2Component {
  protected readonly SendType = SendType;
  protected readonly authType = AuthType;
  readonly itemIcon = getSendItemIcon;
  protected readonly noSendsIcon = NoSendsIcon;
  protected readonly noVisibleSendsIcon = NoFolders;
  protected readonly removeSendAuthI18nKeys = removeSendAuthI18nKeys;

  protected readonly sendSearchText = signal<string>("");
  private readonly sendTypeFilter = viewChild<FilterMenuComponent>("sendTypeFilter");

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
   * Emitted when a user clicks the "Remove password" / "Remove email verification" action.
   * The SendView is passed as the event payload for authentication removal.
   * This action is only available if the Send has authentication and Send is not disabled.
   */
  readonly removeAuth = output<SendView>();

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
    (f.type == null || row.type === f.type) && this.sendSearchMatches(row, f.search);

  private sendSearchMatches(row: SendView, query: string | undefined) {
    if (!query) {
      return true;
    }
    const normalizedQuery = normalizeSearchQuery(query.trim().toLocaleLowerCase());
    if ((row.name ?? "").toLocaleLowerCase().includes(normalizedQuery)) {
      return true;
    }
    /** The following conditions were considered low priority matches in the V1 table and would show up after
     * any matches found via the name because we'd pass the table a filtered and ordered data set. The V2 table
     * handles filtering and ordering itself, so here they're simply further criteria
     */
    if ((row.notes ?? "").toLocaleLowerCase().includes(normalizedQuery)) {
      return true;
    }
    if ((row.text?.text ?? "").toLocaleLowerCase().includes(normalizedQuery)) {
      return true;
    }
    if ((row.file?.fileName ?? "").toLocaleLowerCase().includes(normalizedQuery)) {
      return true;
    }
    return false;
  }

  protected onEditSend(send: SendView): void {
    this.editSend.emit(send);
  }

  protected onCopy(send: SendView): void {
    this.copySend.emit(send);
  }

  protected onRemoveAuth(send: SendView): void {
    this.removeAuth.emit(send);
  }

  protected onDelete(send: SendView): void {
    this.deleteSend.emit(send);
  }

  protected onAddSend(sendType: SendType): void {
    this.addSend.emit(sendType);
  }

  protected onSearchTextChanged(t: string) {
    this.sendSearchText.set(t);
  }

  protected clearAll(): void {
    this.sendTypeFilter()?.clear();
    this.sendSearchText.set("");
  }
}
