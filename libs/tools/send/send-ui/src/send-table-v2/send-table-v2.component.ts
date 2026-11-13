import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  TrackByFunction,
  computed,
  inject,
  input,
  output,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { combineLatest, firstValueFrom, map, of, switchMap } from "rxjs";

import { StopPropDirective } from "@bitwarden/angular/directives/stop-prop.directive";
import { NoFolders, NoSendsIcon } from "@bitwarden/assets/svg";
import { ClientType } from "@bitwarden/client-type";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
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
  SearchComponent,
  SearchModule,
  FilterMenuModule,
  StatusLockupComponent,
  SvgComponent,
  IconTileComponent,
  FilterMenuComponent,
  ItemModule,
  TablePresentation,
  DialogService,
  ToastService,
  CollapseOnScrollDirective,
  ScrollCollapseSourceDirective,
  ColumnName,
} from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { I18nPipe } from "@bitwarden/ui-common";

import { NewSendDropdownV2Component } from "../new-send-dropdown-v2/new-send-dropdown-v2.component";
import { removeSendAuthI18nKeys } from "../send-auth/remove-send-auth-i18n";
import { getSendItemIcon } from "../send-item-icon";
import { SendPolicyService } from "../services/send-policy.service";

/** Synthetic (non-Send) columns declared on the table. */
type SendTableV2Column = "actions";

type SendFilters = { search: string; type: SendType | null };

/**
 * A `bit-table-v2` rendering of Sends, behaving like {@link SendTableComponent}
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
    ItemModule,
    CollapseOnScrollDirective,
    ScrollCollapseSourceDirective,
    StopPropDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendTableV2Component {
  protected readonly SendType = SendType;
  protected readonly AuthType = AuthType;
  protected readonly ClientType = ClientType;
  protected readonly itemIcon = getSendItemIcon;
  protected readonly noSendsIcon = NoSendsIcon;
  protected readonly noVisibleSendsIcon = NoFolders;
  protected readonly removeSendAuthI18nKeys = removeSendAuthI18nKeys;

  private readonly dialogService = inject(DialogService);
  private readonly sendApiService = inject(SendApiService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly validationService = inject(ValidationService);
  private readonly logService = inject(LogService);
  private readonly environmentService = inject(EnvironmentService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly sendPolicyService = inject(SendPolicyService);
  private readonly accountService = inject(AccountService);
  private readonly billingAccountProfileStateService = inject(BillingAccountProfileStateService);

  private readonly searchInput = viewChild(SearchComponent);
  private readonly tableEl = viewChild(BitTableV2Component);

  /**
   * The number of rows displayed in the table after filters and search have been applied
   */
  readonly filteredRowCount = computed(() => this.tableEl()?.filteredCount() ?? 0);
  private readonly sendTypeFilter = viewChild<FilterMenuComponent>("sendTypeFilter");
  protected readonly disableSend = toSignal(this.sendPolicyService.disableSend$);
  protected readonly hasPremium$ = this.accountService.activeAccount$.pipe(
    switchMap((account) => {
      if (!account) {
        return of(false);
      }
      return this.billingAccountProfileStateService.hasPremiumFromAnySource$(account.id);
    }),
  );
  protected readonly allowedSendTypes = toSignal(
    combineLatest([this.sendPolicyService.allowedSendTypes$, this.hasPremium$]).pipe(
      takeUntilDestroyed(),
      map(([allowedSendTypes, hasPremium]) => {
        if (!hasPremium) {
          return allowedSendTypes.filter((st) => st !== SendType.File && st !== SendType.Item);
        }
        return allowedSendTypes;
      }),
    ),
    { initialValue: [] },
  );

  /**
   * The Sends to display. Sorting and display are handled by the table.
   */
  readonly sends = input<SendView[]>();
  /** The table definition requires the input array always be specified, but we
   * use the `undefined` state of the input to drive the table's `loading` state */
  private readonly _sends = computed(() => this.sends() ?? []);

  /**
   * The prefix that is used when syncing table filter and search state to the URL. If
   * `undefined` then this syncing will be disabled
   */
  readonly queryPrefix = input<string | undefined>("sends");

  /**
   * The way that the Send table rows are drawn. Defaults to `table`
   */
  readonly presentation = input<TablePresentation>("table");

  /**
   * Whether Send creation buttons are shown in the table's toolbar and "no Sends" empty state.
   * Defaults to `true`.
   */
  readonly showCreateButtons = input(true);

  /**
   * Whether the Send table shows the Deletion Date column. Defaults to `true`
   */
  readonly showDeletionDateCol = input(true);

  /**
   * Whether Send row actions are collapsed into a triple-dot menu or are shown as individual buttons
   * Defaults to `true`
   */
  readonly collapseRowActions = input(true);

  /**
   * Emitted when a user clicks on a Send row to edit it.
   * The clicked SendView is passed as the event payload.
   */
  readonly editSend = output<SendView>();

  /**
   * Emitted when a user clicks the "Create" button.
   * The type of Send being created is the event payload
   */
  readonly addSend = output<SendType>();

  protected readonly table = defineTable<SendView, SendTableV2Column>(this._sends);
  protected readonly displayedColumns = computed<ColumnName<SendView, SendTableV2Column>[]>(() =>
    this.showDeletionDateCol() ? ["name", "deletionDate", "actions"] : ["name", "actions"],
  );

  protected readonly trackById: TrackByFunction<SendView> = (_index, send) => send.id;

  protected readonly filter = (row: SendView, f: SendFilters) =>
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

  protected async onCopySendLink(send: SendView): Promise<void> {
    const env = await firstValueFrom(this.environmentService.environment$);
    const link = env.getSendUrl() + send.accessId + "/" + send.urlB64Key;
    this.platformUtilsService.copyToClipboard(link);
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("valueCopied", this.i18nService.t("sendLink")),
    });
  }

  protected async onRemoveAuth(send: SendView): Promise<void> {
    if (this.disableSend()) {
      return;
    }

    const i18nKeys = removeSendAuthI18nKeys(send.authType);
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: i18nKeys.label },
      content: { key: i18nKeys.confirmation },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }

    try {
      await this.sendApiService.removeAuth(send.id);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t(i18nKeys.removed),
      });
    } catch (e) {
      this.validationService.showError(e);
      this.logService.error(e);
    }
  }

  protected async onDelete(sendView: SendView): Promise<boolean> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteSend" },
      content: { key: "deleteSendConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    try {
      await this.sendApiService.delete(sendView.id);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("deletedSend"),
      });
    } catch (e) {
      this.validationService.showError(e);
      this.logService.error(e);
      return false;
    }
    return true;
  }

  protected onAddSend(sendType: SendType): void {
    this.addSend.emit(sendType);
  }

  protected clearAll(): void {
    this.sendTypeFilter()?.clear();
    this.searchInput()?.clearSearch();
  }
}
